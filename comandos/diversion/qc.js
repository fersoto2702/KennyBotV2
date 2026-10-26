const axios = require('axios')
const sharp = require('sharp')

const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')

const SIZE = 512

const COLORS = {
    background: '#0b141a',
    bubble: '#202c33',
    bubbleAlt: '#1f2c34',
    reply: '#182229',
    accent: '#25d366',
    text: '#e9edef',
    muted: '#aebac1'
}

function jidToNumber(jid = '') {
    return String(jid)
        .split('@')[0]
        .split(':')[0]
}

function normalizeJid(jid = '') {
    if (!jid) return null

    return String(jid)
        .trim()
        .replace(/:\d+@/, '@')
}

function escapeXml(text = '') {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

function cleanText(text = '') {
    return String(text)
        .replace(/\r/g, '')
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function truncate(text = '', max = 300) {
    const value = cleanText(text)

    if (value.length <= max) {
        return value
    }

    return `${value.slice(0, max - 3).trim()}...`
}

function getTextFromMessage(message) {
    if (!message) return ''

    if (message.conversation) {
        return message.conversation
    }

    if (message.extendedTextMessage?.text) {
        return message.extendedTextMessage.text
    }

    if (message.imageMessage?.caption) {
        return message.imageMessage.caption
    }

    if (message.videoMessage?.caption) {
        return message.videoMessage.caption
    }

    if (message.documentMessage?.caption) {
        return message.documentMessage.caption
    }

    if (message.buttonsResponseMessage?.selectedDisplayText) {
        return message.buttonsResponseMessage.selectedDisplayText
    }

    if (message.listResponseMessage?.title) {
        return message.listResponseMessage.title
    }

    return ''
}

function wrapText(
    text,
    maxChars = 28,
    maxLines = 10
) {
    const value = cleanText(text)

    if (!value) {
        return ['']
    }

    const words =
        value.split(' ')

    const lines = []

    let current = ''

    for (const word of words) {
        const next =
            current
                ? `${current} ${word}`
                : word

        if (next.length <= maxChars) {
            current = next
            continue
        }

        if (current) {
            lines.push(current)
        }

        if (lines.length >= maxLines) {
            break
        }

        if (word.length > maxChars) {
            let remaining = word

            while (
                remaining.length > maxChars &&
                lines.length < maxLines
            ) {
                lines.push(
                    remaining.slice(
                        0,
                        maxChars
                    )
                )

                remaining =
                    remaining.slice(
                        maxChars
                    )
            }

            current = remaining

        } else {
            current = word
        }
    }

    if (
        current &&
        lines.length < maxLines
    ) {
        lines.push(current)
    }

    if (lines.length >= maxLines) {
        const last =
            lines.length - 1

        const currentLast =
            lines[last]

        if (
            !currentLast.endsWith('...')
        ) {
            lines[last] =
                truncate(
                    currentLast,
                    Math.max(
                        6,
                        maxChars - 2
                    )
                )
        }
    }

    return lines
}

function getMainTextStyle(text) {
    const length =
        cleanText(text).length

    if (length <= 40) {
        return {
            fontSize: 32,
            lineHeight: 39,
            chars: 24,
            maxLines: 7
        }
    }

    if (length <= 100) {
        return {
            fontSize: 27,
            lineHeight: 34,
            chars: 29,
            maxLines: 9
        }
    }

    if (length <= 220) {
        return {
            fontSize: 23,
            lineHeight: 30,
            chars: 34,
            maxLines: 10
        }
    }

    return {
        fontSize: 20,
        lineHeight: 26,
        chars: 39,
        maxLines: 11
    }
}

function buildSvgTextLines({
    lines,
    x,
    y,
    fontSize,
    lineHeight,
    color,
    weight = 400
}) {
    return lines
        .map(
            (line, index) => {

                const currentY =
                    y +
                    (
                        index *
                        lineHeight
                    )

                return `
                    <text
                        x="${x}"
                        y="${currentY}"
                        font-family="Arial, Helvetica, sans-serif"
                        font-size="${fontSize}"
                        font-weight="${weight}"
                        fill="${color}"
                    >${escapeXml(line)}</text>
                `
            }
        )
        .join('')
}

async function getProfilePhotoUrl(
    sock,
    jid
) {
    try {
        return await sock.profilePictureUrl(
            jid,
            'image'
        )
    } catch {
        return null
    }
}

async function downloadImage(
    url
) {
    if (!url) {
        return null
    }

    try {
        const response =
            await axios.get(
                url,
                {
                    responseType:
                        'arraybuffer',

                    timeout:
                        10000,

                    validateStatus:
                        status =>
                            status >= 200 &&
                            status < 300
                }
            )

        return Buffer.from(
            response.data
        )

    } catch {
        return null
    }
}

async function createFallbackAvatar() {
    const svg =
        Buffer.from(`
            <svg
                width="96"
                height="96"
                xmlns="http://www.w3.org/2000/svg"
            >
                <rect
                    width="96"
                    height="96"
                    rx="48"
                    fill="#374248"
                />

                <circle
                    cx="48"
                    cy="36"
                    r="17"
                    fill="#8696a0"
                />

                <path
                    d="M18 88c4-21 16-31 30-31s26 10 30 31"
                    fill="#8696a0"
                />
            </svg>
        `)

    return sharp(
        svg
    )
        .png()
        .toBuffer()
}

async function createCircularAvatar(
    source
) {
    const fallback =
        await createFallbackAvatar()

    let input =
        source ||
        fallback

    try {
        input =
            await sharp(
                input
            )
                .resize(
                    78,
                    78,
                    {
                        fit:
                            'cover'
                    }
                )
                .png()
                .toBuffer()

    } catch {
        input =
            await sharp(
                fallback
            )
                .resize(
                    78,
                    78
                )
                .png()
                .toBuffer()
    }

    const mask =
        Buffer.from(`
            <svg
                width="78"
                height="78"
                xmlns="http://www.w3.org/2000/svg"
            >
                <circle
                    cx="39"
                    cy="39"
                    r="39"
                    fill="white"
                />
            </svg>
        `)

    return sharp(
        input
    )
        .composite(
            [
                {
                    input:
                        mask,

                    blend:
                        'dest-in'
                }
            ]
        )
        .png()
        .toBuffer()
}

function buildQuoteSvg({
    authorName,
    text,
    replyName,
    replyText
}) {
    const mainStyle =
        getMainTextStyle(
            text
        )

    const mainLines =
        wrapText(
            truncate(
                text,
                900
            ),
            mainStyle.chars,
            mainStyle.maxLines
        )

    const hasReply =
        Boolean(
            cleanText(
                replyText
            )
        )

    const replyLines =
        hasReply
            ? wrapText(
                truncate(
                    replyText,
                    160
                ),
                34,
                2
            )
            : []

    const bubbleX =
        28

    const bubbleWidth =
        456

    const avatarX =
        48

    const avatarY =
        52

    const contentX =
        148

    const contentRight =
        455

    const nameY =
        80

    const topContentY =
        hasReply
            ? 126
            : 116

    const replyHeight =
        hasReply
            ? (
                56 +
                Math.max(
                    0,
                    replyLines.length - 1
                ) *
                16
            )
            : 0

    const mainStartY =
        hasReply
            ? (
                topContentY +
                replyHeight +
                38
            )
            : 132

    const textHeight =
        mainLines.length *
        mainStyle.lineHeight

    const bubbleHeight =
        Math.min(
            428,
            Math.max(
                180,
                (
                    mainStartY +
                    textHeight +
                    40
                ) -
                28
            )
        )

    const bubbleY =
        Math.max(
            24,
            Math.round(
                (
                    SIZE -
                    bubbleHeight
                ) /
                2
            )
        )

    const offset =
        bubbleY -
        28

    const finalAvatarY =
        avatarY +
        offset

    const finalNameY =
        nameY +
        offset

    const finalTopContentY =
        topContentY +
        offset

    const finalMainStartY =
        mainStartY +
        offset

    const safeAuthor =
        escapeXml(
            truncate(
                authorName ||
                'Usuario',
                34
            )
        )

    const safeReplyName =
        escapeXml(
            truncate(
                replyName ||
                'Mensaje',
                28
            )
        )

    return Buffer.from(`
        <svg
            width="${SIZE}"
            height="${SIZE}"
            xmlns="http://www.w3.org/2000/svg"
        >
            <rect
                width="${SIZE}"
                height="${SIZE}"
                fill="${COLORS.background}"
            />

            <rect
                x="${bubbleX}"
                y="${bubbleY}"
                width="${bubbleWidth}"
                height="${bubbleHeight}"
                rx="30"
                fill="${COLORS.bubble}"
            />

            <text
                x="${contentX}"
                y="${finalNameY}"
                font-family="Arial, Helvetica, sans-serif"
                font-size="23"
                font-weight="700"
                fill="${COLORS.accent}"
            >${safeAuthor}</text>

            ${
                hasReply
                    ? `
                        <rect
                            x="${contentX}"
                            y="${finalTopContentY}"
                            width="${contentRight - contentX}"
                            height="${replyHeight}"
                            rx="13"
                            fill="${COLORS.reply}"
                        />

                        <rect
                            x="${contentX}"
                            y="${finalTopContentY}"
                            width="5"
                            height="${replyHeight}"
                            rx="3"
                            fill="${COLORS.accent}"
                        />

                        <text
                            x="${contentX + 16}"
                            y="${finalTopContentY + 21}"
                            font-family="Arial, Helvetica, sans-serif"
                            font-size="15"
                            font-weight="700"
                            fill="${COLORS.accent}"
                        >${safeReplyName}</text>

                        ${
                            buildSvgTextLines({
                                lines:
                                    replyLines,

                                x:
                                    contentX + 16,

                                y:
                                    finalTopContentY + 43,

                                fontSize:
                                    14,

                                lineHeight:
                                    16,

                                color:
                                    COLORS.muted,

                                weight:
                                    400
                            })
                        }
                    `
                    : ''
            }

            ${
                buildSvgTextLines({
                    lines:
                        mainLines,

                    x:
                        contentX,

                    y:
                        finalMainStartY,

                    fontSize:
                        mainStyle.fontSize,

                    lineHeight:
                        mainStyle.lineHeight,

                    color:
                        COLORS.text,

                    weight:
                        400
                })
            }

            <text
                x="${contentRight}"
                y="${bubbleY + bubbleHeight - 18}"
                text-anchor="end"
                font-family="Arial, Helvetica, sans-serif"
                font-size="13"
                fill="${COLORS.muted}"
            >QC</text>

        </svg>
    `)
}

async function generateQuoteSticker({
    sock,
    authorJid,
    authorName,
    text,
    replyName,
    replyText
}) {
    const photoUrl =
        await getProfilePhotoUrl(
            sock,
            authorJid
        )

    const photoBuffer =
        await downloadImage(
            photoUrl
        )

    const avatar =
        await createCircularAvatar(
            photoBuffer
        )

    const svg =
        buildQuoteSvg({
            authorName,
            text,
            replyName,
            replyText
        })

    const background =
        await sharp(
            svg
        )
            .png()
            .toBuffer()

    return sharp(
        background
    )
        .composite(
            [
                {
                    input:
                        avatar,

                    left:
                        48,

                    top:
                        52
                }
            ]
        )
        .webp(
            {
                quality:
                    95,

                alphaQuality:
                    100,

                effort:
                    5
            }
        )
        .toBuffer()
}

async function sendMessage(
    sock,
    jid,
    content,
    options = {}
) {
    if (
        typeof sock.safeSendMessage ===
        'function'
    ) {
        return await sock.safeSendMessage(
            jid,
            content,
            options
        )
    }

    return await sock.sendMessage(
        jid,
        content,
        options
    )
}

function getSelfJids(
    sock
) {
    return [
        sock?.user?.id,
        sock?.user?.lid
    ]
        .map(
            normalizeJid
        )
        .filter(
            Boolean
        )
}

function isSameUser(
    first,
    second
) {
    const a =
        normalizeJid(
            first
        )

    const b =
        normalizeJid(
            second
        )

    return Boolean(
        a &&
        b &&
        a === b
    )
}

module.exports = {

    name:
        'qc',

    aliases: [
        'quote',
        'cita'
    ],

    description:
        'Genera un sticker de cita a partir de un mensaje respondido',

    category:
        'diversion',

    async execute({
        sock,
        from,
        msg,
        prefix = '.'
    }) {

        try {
            const contextInfo =
                msg?.message
                    ?.extendedTextMessage
                    ?.contextInfo

            const quoted =
                contextInfo
                    ?.quotedMessage

            if (!quoted) {
                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.warn(
                                'MENSAJE REQUERIDO',
                                `Responde a un mensaje y usa ${prefix}qc`
                            )
                    }
                )
            }

            const quoteText =
                getTextFromMessage(
                    quoted
                )

            if (!quoteText) {
                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.warn(
                                'NO COMPATIBLE',
                                'Solo puedo generar citas de mensajes que tengan texto o caption.'
                            )
                    }
                )
            }

            const quotedAuthor =
                normalizeJid(
                    contextInfo?.participant ||
                    msg?.participant ||
                    msg?.key?.participant ||
                    msg?.key?.remoteJid
                )

            const selfJids =
                getSelfJids(
                    sock
                )

            const sender =
                normalizeJid(
                    msg?.key?.fromMe
                        ? (
                            sock?.user?.lid ||
                            sock?.user?.id
                        )
                        : (
                            msg?.key?.participant ||
                            msg?.participant ||
                            msg?.key?.remoteJid
                        )
                )

            let authorName =
                jidToNumber(
                    quotedAuthor
                )

            if (
                isSameUser(
                    quotedAuthor,
                    sender
                )
            ) {
                authorName =
                    'Tú'
            }

            if (
                selfJids.some(
                    jid =>
                        isSameUser(
                            jid,
                            quotedAuthor
                        )
                )
            ) {
                authorName =
                    'Tú'
            }

            const nestedContext =
                quoted
                    ?.extendedTextMessage
                    ?.contextInfo

            const nestedQuoted =
                nestedContext
                    ?.quotedMessage

            const nestedText =
                getTextFromMessage(
                    nestedQuoted
                )

            let replyName =
                null

            let replyText =
                null

            if (
                nestedQuoted &&
                nestedText
            ) {
                const nestedParticipant =
                    normalizeJid(
                        nestedContext?.participant
                    )

                replyText =
                    nestedText

                if (
                    isSameUser(
                        nestedParticipant,
                        sender
                    )
                ) {
                    replyName =
                        'Tú'

                } else if (
                    selfJids.some(
                        jid =>
                            isSameUser(
                                jid,
                                nestedParticipant
                            )
                    )
                ) {
                    replyName =
                        'Tú'

                } else if (
                    nestedParticipant
                ) {
                    replyName =
                        jidToNumber(
                            nestedParticipant
                        )

                } else {
                    replyName =
                        'Mensaje'
                }
            }

            const stickerBuffer =
                await generateQuoteSticker({
                    sock,
                    authorJid:
                        quotedAuthor,

                    authorName,

                    text:
                        quoteText,

                    replyName,

                    replyText
                })

            await sendMessage(
                sock,
                from,
                {
                    sticker:
                        stickerBuffer
                },
                {
                    quoted:
                        msg
                }
            )

            logger.event(
                `${sock?.botProfile?.name || 'KennyBot'} | QC usado: ${jidToNumber(quotedAuthor)}`
            )

            return true

        } catch (err) {
            logger.error(
                `${sock?.botProfile?.name || 'KennyBot'} | Error qc: ${err.stack || err.message}`
            )

            try {
                await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.error(
                                'ERROR',
                                'No se pudo generar el sticker de cita.'
                            )
                    }
                )
            } catch {}

            return false
        }
    }
}
const fs =
    require('fs')

const path =
    require('path')

const {
    execFile
} = require('child_process')

const {
    promisify
} = require('util')

const {
    downloadContentFromMessage
} = require('@whiskeysockets/baileys')

const sharp =
    require('sharp')

const {
    isMediaTooLarge
} = require('../src/utils/antiCrash')

const generateTempFile =
    require('../src/utils/generateTempFile')

const logger =
    require('../src/utils/logger')

const ui =
    require('../src/utils/ui')

const {
    isLimited,
    getRemainingTime
} = require('../src/system/rateLimiter')

const execFileAsync =
    promisify(
        execFile
    )

const MAX_MEDIA_MB =
    20

const FFMPEG_PATH =
    process.env.FFMPEG_PATH ||
    'ffmpeg'

function normalizeJid(
    jid
) {

    if (!jid) {

        return null

    }

    return String(
        jid
    )
        .trim()
        .replace(
            /:\d+@/,
            '@'
        )

}

function getNumber(
    jid
) {

    return String(
        normalizeJid(
            jid
        ) ||
        ''
    )
        .split('@')[0]

}

function getBotProfileId(
    sock
) {

    return String(
        sock?.botProfile?.id ||
        sock?.botProfileId ||
        'main'
    )
        .trim()
        .toLowerCase()

}

function getBotName(
    sock
) {

    return String(
        sock?.botProfile?.name ||
        'KennyBot'
    )
        .trim()

}

function safeDelete(
    file
) {

    try {

        if (
            file &&
            fs.existsSync(
                file
            )
        ) {

            fs.unlinkSync(
                file
            )

        }

    } catch {}

}

function ensureTempDirectory(
    file
) {

    const directory =
        path.dirname(
            file
        )

    if (
        !fs.existsSync(
            directory
        )
    ) {

        fs.mkdirSync(
            directory,
            {
                recursive:
                    true
            }
        )

    }

}

async function sendStickerMessage(
    sock,
    jid,
    content
) {

    if (
        typeof sock.safeSendMessage ===
        'function'
    ) {

        return await sock.safeSendMessage(
            jid,
            content
        )

    }

    return await sock.sendMessage(
        jid,
        content
    )

}

function unwrapMessageContent(
    message
) {

    let current =
        message

    for (
        let i = 0;
        i < 10;
        i++
    ) {

        if (
            !current
        ) {

            return null

        }

        if (
            current.ephemeralMessage
                ?.message
        ) {

            current =
                current.ephemeralMessage
                    .message

            continue

        }

        if (
            current.viewOnceMessage
                ?.message
        ) {

            current =
                current.viewOnceMessage
                    .message

            continue

        }

        if (
            current.viewOnceMessageV2
                ?.message
        ) {

            current =
                current.viewOnceMessageV2
                    .message

            continue

        }

        if (
            current.viewOnceMessageV2Extension
                ?.message
        ) {

            current =
                current.viewOnceMessageV2Extension
                    .message

            continue

        }

        if (
            current.documentWithCaptionMessage
                ?.message
        ) {

            current =
                current.documentWithCaptionMessage
                    .message

            continue

        }

        break

    }

    return current

}

function getContextInfo(
    msg
) {

    const message =
        unwrapMessageContent(
            msg?.message
        )

    if (
        !message
    ) {

        return null

    }

    return (
        message.extendedTextMessage
            ?.contextInfo
        ||
        message.imageMessage
            ?.contextInfo
        ||
        message.videoMessage
            ?.contextInfo
        ||
        message.documentMessage
            ?.contextInfo
        ||
        message.audioMessage
            ?.contextInfo
        ||
        message.stickerMessage
            ?.contextInfo
        ||
        null
    )

}

function getQuotedMessage(
    msg
) {

    const contextInfo =
        getContextInfo(
            msg
        )

    if (
        !contextInfo?.quotedMessage
    ) {

        return null

    }

    return unwrapMessageContent(
        contextInfo.quotedMessage
    )

}

function getMediaMessage(
    msg
) {

    const directMessage =
        unwrapMessageContent(
            msg?.message
        )

    const quotedMessage =
        getQuotedMessage(
            msg
        )

    if (
        quotedMessage?.imageMessage
    ) {

        return {
            type:
                'image',

            content:
                quotedMessage.imageMessage,

            quoted:
                true
        }

    }

    if (
        quotedMessage?.videoMessage
    ) {

        return {
            type:
                'video',

            content:
                quotedMessage.videoMessage,

            quoted:
                true
        }

    }

    if (
        directMessage?.imageMessage
    ) {

        return {
            type:
                'image',

            content:
                directMessage.imageMessage,

            quoted:
                false
        }

    }

    if (
        directMessage?.videoMessage
    ) {

        return {
            type:
                'video',

            content:
                directMessage.videoMessage,

            quoted:
                false
        }

    }

    return null

}

async function downloadMedia(
    media
) {

    const stream =
        await downloadContentFromMessage(
            media.content,
            media.type
        )

    const chunks = []

    for await (
        const chunk
        of stream
    ) {

        chunks.push(
            Buffer.from(
                chunk
            )
        )

    }

    if (
        chunks.length ===
        0
    ) {

        return null

    }

    return Buffer.concat(
        chunks
    )

}

async function convertImageToSticker(
    buffer,
    outputPath
) {

    await sharp(
        buffer
    )
        .rotate()
        .resize(
            512,
            512,
            {
                fit:
                    'contain',

                background: {
                    r: 0,
                    g: 0,
                    b: 0,
                    alpha: 0
                },

                withoutEnlargement:
                    true
            }
        )
        .webp(
            {
                quality:
                    90,

                alphaQuality:
                    100,

                effort:
                    6
            }
        )
        .toFile(
            outputPath
        )

}

async function convertVideoToSticker(
    inputPath,
    outputPath
) {

    const filter = [
        'fps=15',
        'scale=512:512:force_original_aspect_ratio=decrease',
        'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000'
    ]
        .join(',')

    await execFileAsync(
        FFMPEG_PATH,
        [
            '-y',

            '-hide_banner',

            '-loglevel',
            'error',

            '-i',
            inputPath,

            '-vf',
            filter,

            '-an',

            '-vcodec',
            'libwebp',

            '-lossless',
            '0',

            '-compression_level',
            '6',

            '-q:v',
            '70',

            '-loop',
            '0',

            '-vsync',
            '0',

            outputPath
        ],
        {
            windowsHide:
                true,

            maxBuffer:
                50 *
                1024 *
                1024
        }
    )

}

module.exports = {

    name:
        'sticker',

    aliases: [
        's',
        'stiker',
        'stick'
    ],

    description:
        'Convierte imágenes o videos en stickers',

    category:
        'general',

    async execute({

        sock,

        msg,

        from

    }) {

        let inputPath =
            null

        let outputPath =
            null

        try {

            const sender =
                normalizeJid(

                    msg.key?.participant ||

                    msg.participant ||

                    msg.key?.remoteJid

                )

            if (
                !sender
            ) {

                return await sendStickerMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.error(
                                'ERROR DE USUARIO',
                                'No pude identificar al usuario.'
                            )
                    }
                )

            }

            const botProfileId =
                getBotProfileId(
                    sock
                )

            if (
                isLimited(
                    sender,
                    'stickers',
                    botProfileId
                )
            ) {

                const left =
                    getRemainingTime(
                        sender,
                        'stickers',
                        botProfileId
                    )

                return await sendStickerMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.warn(
                                'RATE LIMIT',
                                `Demasiados stickers.\n\nEspera ${left}s.`
                            )
                    }
                )

            }

            try {

                await sock.sendPresenceUpdate(
                    'composing',
                    from
                )

            } catch {}

            const media =
                getMediaMessage(
                    msg
                )

            if (
                !media
            ) {

                return await sendStickerMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.warn(
                                'MEDIA REQUERIDA',
                                [
                                    'Responde a una imagen o video con .sticker.',
                                    '',
                                    'También puedes enviar una imagen o video con .sticker en el texto/caption.',
                                    '',
                                    'Los videos no tienen un límite de duración impuesto por KennyBot.'
                                ]
                                    .join(
                                        '\n'
                                    )
                            )
                    }
                )

            }

            logger.info(
                `${getBotName(sock)} | Sticker media detectada: tipo=${media.type} | quoted=${media.quoted}`
            )

            const buffer =
                await downloadMedia(
                    media
                )

            if (
                !buffer ||
                !Buffer.isBuffer(
                    buffer
                ) ||
                buffer.length ===
                    0
            ) {

                return await sendStickerMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.error(
                                'ERROR DE DESCARGA',
                                'No se pudo descargar la imagen o video.'
                            )
                    }
                )

            }

            if (
                isMediaTooLarge(
                    buffer.length,
                    MAX_MEDIA_MB
                )
            ) {

                return await sendStickerMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.error(
                                'ARCHIVO DEMASIADO PESADO',
                                `El archivo supera el límite de seguridad de ${MAX_MEDIA_MB} MB.`
                            )
                    }
                )

            }

            outputPath =
                generateTempFile(
                    'sticker',
                    'webp'
                )

            ensureTempDirectory(
                outputPath
            )

            if (
                media.type ===
                'image'
            ) {

                await convertImageToSticker(
                    buffer,
                    outputPath
                )

            } else {

                inputPath =
                    generateTempFile(
                        'sticker-video',
                        'mp4'
                    )

                ensureTempDirectory(
                    inputPath
                )

                fs.writeFileSync(
                    inputPath,
                    buffer
                )

                await convertVideoToSticker(
                    inputPath,
                    outputPath
                )

            }

            if (
                !fs.existsSync(
                    outputPath
                )
            ) {

                throw new Error(
                    'Sticker no generado'
                )

            }

            const stats =
                fs.statSync(
                    outputPath
                )

            if (
                !stats.size
            ) {

                throw new Error(
                    'El sticker generado está vacío'
                )

            }

            await sendStickerMessage(
                sock,
                from,
                {
                    sticker:
                        fs.readFileSync(
                            outputPath
                        )
                }
            )

            logger.event(
                `${getBotName(sock)} | Sticker enviado: ${getNumber(sender)} | ` +
                `tipo=${media.type} | ` +
                `quoted=${media.quoted} | ` +
                `entrada=${(
                    buffer.length /
                    1024 /
                    1024
                ).toFixed(2)}MB | ` +
                `salida=${(
                    stats.size /
                    1024
                ).toFixed(2)}KB`
            )

            return true

        } catch (err) {

            logger.error(
                `${getBotName(sock)} | Error sticker: ${err.stack || err.message}`
            )

            let message =
                'No se pudo crear el sticker.'

            const errorText =
                String(
                    err?.message ||
                    ''
                )
                    .toLowerCase()

            if (
                err?.code ===
                    'ENOENT' ||
                errorText.includes(
                    'ffmpeg'
                )
            ) {

                message =
                    'No se encontró FFmpeg o FFmpeg no pudo procesar el video.'

            }

            if (
                errorText.includes(
                    'libwebp'
                )
            ) {

                message =
                    'La instalación de FFmpeg no tiene soporte WebP disponible.'

            }

            try {

                await sendStickerMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.error(
                                'ERROR DE STICKER',
                                message
                            )
                    }
                )

            } catch {}

            return false

        } finally {

            safeDelete(
                inputPath
            )

            safeDelete(
                outputPath
            )

            try {

                await sock.sendPresenceUpdate(
                    'paused',
                    from
                )

            } catch {}

        }

    }

}
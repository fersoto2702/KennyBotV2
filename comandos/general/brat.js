const fs =
    require('fs')

const path =
    require('path')

const sharp =
    require('sharp')

const generateTempFile =
    require('../../src/utils/generateTempFile')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const CANVAS_SIZE =
    512

const PADDING =
    42

const MAX_TEXT_LENGTH =
    180

function escapeXml(
    text
) {

    return String(
        text || ''
    )
        .replace(
            /&/g,
            '&amp;'
        )
        .replace(
            /</g,
            '&lt;'
        )
        .replace(
            />/g,
            '&gt;'
        )
        .replace(
            /"/g,
            '&quot;'
        )
        .replace(
            /'/g,
            '&apos;'
        )

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

function getBotName(
    sock
) {

    return String(
        sock?.botProfile?.name ||
        'KennyBot'
    )
        .trim()

}

async function sendMessage(
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

function normalizeText(
    text
) {

    return String(
        text || ''
    )
        .replace(
            /\s+/g,
            ' '
        )
        .trim()

}

function getFontSize(
    text
) {

    const length =
        text.length

    if (
        length <= 12
    ) {

        return 108

    }

    if (
        length <= 24
    ) {

        return 84

    }

    if (
        length <= 45
    ) {

        return 66

    }

    if (
        length <= 75
    ) {

        return 52

    }

    if (
        length <= 110
    ) {

        return 43

    }

    return 36

}

function wrapText(
    text,
    fontSize
) {

    const availableWidth =
        CANVAS_SIZE -
        (
            PADDING *
            2
        )

    const approximateCharacterWidth =
        fontSize *
        0.54

    const maxCharsPerLine =
        Math.max(
            4,
            Math.floor(
                availableWidth /
                approximateCharacterWidth
            )
        )

    const words =
        text.split(
            /\s+/
        )

    const lines = []

    let current =
        ''

    for (
        const word
        of words
    ) {

        const candidate =
            current
                ? `${current} ${word}`
                : word

        if (
            candidate.length <=
            maxCharsPerLine
        ) {

            current =
                candidate

            continue

        }

        if (
            current
        ) {

            lines.push(
                current
            )

        }

        if (
            word.length <=
            maxCharsPerLine
        ) {

            current =
                word

            continue

        }

        let remaining =
            word

        while (
            remaining.length >
            maxCharsPerLine
        ) {

            lines.push(
                remaining.slice(
                    0,
                    maxCharsPerLine
                )
            )

            remaining =
                remaining.slice(
                    maxCharsPerLine
                )

        }

        current =
            remaining

    }

    if (
        current
    ) {

        lines.push(
            current
        )

    }

    return lines

}

function createSvg(
    text
) {

    let fontSize =
        getFontSize(
            text
        )

    let lines =
        wrapText(
            text,
            fontSize
        )

    while (
        lines.length > 7 &&
        fontSize > 28
    ) {

        fontSize -=
            2

        lines =
            wrapText(
                text,
                fontSize
            )

    }

    const lineHeight =
        Math.round(
            fontSize *
            1.02
        )

    const totalHeight =
        lines.length *
        lineHeight

    const startY =
        (
            CANVAS_SIZE -
            totalHeight
        ) /
        2 +
        (
            fontSize *
            0.82
        )

    const textElements =
        lines
            .map(
                (
                    line,
                    index
                ) => {

                    const y =
                        startY +
                        (
                            index *
                            lineHeight
                        )

                    return `
                        <text
                            x="256"
                            y="${y}"
                            text-anchor="middle"
                            font-family="Arial, Helvetica, sans-serif"
                            font-size="${fontSize}"
                            font-weight="400"
                            fill="#000000"
                        >${escapeXml(line)}</text>
                    `

                }
            )
            .join(
                ''
            )

    return Buffer.from(
        `
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="${CANVAS_SIZE}"
            height="${CANVAS_SIZE}"
            viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}"
        >
            <rect
                width="100%"
                height="100%"
                fill="#ffffff"
            />

            ${textElements}
        </svg>
        `
    )

}

module.exports = {

    name:
        'brat',

    aliases: [
        'bratsticker',
        'bsticker'
    ],

    description:
        'Genera un sticker de texto negro con fondo blanco',

    category:
        'general',

    async execute({
        sock,
        from,
        args
    }) {

        let outputPath =
            null

        try {

            const text =
                normalizeText(
                    Array.isArray(
                        args
                    )
                        ? args.join(
                            ' '
                        )
                        : args
                )

            if (
                !text
            ) {

                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.warn(
                                'TEXTO REQUERIDO',
                                [
                                    'Escribe el texto que quieres convertir en sticker.',
                                    '',
                                    'Ejemplo:',
                                    '.brat hola mundo'
                                ]
                                    .join(
                                        '\n'
                                    )
                            )
                    }
                )

            }

            if (
                text.length >
                MAX_TEXT_LENGTH
            ) {

                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.warn(
                                'TEXTO DEMASIADO LARGO',
                                `El texto puede tener hasta ${MAX_TEXT_LENGTH} caracteres.`
                            )
                    }
                )

            }

            outputPath =
                generateTempFile(
                    'brat',
                    'webp'
                )

            ensureTempDirectory(
                outputPath
            )

            const svg =
                createSvg(
                    text
                )

            await sharp(
                svg
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

            if (
                !fs.existsSync(
                    outputPath
                )
            ) {

                throw new Error(
                    'No se generó el sticker'
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

            await sendMessage(
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
                `${getBotName(sock)} | Brat generado | ${text.slice(0, 60)}`
            )

            return true

        } catch (err) {

            logger.error(
                `${getBotName(sock)} | Error brat: ${err.stack || err.message}`
            )

            try {

                await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.error(
                                'ERROR DE BRAT',
                                'No se pudo generar el sticker.'
                            )
                    }
                )

            } catch {}

            return false

        } finally {

            safeDelete(
                outputPath
            )

        }

    }

}
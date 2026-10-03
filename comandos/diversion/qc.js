const sharp =
    require('sharp')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


/* ─────────────────────────────
   ESCAPAR TEXTO PARA SVG
───────────────────────────── */

function escapeXml(text = '') {

    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')

}


/* ─────────────────────────────
   DIVIDIR TEXTO EN LÍNEAS
───────────────────────────── */

function wrapText(
    text,
    maxLength = 24
) {

    const words =
        String(text)
            .trim()
            .split(/\s+/)

    const lines = []

    let current = ''

    for (const word of words) {

        const next =
            current
                ? `${current} ${word}`
                : word

        if (
            next.length > maxLength &&
            current
        ) {

            lines.push(current)

            current = word

        } else {

            current = next

        }

    }

    if (current) {
        lines.push(current)
    }

    return lines.slice(0, 8)

}


/* ─────────────────────────────
   OBTENER TEXTO DEL MENSAJE
───────────────────────────── */

function getQuotedText(quoted) {

    if (!quoted)
        return null


    if (
        typeof quoted.conversation === 'string'
    ) {

        return quoted.conversation

    }


    if (
        quoted.extendedTextMessage?.text
    ) {

        return quoted.extendedTextMessage.text

    }


    if (
        quoted.imageMessage?.caption
    ) {

        return quoted.imageMessage.caption

    }


    if (
        quoted.videoMessage?.caption
    ) {

        return quoted.videoMessage.caption

    }


    if (
        quoted.documentMessage?.caption
    ) {

        return quoted.documentMessage.caption

    }


    return null

}


/* ─────────────────────────────
   CREAR STICKER
───────────────────────────── */

async function createQuoteSticker({

    text,
    author

}) {

    const WIDTH = 512
    const HEIGHT = 512

    const cleanText =
        String(text)
            .replace(/\s+/g, ' ')
            .trim()

    const limitedText =
        cleanText.length > 300
            ? `${cleanText.slice(0, 297)}...`
            : cleanText


    let lines =
        wrapText(
            limitedText,
            26
        )


    /*
        Ajustamos el tamaño dependiendo
        de cuánto texto tenga la cita.
    */

    let fontSize = 38

    if (limitedText.length > 80)
        fontSize = 34

    if (limitedText.length > 140)
        fontSize = 29

    if (limitedText.length > 220)
        fontSize = 25


    lines =
        wrapText(
            limitedText,
            fontSize >= 34
                ? 24
                : 31
        )


    const lineHeight =
        fontSize + 12


    const totalTextHeight =
        lines.length *
        lineHeight


    const startY =
        Math.max(
            140,
            (HEIGHT - totalTextHeight) / 2
        )


    const textSvg =
        lines
            .map(
                (line, index) => {

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
                            font-family="Arial, sans-serif"
                            font-size="${fontSize}"
                            font-weight="600"
                            fill="#FFFFFF"
                        >
                            ${escapeXml(line)}
                        </text>
                    `

                }
            )
            .join('\n')


    const svg = `

        <svg
            width="${WIDTH}"
            height="${HEIGHT}"
            viewBox="0 0 ${WIDTH} ${HEIGHT}"
            xmlns="http://www.w3.org/2000/svg"
        >

            <!-- Fondo -->

            <rect
                width="512"
                height="512"
                rx="45"
                fill="#111111"
            />


            <!-- Decoración -->

            <circle
                cx="256"
                cy="82"
                r="42"
                fill="#252525"
            />

            <text
                x="256"
                y="98"
                text-anchor="middle"
                font-family="Arial, sans-serif"
                font-size="48"
                fill="#FFFFFF"
            >
                “
            </text>


            <!-- Cita -->

            ${textSvg}


            <!-- Autor -->

            <text
                x="256"
                y="455"
                text-anchor="middle"
                font-family="Arial, sans-serif"
                font-size="24"
                font-weight="700"
                fill="#D5D5D5"
            >
                — ${escapeXml(author)}
            </text>

        </svg>

    `


    return await sharp(
        Buffer.from(svg)
    )
        .resize(
            512,
            512,
            {
                fit: 'contain'
            }
        )
        .webp({
            quality: 90
        })
        .toBuffer()

}


/* ─────────────────────────────
   COMANDO
───────────────────────────── */

module.exports = {

    name:
        'qc',

    aliases: [
        'quote',
        'cita'
    ],

    description:
        'Convierte un mensaje respondido en sticker',

    category:
        'diversion',

    cooldown:
        3,


    async execute({

        sock,
        from,
        msg

    }) {

        try {

            /* ─────────────────────────────
               CONTEXTO DEL MENSAJE
            ───────────────────────────── */

            const contextInfo =

                msg.message
                    ?.extendedTextMessage
                    ?.contextInfo


            const quoted =
                contextInfo
                    ?.quotedMessage


            /* ─────────────────────────────
               VALIDAR RESPUESTA
            ───────────────────────────── */

            if (!quoted) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'MENSAJE REQUERIDO',

                                'Responde a un mensaje de texto y usa /qc'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               EXTRAER TEXTO
            ───────────────────────────── */

            const quoteText =
                getQuotedText(quoted)


            if (!quoteText) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'NO COMPATIBLE',

                                'El mensaje respondido no contiene texto para convertir en sticker.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               AUTOR DEL MENSAJE
            ───────────────────────────── */

            const authorJid =

                contextInfo.participant ||

                contextInfo.remoteJid ||

                from


            const authorNumber =

                authorJid
                    .split('@')[0]


            const author =
                `@${authorNumber}`


            /* ─────────────────────────────
               GENERAR STICKER
            ───────────────────────────── */

            const sticker =
                await createQuoteSticker({

                    text:
                        quoteText,

                    author

                })


            /* ─────────────────────────────
               ENVIAR STICKER
            ───────────────────────────── */

            await sock.sendMessage(

                from,

                {

                    sticker

                },

                {

                    quoted:
                        msg

                }

            )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `QC generado: ${authorNumber}`

            )


        } catch (err) {

            logger.error(

                `Error qc: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR QC',

                                'No se pudo convertir el mensaje en sticker.'

                            )

                    }

                )

            } catch {}

        }

    }

}
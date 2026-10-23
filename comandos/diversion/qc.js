const axios = require('axios')
const sharp = require('sharp')

const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')

function jidToNumber(jid = '') {
    return String(jid).split('@')[0].split(':')[0]
}

function getTextFromMessage(message) {
    if (!message) return ''

    if (message.conversation)
        return message.conversation

    if (message.extendedTextMessage?.text)
        return message.extendedTextMessage.text

    if (message.imageMessage?.caption)
        return message.imageMessage.caption

    if (message.videoMessage?.caption)
        return message.videoMessage.caption

    if (message.documentMessage?.caption)
        return message.documentMessage.caption

    if (message.buttonsResponseMessage?.selectedDisplayText)
        return message.buttonsResponseMessage.selectedDisplayText

    if (message.listResponseMessage?.title)
        return message.listResponseMessage.title

    return ''
}

async function getProfilePhotoUrl(sock, jid) {
    try {
        return await sock.profilePictureUrl(jid, 'image')
    } catch {
        return 'https://i.ibb.co/4pDNDk1/avatar-contact.png'
    }
}

async function generateQuoteSticker({
    sock,
    authorJid,
    authorName,
    text,
    replyName,
    replyText
}) {
    const avatarUrl = await getProfilePhotoUrl(sock, authorJid)

    const payload = {
        type: 'quote',
        format: 'png',
        backgroundColor: '#0b141a',
        width: 512,
        height: 768,
        scale: 2,
        messages: [
            {
                entities: [],
                avatar: true,
                from: {
                    id: 1,
                    name: authorName,
                    photo: {
                        url: avatarUrl
                    }
                },
                text,
                replyMessage:
                    replyText
                        ? {
                            name: replyName || 'Mensaje',
                            text: replyText
                        }
                        : undefined
            }
        ]
    }

    const response = await axios.post(
        'https://bot.lyo.su/quote/generate',
        payload,
        {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000
        }
    )

    if (!response.data?.result?.image) {
        throw new Error('La API de quote no devolvió imagen')
    }

    const imageBuffer =
        Buffer.from(
            response.data.result.image,
            'base64'
        )

    const stickerBuffer =
        await sharp(imageBuffer)
            .webp({
                quality: 95
            })
            .toBuffer()

    return stickerBuffer
}

module.exports = {

    name: 'qc',

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
        msg
    }) {

        try {

            const contextInfo =
                msg.message
                    ?.extendedTextMessage
                    ?.contextInfo

            const quoted =
                contextInfo
                    ?.quotedMessage

            if (!quoted) {

                return await sock.sendMessage(
                    from,
                    {
                        text:
                            ui.warn(
                                'MENSAJE REQUERIDO',
                                'Responde a un mensaje y usa /qc'
                            )
                    }
                )

            }

            const quoteText =
                getTextFromMessage(quoted)

            if (!quoteText) {

                return await sock.sendMessage(
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
                contextInfo.participant ||
                msg.participant ||
                msg.key.participant ||
                msg.key.remoteJid

            const sender =
                msg.key.participant ||
                msg.participant ||
                msg.key.remoteJid

            let authorName =
                jidToNumber(quotedAuthor)

            /*
                Si el mensaje citado lo mandó quien ejecutó el comando,
                usamos "Tú" como nombre.
            */
            if (quotedAuthor === sender) {
                authorName = 'Tú'
            }

            /*
                Detectar si el mensaje citado era respuesta a otro mensaje
                para mostrar la mini-cita verde.
            */
            const nestedContext =
                quoted.extendedTextMessage
                    ?.contextInfo

            const nestedQuoted =
                nestedContext
                    ?.quotedMessage

            const nestedText =
                getTextFromMessage(nestedQuoted)

            let replyName = null
            let replyText = null

            if (nestedQuoted && nestedText) {

                const nestedParticipant =
                    nestedContext.participant

                replyText = nestedText

                if (
                    nestedParticipant &&
                    nestedParticipant === sender
                ) {
                    replyName = 'Tú'
                } else if (nestedParticipant) {
                    replyName = jidToNumber(nestedParticipant)
                } else {
                    replyName = 'Mensaje'
                }
            }

            const stickerBuffer =
                await generateQuoteSticker({
                    sock,
                    authorJid: quotedAuthor,
                    authorName,
                    text: quoteText,
                    replyName,
                    replyText
                })

            await sock.sendMessage(
                from,
                {
                    sticker: stickerBuffer
                },
                {
                    quoted: msg
                }
            )

            logger.event(
                `QC usado: ${jidToNumber(quotedAuthor)}`
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
                                'ERROR',
                                'No se pudo generar el sticker de cita.'
                            )
                    }
                )

            } catch {}
        }

    }

}
const fs = require('fs')
const path = require('path')
const { downloadContentFromMessage } = require('@whiskeysockets/baileys')

const isGroupAdmin =
    require('../../src/utils/isAdmin')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const iconPath =
    path.join(
        __dirname,
        '../../assets/icons/hidetag.jpeg'
    )

const MAX_MENTIONS = 200
const MAX_MEDIA_MB = 15

const getSizeMB = bytes =>
    (bytes / 1024 / 1024).toFixed(2)

async function downloadMedia(
    message,
    type
) {

    const stream =
        await downloadContentFromMessage(
            message,
            type
        )

    let buffer =
        Buffer.from([])

    for await (const chunk of stream) {

        buffer =
            Buffer.concat([
                buffer,
                chunk
            ])

        if (
            buffer.length /
            1024 /
            1024 >
            MAX_MEDIA_MB
        ) {

            throw new Error(
                `Media demasiado pesada (${getSizeMB(buffer.length)}MB)`
            )

        }

    }

    return buffer

}

async function sendSuccess(
    sock,
    from,
    mentionsCount
) {

    try {

        await sock.safeSendMessage(
            from,
            {
                text:
                    ui.success(
                        'HIDETAG EJECUTADO',
                        [
                            [
                                'Usuarios',
                                `${mentionsCount}`
                            ]
                        ]
                    )
            }
        )

    } catch {}

}

module.exports = {

    name: 'hidetag',

    aliases: [

        'htag',
        'ghosttag',
        'tag'

    ],

    description:
        'Menciona a todos sin mostrar etiquetas visibles',

    category:
        'grupos',

    adminOnly: true,

    groupOnly: true,

    async execute({

        sock,
        from,
        args,
        msg

    }) {

        try {

            await sock.sendPresenceUpdate(
                'composing',
                from
            )

            const sender =
                msg.key.participant ||
                msg.participant

            const admin =
                await isGroupAdmin(
                    sock,
                    from,
                    sender
                )

            if (!admin) {

                return await sock.safeSendMessage(
                    from,
                    {
                        image:
                            fs.readFileSync(iconPath),

                        caption:
                            ui.error(
                                'ACCESO DENEGADO',
                                'Solo administradores pueden usar este comando.'
                            )
                    }
                )

            }

            const metadata =
                await sock.groupMetadata(
                    from
                )

            const participants =
                metadata.participants || []

            if (
                participants.length === 0
            ) {

                return await sock.safeSendMessage(
                    from,
                    {
                        image:
                            fs.readFileSync(iconPath),

                        caption:
                            ui.warn(
                                'GRUPO VACÍO',
                                'No hay participantes para mencionar.'
                            )
                    }
                )

            }

            const mentions =
                participants
                    .slice(
                        0,
                        MAX_MENTIONS
                    )
                    .map(
                        p => p.id
                    )

            const quoted =
                msg.message
                    ?.extendedTextMessage
                    ?.contextInfo
                    ?.quotedMessage

            if (
                quoted?.imageMessage
            ) {

                await sendSuccess(
                    sock,
                    from,
                    mentions.length
                )

                const buffer =
                    await downloadMedia(
                        quoted.imageMessage,
                        'image'
                    )

                return await sock.safeSendMessage(
                    from,
                    {
                        image: buffer,
                        mentions
                    }
                )

            }

            if (
                quoted?.videoMessage
            ) {

                await sendSuccess(
                    sock,
                    from,
                    mentions.length
                )

                const buffer =
                    await downloadMedia(
                        quoted.videoMessage,
                        'video'
                    )

                return await sock.safeSendMessage(
                    from,
                    {
                        video: buffer,
                        mentions
                    }
                )

            }

            if (
                quoted?.audioMessage
            ) {

                await sendSuccess(
                    sock,
                    from,
                    mentions.length
                )

                const buffer =
                    await downloadMedia(
                        quoted.audioMessage,
                        'audio'
                    )

                return await sock.safeSendMessage(
                    from,
                    {
                        audio: buffer,
                        mimetype:
                            'audio/mpeg',
                        ptt: false,
                        mentions
                    }
                )

            }

            if (
                quoted?.stickerMessage
            ) {

                await sendSuccess(
                    sock,
                    from,
                    mentions.length
                )

                const buffer =
                    await downloadMedia(
                        quoted.stickerMessage,
                        'sticker'
                    )

                return await sock.safeSendMessage(
                    from,
                    {
                        sticker: buffer,
                        mentions
                    }
                )

            }

            if (
                quoted?.extendedTextMessage
                    ?.text
            ) {

                await sendSuccess(
                    sock,
                    from,
                    mentions.length
                )

                return await sock.safeSendMessage(
                    from,
                    {
                        text:
                            quoted
                                .extendedTextMessage
                                .text,

                        mentions
                    }
                )

            }

            if (
                quoted?.conversation
            ) {

                await sendSuccess(
                    sock,
                    from,
                    mentions.length
                )

                return await sock.safeSendMessage(
                    from,
                    {
                        text:
                            quoted.conversation,

                        mentions
                    }
                )

            }

            const text =
                args.join(' ')
                    .trim()

            if (!text) {

                return await sock.safeSendMessage(
                    from,
                    {
                        image:
                            fs.readFileSync(iconPath),

                        caption:
                            ui.warn(
                                'MENSAJE REQUERIDO',
                                'Uso: /hidetag mensaje'
                            )
                    }
                )

            }

            await sendSuccess(
                sock,
                from,
                mentions.length
            )

            await sock.safeSendMessage(
                from,
                {
                    text,
                    mentions
                }
            )

            logger.event(
                `Hidetag usado: ${from.split('@')[0]}`
            )

        } catch (err) {

            logger.error(
                `Error hidetag: ${err.message}`
            )

            try {

                await sock.safeSendMessage(
                    from,
                    {
                        image:
                            fs.readFileSync(iconPath),

                        caption:
                            ui.error(
                                'ERROR',
                                'No se pudo ejecutar el hidetag.'
                            )
                    }
                )

            } catch {}

        }

    }

}
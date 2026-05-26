const {

    downloadContentFromMessage

} = require('baileys')

const isGroupAdmin =
    require('../../src/utils/isAdmin')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

// =========================
// CONFIG
// =========================

const MAX_MENTIONS = 200

const MAX_MEDIA_MB = 15

// =========================
// FORMAT SIZE
// =========================

const getSizeMB = bytes =>

    (
        bytes /
        1024 /
        1024
    ).toFixed(2)

// =========================
// DOWNLOAD MEDIA
// =========================

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

    for await (

        const chunk of stream

    ) {

        buffer =

            Buffer.concat([

                buffer,
                chunk

            ])

        // =========================
        // LIMIT
        // =========================

        const sizeMB =

            buffer.length /
            1024 /
            1024

        if (
            sizeMB > MAX_MEDIA_MB
        ) {

            throw new Error(
                `Media demasiado pesada (${getSizeMB(buffer.length)}MB)`
            )

        }

    }

    return buffer

}

module.exports = {

    name:
        'hidetag',

    aliases: [

        'htag',
        'ghosttag'

    ],

    description:
        'Menciona a todos sin mostrar etiquetas visibles',

    category:
        'grupos',

    adminOnly: true,

    groupOnly: true,

    cooldown: 15,

    async execute({

        sock,
        from,
        args,
        msg

    }) {

        try {

            // =========================
            // GROUP
            // =========================

            if (
                !from.endsWith('@g.us')
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'SOLO GRUPOS',

                                'Este comando solo funciona en grupos.'

                            )

                    }

                )

            }

            // =========================
            // TYPING
            // =========================

            await sock.sendPresenceUpdate(

                'composing',
                from

            )

            // =========================
            // ADMIN
            // =========================

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

                        text:
                            ui.error(

                                'ACCESO DENEGADO',

                                'Solo administradores pueden usar este comando.'

                            )

                    }

                )

            }

            // =========================
            // METADATA
            // =========================

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

                        text:
                            ui.warn(

                                'GRUPO VACÍO',

                                'No hay participantes para mencionar.'

                            )

                    }

                )

            }

            // =========================
            // LIMIT
            // =========================

            const mentions =

                participants

                    .slice(0, MAX_MENTIONS)

                    .map(
                        p => p.id
                    )

            // =========================
            // QUOTED
            // =========================

            const quoted =

                msg.message
                    ?.extendedTextMessage
                    ?.contextInfo
                    ?.quotedMessage

            // =========================
            // IMAGE
            // =========================

            if (
                quoted?.imageMessage
            ) {

                const buffer =

                    await downloadMedia(

                        quoted.imageMessage,

                        'image'

                    )

                return await sock.safeSendMessage(

                    from,

                    {

                        image:
                            buffer,

                        mentions

                    }

                )

            }

            // =========================
            // VIDEO
            // =========================

            if (
                quoted?.videoMessage
            ) {

                const buffer =

                    await downloadMedia(

                        quoted.videoMessage,

                        'video'

                    )

                return await sock.safeSendMessage(

                    from,

                    {

                        video:
                            buffer,

                        mentions

                    }

                )

            }

            // =========================
            // AUDIO
            // =========================

            if (
                quoted?.audioMessage
            ) {

                const buffer =

                    await downloadMedia(

                        quoted.audioMessage,

                        'audio'

                    )

                return await sock.safeSendMessage(

                    from,

                    {

                        audio:
                            buffer,

                        mimetype:
                            'audio/mpeg',

                        ptt:
                            false,

                        mentions

                    }

                )

            }

            // =========================
            // STICKER
            // =========================

            if (
                quoted?.stickerMessage
            ) {

                const buffer =

                    await downloadMedia(

                        quoted.stickerMessage,

                        'sticker'

                    )

                return await sock.safeSendMessage(

                    from,

                    {

                        sticker:
                            buffer,

                        mentions

                    }

                )

            }

            // =========================
            // QUOTED TEXT
            // =========================

            if (
                quoted?.conversation
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            quoted.conversation,

                        mentions

                    }

                )

            }

            // =========================
            // NORMAL TEXT
            // =========================

            const text =

                args.join(' ')
                    .trim()

            if (!text) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'MENSAJE REQUERIDO',

                                'Uso: /hidetag mensaje'

                            )

                    }

                )

            }

            // =========================
            // SEND
            // =========================

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

                        text:
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
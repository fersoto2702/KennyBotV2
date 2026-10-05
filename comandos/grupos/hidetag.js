const {
    downloadContentFromMessage
} = require('@whiskeysockets/baileys')

const isGroupAdmin =
    require('../../src/utils/isAdmin')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


const MAX_MENTIONS =
    1000

const MAX_MEDIA_MB =
    15


const getSizeMB = bytes =>
    (
        bytes /
        1024 /
        1024
    ).toFixed(2)


function normalizeJid(participant) {

    if (!participant)
        return null

    return (
        participant.phoneNumber ||
        participant.id ||
        null
    )

}


function uniqueJids(jids = []) {

    return [
        ...new Set(
            jids.filter(Boolean)
        )
    ]

}


async function downloadMedia(
    message,
    type
) {

    const stream =
        await downloadContentFromMessage(
            message,
            type
        )


    const chunks = []

    let totalBytes =
        0


    for await (
        const chunk of stream
    ) {

        totalBytes +=
            chunk.length


        if (
            totalBytes /
            1024 /
            1024 >
            MAX_MEDIA_MB
        ) {

            throw new Error(
                `Media demasiado pesada (${getSizeMB(totalBytes)}MB)`
            )

        }


        chunks.push(
            chunk
        )

    }


    return Buffer.concat(
        chunks
    )

}


async function logAndSend({
    sock,
    from,
    payload,
    sender,
    mentionsCount,
    type
}) {

    await sock.safeSendMessage(
        from,
        payload
    )


    logger.event(
        `Hidetag usado en ${from.split('@')[0]} por ${sender.split('@')[0]} | ${mentionsCount} menciones | ${type}`
    )

}


module.exports = {

    name:
        'hidetag',

    aliases: [
        'htag',
        'ghosttag',
        'tag'
    ],

    description:
        'Menciona a todos sin mostrar etiquetas visibles',

    category:
        'grupos',

    adminOnly:
        true,

    groupOnly:
        true,

    cooldown:
        5,


    async execute({

        sock,
        from,
        args,
        msg

    }) {

        try {

            /* ─────────────────────────────
               SOLO GRUPOS
            ───────────────────────────── */

            if (
                !from ||
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


            /* ─────────────────────────────
               PRESENCIA
            ───────────────────────────── */

            try {

                await sock.sendPresenceUpdate(
                    'composing',
                    from
                )

            } catch {}


            /* ─────────────────────────────
               USUARIO
            ───────────────────────────── */

            const sender =

                msg.key.participant ||

                msg.participant ||

                msg.key.remoteJid


            if (!sender) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE USUARIO',

                                'No se pudo identificar al usuario que ejecutó el comando.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               VERIFICAR ADMIN
            ───────────────────────────── */

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


            /* ─────────────────────────────
               PARTICIPANTES
            ───────────────────────────── */

            const metadata =
                await sock.groupMetadata(
                    from
                )


            const participants =
                Array.isArray(
                    metadata?.participants
                )
                    ? metadata.participants
                    : []


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


            const mentions =
                uniqueJids(

                    participants
                        .slice(
                            0,
                            MAX_MENTIONS
                        )
                        .map(
                            participant =>
                                normalizeJid(
                                    participant
                                )
                        )

                )


            if (
                mentions.length === 0
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'SIN MENCIONES',

                                'No se pudieron obtener identificadores válidos de los participantes.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               MENSAJE RESPONDIDO
            ───────────────────────────── */

            const contextInfo =

                msg.message
                    ?.extendedTextMessage
                    ?.contextInfo


            const quoted =
                contextInfo
                    ?.quotedMessage


            /* ─────────────────────────────
               IMAGEN
            ───────────────────────────── */

            if (
                quoted?.imageMessage
            ) {

                const buffer =
                    await downloadMedia(

                        quoted.imageMessage,

                        'image'

                    )


                const caption =

                    quoted.imageMessage
                        ?.caption ||
                    ''


                return await logAndSend({

                    sock,
                    from,
                    sender,
                    mentionsCount:
                        mentions.length,
                    type:
                        'imagen',

                    payload: {

                        image:
                            buffer,

                        caption,

                        mentions

                    }

                })

            }


            /* ─────────────────────────────
               VIDEO
            ───────────────────────────── */

            if (
                quoted?.videoMessage
            ) {

                const buffer =
                    await downloadMedia(

                        quoted.videoMessage,

                        'video'

                    )


                const caption =

                    quoted.videoMessage
                        ?.caption ||
                    ''


                return await logAndSend({

                    sock,
                    from,
                    sender,
                    mentionsCount:
                        mentions.length,
                    type:
                        'video',

                    payload: {

                        video:
                            buffer,

                        caption,

                        mimetype:
                            quoted.videoMessage
                                ?.mimetype ||
                            'video/mp4',

                        mentions

                    }

                })

            }


            /* ─────────────────────────────
               AUDIO
            ───────────────────────────── */

            if (
                quoted?.audioMessage
            ) {

                const buffer =
                    await downloadMedia(

                        quoted.audioMessage,

                        'audio'

                    )


                return await logAndSend({

                    sock,
                    from,
                    sender,
                    mentionsCount:
                        mentions.length,
                    type:
                        'audio',

                    payload: {

                        audio:
                            buffer,

                        mimetype:
                            quoted.audioMessage
                                ?.mimetype ||
                            'audio/mpeg',

                        ptt:
                            Boolean(
                                quoted.audioMessage
                                    ?.ptt
                            ),

                        mentions

                    }

                })

            }


            /* ─────────────────────────────
               STICKER
            ───────────────────────────── */

            if (
                quoted?.stickerMessage
            ) {

                const buffer =
                    await downloadMedia(

                        quoted.stickerMessage,

                        'sticker'

                    )


                return await logAndSend({

                    sock,
                    from,
                    sender,
                    mentionsCount:
                        mentions.length,
                    type:
                        'sticker',

                    payload: {

                        sticker:
                            buffer,

                        mentions

                    }

                })

            }


            /* ─────────────────────────────
               TEXTO RESPONDIDO
            ───────────────────────────── */

            const quotedText =

                quoted
                    ?.extendedTextMessage
                    ?.text ||

                quoted
                    ?.conversation ||

                null


            if (
                quotedText
            ) {

                return await logAndSend({

                    sock,
                    from,
                    sender,
                    mentionsCount:
                        mentions.length,
                    type:
                        'texto citado',

                    payload: {

                        text:
                            quotedText,

                        mentions

                    }

                })

            }


            /* ─────────────────────────────
               TEXTO DIRECTO
            ───────────────────────────── */

            const text =
                args
                    .join(' ')
                    .trim()


            if (!text) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'MENSAJE REQUERIDO',

                                'Escribe un mensaje o responde a texto, imagen, video, audio o sticker.\n\nUso: /hidetag mensaje'

                            )

                    }

                )

            }


            return await logAndSend({

                sock,
                from,
                sender,
                mentionsCount:
                    mentions.length,
                type:
                    'texto',

                payload: {

                    text,

                    mentions

                }

            })


        } catch (err) {

            logger.error(

                `Error hidetag: ${err.stack || err.message}`

            )


            let detail =
                'No se pudo ejecutar el hidetag.'


            if (
                String(
                    err.message
                ).includes(
                    'Media demasiado pesada'
                )
            ) {

                detail =
                    `El archivo supera el límite permitido de ${MAX_MEDIA_MB} MB.`

            }


            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR HIDETAG',

                                detail

                            )

                    }

                )

            } catch {}

        }

    }

}
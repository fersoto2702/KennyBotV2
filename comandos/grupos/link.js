const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const isGroupAdmin =
    require('../../src/utils/isAdmin')

const isBotAdmin =
    require('../../src/helpers/isBotAdmin')


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


async function getGroupPhoto(
    sock,
    groupJid
) {

    try {

        if (
            typeof sock.profilePictureUrl !==
            'function'
        ) {

            return null

        }

        const url =
            await sock.profilePictureUrl(
                groupJid,
                'image'
            )

        if (
            typeof url !==
                'string' ||
            !url.trim()
        ) {

            return null

        }

        return url.trim()

    } catch {

        return null

    }

}


module.exports = {

    name:
        'link',

    aliases: [
        'grouplink',
        'linkgroup'
    ],

    description:
        'Muestra el enlace de invitación del grupo',

    category:
        'grupos',

    groupOnly:
        true,

    adminOnly:
        true,


    async execute({

        sock,
        from,
        msg

    }) {

        try {

            const groupJid =
                normalizeJid(
                    from
                )


            if (
                !groupJid ||
                !groupJid.endsWith(
                    '@g.us'
                )
            ) {

                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.warn(
                                'SOLO GRUPOS',
                                'Este comando solo puede utilizarse dentro de un grupo.'
                            )
                    }
                )

            }


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


            if (
                !sender
            ) {

                return await sendMessage(
                    sock,
                    groupJid,
                    {
                        text:
                            ui.error(
                                'ERROR',
                                'No se pudo identificar al usuario.'
                            )
                    }
                )

            }


            const admin =
                await isGroupAdmin(
                    sock,
                    groupJid,
                    sender
                )


            if (
                !admin
            ) {

                return await sendMessage(
                    sock,
                    groupJid,
                    {
                        text:
                            ui.warn(
                                'SOLO ADMINISTRADORES',
                                'Solo los administradores del grupo pueden usar este comando.'
                            )
                    }
                )

            }


            const botAdmin =
                await isBotAdmin(
                    sock,
                    groupJid
                )


            if (
                !botAdmin
            ) {

                return await sendMessage(
                    sock,
                    groupJid,
                    {
                        text:
                            ui.error(
                                'PERMISOS INSUFICIENTES',
                                'Necesito ser administrador del grupo para obtener el enlace de invitación.'
                            )
                    }
                )

            }


            const [
                code,
                metadata,
                groupPhoto
            ] =
                await Promise.all([
                    sock.groupInviteCode(
                        groupJid
                    ),

                    sock.groupMetadata(
                        groupJid
                    ),

                    getGroupPhoto(
                        sock,
                        groupJid
                    )
                ])


            if (
                !code
            ) {

                throw new Error(
                    'No se recibió un código de invitación'
                )

            }


            const link =
                `https://chat.whatsapp.com/${code}`


            const groupName =
                String(
                    metadata?.subject ||
                    'Grupo'
                )


            const members =
                Array.isArray(
                    metadata?.participants
                )
                    ? metadata.participants.length
                    : 0


            const botName =
                getBotName(
                    sock
                )


            const caption =
                [
                    'ㅤ۟∩　ׅ　🔗　ׅ　*ENLACE DEL GRUPO*　ׄᰙ',
                    '',
                    `𖣣ֶㅤ֯⌗ ✦  ׄ ⬭ *Grupo:* ${groupName}`,
                    `𖣣ֶㅤ֯⌗ ❖  ׄ ⬭ *Miembros:* ${members}`,
                    `𖣣ֶㅤ֯⌗ ♛  ׄ ⬭ *Link:* ${link}`,
                    '',
                    '╰─ 𓂃 Comparte este enlace únicamente con personas de confianza.',
                    '',
                    `— ${botName}`
                ]
                    .join(
                        '\n'
                    )


            if (
                groupPhoto
            ) {

                await sendMessage(
                    sock,
                    groupJid,
                    {
                        image: {
                            url:
                                groupPhoto
                        },

                        caption
                    }
                )

            } else {

                await sendMessage(
                    sock,
                    groupJid,
                    {
                        text:
                            caption
                    }
                )

            }


            logger.event(
                `${botName} | Link generado: ${groupName}`
            )


            return true


        } catch (err) {

            logger.error(
                `Error link: ${err.stack || err.message}`
            )


            try {

                await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.error(
                                'ERROR DE ENLACE',
                                'No se pudo obtener el enlace del grupo.'
                            )
                    }
                )

            } catch {}


            return false

        }

    }

}
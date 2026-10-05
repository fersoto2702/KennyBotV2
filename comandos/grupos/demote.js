const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const {
    jidNormalizedUser
} = require('@whiskeysockets/baileys')


function normalizeJid(
    jid
) {

    if (!jid) {

        return null

    }


    try {

        return jidNormalizedUser(
            jid
        )

    } catch {

        return jid

    }

}


function isAdministrator(
    participant
) {

    return (

        participant?.admin === 'admin' ||

        participant?.admin === 'superadmin'

    )

}


function findParticipant(
    participants,
    jid
) {

    const normalized =
        normalizeJid(
            jid
        )


    return participants.find(

        participant => {

            const participantJid =
                normalizeJid(
                    participant?.phoneNumber ||
                    participant?.id
                )


            return (
                participantJid &&
                participantJid === normalized
            )

        }

    )

}


function getMentionedJids(
    msg
) {

    return (

        msg.message
            ?.extendedTextMessage
            ?.contextInfo
            ?.mentionedJid

        ||

        msg.message
            ?.imageMessage
            ?.contextInfo
            ?.mentionedJid

        ||

        msg.message
            ?.videoMessage
            ?.contextInfo
            ?.mentionedJid

        ||

        []

    )

}


module.exports = {

    name:
        'demote',

    aliases: [
        'degradar',
        'unadmin'
    ],

    description:
        'Quita el rol de administrador a un usuario',

    category:
        'grupos',

    adminOnly:
        true,

    groupOnly:
        true,


    async execute({

        sock,
        from,
        msg

    }) {

        try {

            /* ─────────────────────────────
               SOLO GRUPOS
            ───────────────────────────── */

            if (
                !from.endsWith(
                    '@g.us'
                )
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'SOLO GRUPOS',

                                'Este comando solo funciona dentro de grupos.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               METADATA
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

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE GRUPO',

                                'No se pudieron obtener los participantes del grupo.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               REMITENTE
            ───────────────────────────── */

            const sender =

                msg.key.participant ||

                msg.participant ||

                msg.key.remoteJid


            if (!sender) {

                return await sock.sendMessage(

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


            const normalizedSender =
                normalizeJid(
                    sender
                )


            /* ─────────────────────────────
               VALIDAR ADMIN DEL USUARIO
            ───────────────────────────── */

            const senderData =
                findParticipant(

                    participants,

                    normalizedSender

                )


            if (
                !isAdministrator(
                    senderData
                )
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ACCESO DENEGADO',

                                'Solo los administradores pueden usar este comando.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               VALIDAR ADMIN DEL BOT
            ───────────────────────────── */

            const botJid =
                normalizeJid(
                    sock.user?.id
                )


            if (!botJid) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DEL BOT',

                                'No se pudo identificar la cuenta del bot.'

                            )

                    }

                )

            }


            const botData =
                findParticipant(

                    participants,

                    botJid

                )


            if (
                !isAdministrator(
                    botData
                )
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'BOT SIN PERMISOS',

                                'KennyBot necesita ser administrador para degradar usuarios.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               OBJETIVO
            ───────────────────────────── */

            const mentions =
                getMentionedJids(
                    msg
                )


            const target =
                mentions[0]


            if (!target) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'USUARIO REQUERIDO',

                                'Menciona al administrador que quieres degradar.\n\nUso: /demote @usuario'

                            )

                    }

                )

            }


            const normalizedTarget =
                normalizeJid(
                    target
                )


            /* ─────────────────────────────
               VALIDACIONES
            ───────────────────────────── */

            if (
                normalizedTarget ===
                normalizedSender
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'ACCIÓN INVÁLIDA',

                                'No puedes degradarte a ti mismo.'

                            )

                    }

                )

            }


            if (
                normalizedTarget ===
                botJid
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'ACCIÓN INVÁLIDA',

                                'No puedes quitarle el rango de administrador al bot usando este comando.'

                            )

                    }

                )

            }


            const targetData =
                findParticipant(

                    participants,

                    normalizedTarget

                )


            if (!targetData) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'USUARIO NO ENCONTRADO',

                                'Ese usuario no forma parte del grupo.'

                            )

                    }

                )

            }


            if (
                !isAdministrator(
                    targetData
                )
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'SIN RANGO',

                                `@${normalizedTarget.split('@')[0]} no es administrador.`

                            ),

                        mentions: [
                            normalizedTarget
                        ]

                    }

                )

            }


            if (
                targetData.admin === 'superadmin'
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ACCIÓN INVÁLIDA',

                                'No puedes quitarle el rango al creador o superadministrador del grupo.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               DEGRADAR
            ───────────────────────────── */

            const response =
                await sock.groupParticipantsUpdate(

                    from,

                    [
                        normalizedTarget
                    ],

                    'demote'

                )


            const result =
                Array.isArray(response)
                    ? response[0]
                    : null


            const status =
                String(
                    result?.status || ''
                )


            if (
                status &&
                status !== '200'
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'NO SE PUDO DEGRADAR',

                                `WhatsApp respondió con el código ${status}.`

                            )

                    }

                )

            }


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Demote: ${normalizedTarget.split('@')[0]} degradado por ${normalizedSender.split('@')[0]} en ${from.split('@')[0]}`

            )


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            return await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            '👤 USUARIO DEGRADADO',

                            [

                                [
                                    'Usuario',
                                    `@${normalizedTarget.split('@')[0]}`
                                ],

                                [
                                    'Nuevo rango',
                                    '○ MIEMBRO'
                                ],

                                [
                                    'Acción realizada por',
                                    `@${normalizedSender.split('@')[0]}`
                                ]

                            ],

                            'El rango de administrador fue retirado correctamente.'

                        ),

                    mentions: [
                        normalizedTarget,
                        normalizedSender
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error demote: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR AL DEGRADAR',

                                'No se pudo quitar el rango de administrador.'

                            )

                    }

                )

            } catch {}

        }

    }

}
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

        return String(jid)
            .replace(
                /:\d+@/,
                '@'
            )

    }

}


function getNumber(
    jid
) {

    return String(
        jid || ''
    )
        .split('@')[0]
        .split(':')[0]

}


function isAdministrator(
    participant
) {

    return (

        participant?.admin === 'admin' ||

        participant?.admin === 'superadmin'

    )

}


function getParticipantJids(
    participant
) {

    return [

        participant?.id,

        participant?.phoneNumber,

        participant?.lid

    ]
        .filter(Boolean)
        .map(
            normalizeJid
        )

}


function findParticipant(
    participants,
    jid
) {

    const target =
        normalizeJid(
            jid
        )


    if (!target) {

        return null

    }


    const targetNumber =
        getNumber(
            target
        )


    return participants.find(

        participant => {

            const jids =
                getParticipantJids(
                    participant
                )


            return jids.some(

                participantJid => {

                    if (
                        participantJid ===
                        target
                    ) {

                        return true

                    }


                    return (
                        getNumber(
                            participantJid
                        ) ===
                        targetNumber
                    )

                }

            )

        }

    ) || null

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


function findBotParticipant(
    participants,
    sock
) {

    const candidates = [

        sock.user?.id,

        sock.user?.lid

    ]
        .filter(Boolean)
        .map(
            normalizeJid
        )


    for (
        const candidate
        of candidates
    ) {

        const participant =
            findParticipant(

                participants,

                candidate

            )


        if (
            participant
        ) {

            return participant

        }

    }


    return null

}


module.exports = {

    name:
        'promote',

    aliases: [
        'promover',
        'admin'
    ],

    description:
        'Promueve a un usuario a administrador',

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


            const senderData =
                findParticipant(

                    participants,

                    sender

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
               VALIDAR BOT ADMIN
            ───────────────────────────── */

            const botData =
                findBotParticipant(

                    participants,

                    sock

                )


            if (
                !botData
            ) {

                logger.warn(

                    `Promote: no se encontró al bot en metadata del grupo ${from}`

                )


                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'BOT NO IDENTIFICADO',

                                'No se pudo localizar a KennyBot dentro de los participantes del grupo.'

                            )

                    }

                )

            }


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

                                'KennyBot necesita ser administrador para promover usuarios.'

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

                                'Menciona al usuario que quieres promover.\n\nUso: /promote @usuario'

                            )

                    }

                )

            }


            const targetData =
                findParticipant(

                    participants,

                    target

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


            const targetJid =

                targetData.id ||

                targetData.phoneNumber ||

                normalizeJid(
                    target
                )


            /* ─────────────────────────────
               PROTECCIONES
            ───────────────────────────── */

            if (
                senderData ===
                targetData
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'ACCIÓN INVÁLIDA',

                                'No puedes promoverte a ti mismo.'

                            )

                    }

                )

            }


            if (
                targetData ===
                botData
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'ACCIÓN INVÁLIDA',

                                'KennyBot ya cuenta con permisos de administrador.'

                            )

                    }

                )

            }


            if (
                isAdministrator(
                    targetData
                )
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'YA ES ADMIN',

                                `@${getNumber(targetJid)} ya es administrador del grupo.`

                            ),

                        mentions: [
                            targetJid
                        ]

                    }

                )

            }


            /* ─────────────────────────────
               PROMOVER
            ───────────────────────────── */

            const response =
                await sock.groupParticipantsUpdate(

                    from,

                    [
                        targetJid
                    ],

                    'promote'

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

                let reason =
                    `WhatsApp respondió con el código ${status}.`


                if (
                    status === '403'
                ) {

                    reason =
                        'WhatsApp rechazó la promoción. Verifica que KennyBot siga siendo administrador.'

                }


                else if (
                    status === '404'
                ) {

                    reason =
                        'El usuario ya no parece formar parte del grupo.'

                }


                else if (
                    status === '408'
                ) {

                    reason =
                        'La solicitud de promoción expiró. Inténtalo nuevamente.'

                }


                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'NO SE PUDO PROMOVER',

                                reason

                            )

                    }

                )

            }


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Promote: ${getNumber(targetJid)} promovido por ${getNumber(sender)} en ${from.split('@')[0]}`

            )


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            return await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            '👑 NUEVO ADMINISTRADOR',

                            [

                                [
                                    'Usuario',
                                    `@${getNumber(targetJid)}`
                                ],

                                [
                                    'Nuevo rango',
                                    '👑 ADMINISTRADOR'
                                ],

                                [
                                    'Promovido por',
                                    `@${getNumber(sender)}`
                                ]

                            ],

                            'El usuario recibió permisos de administrador correctamente.'

                        ),

                    mentions: [
                        targetJid,
                        sender
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error promote: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR AL PROMOVER',

                                'No se pudo otorgar el rango de administrador.'

                            )

                    }

                )

            } catch {}

        }

    }

}
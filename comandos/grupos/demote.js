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
            .trim()
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


function getContextInfo(
    msg
) {

    return (

        msg.message
            ?.extendedTextMessage
            ?.contextInfo

        ||

        msg.message
            ?.imageMessage
            ?.contextInfo

        ||

        msg.message
            ?.videoMessage
            ?.contextInfo

        ||

        msg.message
            ?.documentMessage
            ?.contextInfo

        ||

        msg.message
            ?.audioMessage
            ?.contextInfo

        ||

        msg.message
            ?.stickerMessage
            ?.contextInfo

        ||

        null

    )

}


function getMentionedJids(
    msg
) {

    const contextInfo =
        getContextInfo(
            msg
        )


    return Array.isArray(
        contextInfo?.mentionedJid
    )
        ? contextInfo.mentionedJid
        : []

}


function getQuotedParticipant(
    msg
) {

    const contextInfo =
        getContextInfo(
            msg
        )


    return normalizeJid(

        contextInfo?.participant ||

        contextInfo?.remoteJid ||

        null

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


function getBestParticipantJid(
    participant,
    fallback = null
) {

    if (!participant) {

        return normalizeJid(
            fallback
        )

    }


    return normalizeJid(

        participant.id ||

        participant.phoneNumber ||

        participant.lid ||

        fallback

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

                return await sock.safeSendMessage(

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

                return await sock.safeSendMessage(

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
                normalizeJid(

                    msg.key?.participant ||

                    msg.participant ||

                    msg.key?.remoteJid

                )


            const senderAlt =
                normalizeJid(

                    msg.key?.participantAlt ||

                    msg.participantAlt ||

                    null

                )


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


            let senderData =
                findParticipant(

                    participants,

                    sender

                )


            if (
                !senderData &&
                senderAlt
            ) {

                senderData =
                    findParticipant(

                        participants,

                        senderAlt

                    )

            }


            if (
                !isAdministrator(
                    senderData
                )
            ) {

                return await sock.safeSendMessage(

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

                return await sock.safeSendMessage(

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

                return await sock.safeSendMessage(

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


            const quotedParticipant =
                getQuotedParticipant(
                    msg
                )


            /*
                Prioridad:

                1. Usuario mencionado
                2. Usuario del mensaje respondido
            */

            const target =
                normalizeJid(

                    mentions[0] ||

                    quotedParticipant ||

                    null

                )


            if (!target) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'USUARIO REQUERIDO',

                                [
                                    'Menciona al administrador que quieres degradar o responde uno de sus mensajes.',
                                    '',
                                    'Ejemplos:',
                                    '• .demote @usuario',
                                    '• Responde un mensaje y escribe .demote'
                                ].join('\n')

                            )

                    }

                )

            }


            const targetData =
                findParticipant(

                    participants,

                    target

                )


            if (
                !targetData
            ) {

                return await sock.safeSendMessage(

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
                getBestParticipantJid(

                    targetData,

                    target

                )


            if (!targetJid) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'USUARIO NO IDENTIFICADO',

                                'No se pudo obtener el identificador del usuario.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               VALIDACIONES
            ───────────────────────────── */

            if (
                senderData ===
                targetData
            ) {

                return await sock.safeSendMessage(

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
                targetData ===
                botData
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'ACCIÓN INVÁLIDA',

                                'No puedes quitarle el rango de administrador a KennyBot usando este comando.'

                            )

                    }

                )

            }


            if (
                !isAdministrator(
                    targetData
                )
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'SIN RANGO',

                                `@${getNumber(targetJid)} no es administrador.`

                            ),

                        mentions: [
                            targetJid
                        ]

                    }

                )

            }


            if (
                targetData.admin ===
                'superadmin'
            ) {

                return await sock.safeSendMessage(

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
                        targetJid
                    ],

                    'demote'

                )


            const result =
                Array.isArray(
                    response
                )
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
                        'WhatsApp rechazó la degradación. Verifica que KennyBot siga siendo administrador.'

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
                        'La solicitud expiró. Inténtalo nuevamente.'

                }


                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'NO SE PUDO DEGRADAR',

                                reason

                            )

                    }

                )

            }


            /*
                Limpiar caché de administradores
                porque acaba de cambiar el rango.
            */

            try {

                const isGroupAdmin =
                    require('../../src/utils/isAdmin')


                if (
                    typeof isGroupAdmin.clearCache ===
                    'function'
                ) {

                    isGroupAdmin.clearCache(
                        from,
                        sock
                    )

                }

            } catch {}


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Demote: ${getNumber(targetJid)} degradado por ${getNumber(sender)} en ${from.split('@')[0]}`

            )


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            return await sock.safeSendMessage(

                from,

                {

                    text:
                        ui.success(

                            '👤 USUARIO DEGRADADO',

                            [
                                [
                                    'Usuario',
                                    `@${getNumber(targetJid)}`
                                ],
                                [
                                    'Nuevo rango',
                                    '○ MIEMBRO'
                                ],
                                [
                                    'Acción realizada por',
                                    `@${getNumber(sender)}`
                                ]
                            ],

                            'El rango de administrador fue retirado correctamente.'

                        ),

                    mentions: [
                        targetJid,
                        sender
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error demote: ${err.stack || err.message}`

            )


            try {

                await sock.safeSendMessage(

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
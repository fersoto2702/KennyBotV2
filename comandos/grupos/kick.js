const isGroupAdmin =
    require('../../src/utils/isAdmin')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


function normalizeJid(
    jid
) {

    if (!jid) {

        return null

    }


    return String(jid)
        .replace(
            /:\d+@/,
            '@'
        )

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

    const values = [

        participant?.id,

        participant?.phoneNumber,

        participant?.lid

    ]
        .filter(Boolean)
        .map(
            normalizeJid
        )


    return [
        ...new Set(values)
    ]

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


                    /*
                        Comparación secundaria
                        por número para PN JIDs.

                        No se usa para comparar
                        arbitrariamente dos LID.
                    */

                    const participantNumber =
                        getNumber(
                            participantJid
                        )


                    return (

                        targetNumber &&

                        participantNumber ===
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


function getBotCandidates(
    sock
) {

    const candidates = []


    if (
        sock.user?.id
    ) {

        candidates.push(
            normalizeJid(
                sock.user.id
            )
        )

    }


    if (
        sock.user?.lid
    ) {

        candidates.push(
            normalizeJid(
                sock.user.lid
            )
        )

    }


    const botNumber =
        getNumber(
            sock.user?.id
        )


    if (
        botNumber
    ) {

        candidates.push(
            `${botNumber}@s.whatsapp.net`
        )

    }


    const botLid =
        getNumber(
            sock.user?.lid
        )


    if (
        botLid
    ) {

        candidates.push(
            `${botLid}@lid`
        )

    }


    return [
        ...new Set(
            candidates.filter(Boolean)
        )
    ]

}


function findBotParticipant(
    participants,
    sock
) {

    const candidates =
        getBotCandidates(
            sock
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
        'kick',

    aliases: [
        'expulsar',
        'remove'
    ],

    description:
        'Expulsa a un usuario del grupo',

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
               REMITENTE
            ───────────────────────────── */

            const sender =

                msg.key.participant ||

                msg.participant ||

                msg.key.remoteJid


            if (
                !sender
            ) {

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


            /* ─────────────────────────────
               VALIDAR ADMIN
            ───────────────────────────── */

            const admin =
                await isGroupAdmin(

                    sock,

                    from,

                    sender

                )


            if (
                !admin
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

                    `Kick: no se encontró al bot en metadata del grupo ${from}`

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

                                'KennyBot necesita ser administrador para expulsar usuarios.'

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


            if (
                !target
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'USUARIO REQUERIDO',

                                'Menciona al usuario que quieres expulsar.\n\nUso: /kick @usuario'

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


            /* ─────────────────────────────
               JID REAL DEL PARTICIPANTE
            ───────────────────────────── */

            const targetJid =

                targetData.id ||

                targetData.phoneNumber ||

                target


            /* ─────────────────────────────
               NO EXPULSARTE
            ───────────────────────────── */

            const senderData =
                findParticipant(

                    participants,

                    sender

                )


            if (
                senderData &&
                senderData ===
                targetData
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'ACCIÓN INVÁLIDA',

                                'No puedes expulsarte a ti mismo.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               NO EXPULSAR AL BOT
            ───────────────────────────── */

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

                                'No puedes expulsar a KennyBot usando este comando.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               ADMIN OBJETIVO
            ───────────────────────────── */

            if (
                targetData.admin ===
                'superadmin'
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ACCIÓN INVÁLIDA',

                                'No puedes expulsar al creador o superadministrador del grupo.'

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
                            ui.error(

                                'USUARIO PROTEGIDO',

                                'No puedes expulsar a otro administrador. Primero debes degradarlo con /demote.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               EXPULSAR
            ───────────────────────────── */

            const response =
                await sock.groupParticipantsUpdate(

                    from,

                    [
                        targetJid
                    ],

                    'remove'

                )


            const result =
                Array.isArray(response)
                    ? response[0]
                    : null


            const status =
                String(
                    result?.status || ''
                )


            /* ─────────────────────────────
               VALIDAR RESPUESTA
            ───────────────────────────── */

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
                        'WhatsApp rechazó la expulsión. Verifica que KennyBot siga siendo administrador.'

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
                        'La solicitud de expulsión expiró. Inténtalo nuevamente.'

                }


                else if (
                    status === '409'
                ) {

                    reason =
                        'WhatsApp reportó un conflicto al intentar expulsar al usuario.'

                }


                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'NO SE PUDO EXPULSAR',

                                reason

                            )

                    }

                )

            }


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Kick: ${getNumber(targetJid)} expulsado por ${getNumber(sender)} de ${from.split('@')[0]}`

            )


            /* ─────────────────────────────
               CONFIRMACIÓN
            ───────────────────────────── */

            return await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            '🚪 USUARIO EXPULSADO',

                            [

                                [
                                    'Usuario',
                                    `@${getNumber(targetJid)}`
                                ],

                                [
                                    'Expulsado por',
                                    `@${getNumber(sender)}`
                                ],

                                [
                                    'Estado',
                                    '● EXPULSADO'
                                ]

                            ],

                            'El usuario fue eliminado correctamente del grupo.'

                        ),

                    mentions: [
                        targetJid,
                        sender
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error kick: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR AL EXPULSAR',

                                'No se pudo expulsar al usuario del grupo.'

                            )

                    }

                )

            } catch {}

        }

    }

}
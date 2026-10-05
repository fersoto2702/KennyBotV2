const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


function normalizeParticipantJid(
    participant
) {

    if (!participant) {

        return null

    }


    if (
        typeof participant === 'string'
    ) {

        return participant

    }


    return (

        participant.phoneNumber ||

        participant.id ||

        null

    )

}


function normalizeBotJid(
    sock
) {

    const id =
        sock.user?.id


    if (!id) {

        return null

    }


    const number =
        id
            .split(':')[0]
            .split('@')[0]


    return `${number}@s.whatsapp.net`

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

    const number =
        String(jid || '')
            .split('@')[0]


    return participants.find(

        participant => {

            const participantJid =
                normalizeParticipantJid(
                    participant
                )


            if (!participantJid) {

                return false

            }


            const participantNumber =
                participantJid
                    .split('@')[0]


            return (

                participantJid === jid ||

                participantNumber === number

            )

        }

    )

}


module.exports = {

    name:
        'add',

    aliases: [
        'agregar',
        'invite'
    ],

    description:
        'Agrega un usuario al grupo',

    category:
        'grupos',

    adminOnly:
        true,

    groupOnly:
        true,


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
               NÚMERO
            ───────────────────────────── */

            const number =
                String(
                    args?.[0] || ''
                )
                    .replace(
                        /\D/g,
                        ''
                    )


            if (
                !number
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'NÚMERO REQUERIDO',

                                'Escribe el número con código de país.\n\nUso: /add 521234567890'

                            )

                    }

                )

            }


            /*
                Evitamos entradas absurdamente
                cortas o excesivamente largas.
            */

            if (
                number.length < 8 ||
                number.length > 15
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'NÚMERO INVÁLIDO',

                                'El número debe incluir código de país y tener entre 8 y 15 dígitos.'

                            )

                    }

                )

            }


            const jid =
                `${number}@s.whatsapp.net`


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
               ADMIN USUARIO
            ───────────────────────────── */

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

                                'Solo los administradores pueden agregar usuarios.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               ADMIN BOT
            ───────────────────────────── */

            const botJid =
                normalizeBotJid(
                    sock
                )


            if (
                !botJid
            ) {

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

                                'KennyBot necesita ser administrador para agregar usuarios.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               YA ESTÁ EN EL GRUPO
            ───────────────────────────── */

            const already =
                findParticipant(

                    participants,

                    jid

                )


            if (
                already
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'USUARIO YA EXISTE',

                                `@${number} ya forma parte del grupo.`

                            ),

                        mentions: [
                            jid
                        ]

                    }

                )

            }


            /* ─────────────────────────────
               VERIFICAR WHATSAPP
            ───────────────────────────── */

            let exists =
                null


            try {

                exists =
                    await sock.onWhatsApp(
                        jid
                    )

            } catch (err) {

                logger.warn(

                    `onWhatsApp falló para ${number}: ${err.message}`

                )

            }


            /*
                Si onWhatsApp respondió,
                verificamos el resultado.

                Si la función falla por cambios
                de Baileys, dejamos que WhatsApp
                valide directamente al intentar
                agregar.
            */

            if (
                Array.isArray(exists) &&
                exists.length === 0
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'NÚMERO INVÁLIDO',

                                'Ese número no parece estar registrado en WhatsApp.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               AGREGAR
            ───────────────────────────── */

            const response =
                await sock.groupParticipantsUpdate(

                    from,

                    [
                        jid
                    ],

                    'add'

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
               RESULTADO
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
                        'WhatsApp no permitió agregar directamente a este usuario. Puede tener restricciones de privacidad.'

                }


                else if (
                    status === '408'
                ) {

                    reason =
                        'La solicitud para agregar al usuario expiró.'

                }


                else if (
                    status === '409'
                ) {

                    reason =
                        'El usuario ya forma parte del grupo.'

                }


                else if (
                    status === '500'
                ) {

                    reason =
                        'WhatsApp rechazó temporalmente la solicitud.'

                }


                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'NO SE PUDO AGREGAR',

                                reason

                            )

                    }

                )

            }


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Add: ${sender.split('@')[0]} agregó ${number} a ${from.split('@')[0]}`

            )


            /* ─────────────────────────────
               CONFIRMACIÓN
            ───────────────────────────── */

            return await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            '👤 USUARIO AGREGADO',

                            [

                                [
                                    'Usuario',
                                    `@${number}`
                                ],

                                [
                                    'Agregado por',
                                    `@${sender.split('@')[0]}`
                                ],

                                [
                                    'Estado',
                                    '✅ AGREGADO'
                                ]

                            ],

                            'El usuario fue agregado correctamente al grupo.'

                        ),

                    mentions: [
                        jid,
                        sender
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error add: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR AL AGREGAR',

                                'No se pudo agregar el usuario al grupo.'

                            )

                    }

                )

            } catch {}

        }

    }

}
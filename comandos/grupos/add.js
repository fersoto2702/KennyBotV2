const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

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

    adminOnly: true,

    groupOnly: true,

    async execute({

        sock,
        from,
        args,
        msg

    }) {

        try {

            // =========================
            // GROUP CHECK
            // =========================

            if (
                !from.endsWith('@g.us')
            ) {

                return await sock.sendMessage(

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
            // NUMBER
            // =========================

            const number =

                args[0]
                ?.replace(/\D/g, '')

            if (
                !number
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'NÚMERO REQUERIDO',

                                'Uso: /add 521234567890'

                            )

                    }

                )

            }

            // =========================
            // JID
            // =========================

            const jid =
                `${number}@s.whatsapp.net`

            // =========================
            // METADATA
            // =========================

            const metadata =

                await sock.groupMetadata(
                    from
                )

            const participants =
                metadata.participants

            const sender =

                msg.key.participant ||

                msg.participant

            // =========================
            // ADMIN CHECK
            // =========================

            const senderData =

                participants.find(

                    p => p.id === sender

                )

            const isAdmin =

                senderData?.admin === 'admin' ||

                senderData?.admin === 'superadmin'

            if (
                !isAdmin
            ) {

                return await sock.sendMessage(

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
            // BOT ADMIN
            // =========================

            const botId =
                sock.user.id.split(':')[0]

            const botData =

                participants.find(

                    p => p.id.includes(botId)

                )

            const botAdmin =

                botData?.admin === 'admin' ||

                botData?.admin === 'superadmin'

            if (
                !botAdmin
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'BOT SIN PERMISOS',

                                'El bot necesita ser administrador.'

                            )

                    }

                )

            }

            // =========================
            // ALREADY IN GROUP
            // =========================

            const already =
                participants.find(
                    p => p.id === jid
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

                                'Ese usuario ya está en el grupo.'

                            )

                    }

                )

            }

            // =========================
            // EXISTS CHECK
            // =========================

            const exists =

                await sock.onWhatsApp(
                    jid
                )

            if (
                !exists?.length
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'NÚMERO INVÁLIDO',

                                'Ese número no existe en WhatsApp.'

                            )

                    }

                )

            }

            // =========================
            // ADD USER
            // =========================

            const response =

                await sock.groupParticipantsUpdate(

                    from,

                    [jid],

                    'add'

                )

            const result =
                response?.[0]

            // =========================
            // FAIL
            // =========================

            if (
                result?.status &&
                result.status !== '200'
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'NO SE PUDO AGREGAR',

                                `Código: ${result.status}`

                            )

                    }

                )

            }

            logger.event(

                `Add: ${number} agregado a ${from.split('@')[0]}`

            )

            // =========================
            // SUCCESS
            // =========================

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            'USUARIO AGREGADO',

                            [

                                [

                                    'Usuario',

                                    `@${number}`

                                ]

                            ]

                        ),

                    mentions: [

                        jid

                    ]

                }

            )

        } catch (err) {

            logger.error(
                `Error add: ${err.message}`
            )

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.error(

                            'ERROR',

                            'No se pudo agregar el usuario.'

                        )

                }

            )

        }

    }

}
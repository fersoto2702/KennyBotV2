const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

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

    adminOnly: true,

    groupOnly: true,

    async execute({

        sock,
        from,
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
            // TARGET
            // =========================

            const target =

                msg.message
                ?.extendedTextMessage
                ?.contextInfo
                ?.mentionedJid?.[0]

            if (
                !target
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'USUARIO REQUERIDO',

                                'Uso: /promote @usuario'

                            )

                    }

                )

            }

            // =========================
            // SELF CHECK
            // =========================

            if (
                target === sender
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

            // =========================
            // BOT CHECK
            // =========================

            const botJid =
                sock.user.id.split(':')[0] + '@s.whatsapp.net'

            if (
                target === botJid
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'ACCIÓN INVÁLIDA',

                                'El bot ya tiene permisos.'

                            )

                    }

                )

            }

            // =========================
            // TARGET EXISTS
            // =========================

            const targetData =

                participants.find(

                    p => p.id === target

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

                                'Ese usuario no está en el grupo.'

                            )

                    }

                )

            }

            // =========================
            // ALREADY ADMIN
            // =========================

            const targetAdmin =

                targetData?.admin === 'admin' ||

                targetData?.admin === 'superadmin'

            if (
                targetAdmin
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'YA ES ADMIN',

                                'Ese usuario ya es administrador.'

                            )

                    }

                )

            }

            // =========================
            // PROMOTE
            // =========================

            const response =

                await sock.groupParticipantsUpdate(

                    from,

                    [target],

                    'promote'

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

                                'NO SE PUDO PROMOVER',

                                `Código: ${result.status}`

                            )

                    }

                )

            }

            logger.event(

                `Promote: ${target.split('@')[0]} en ${from.split('@')[0]}`

            )

            // =========================
            // SUCCESS
            // =========================

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            'NUEVO ADMINISTRADOR',

                            [

                                [

                                    'Usuario',

                                    `@${target.split('@')[0]}`

                                ],

                                [

                                    'Rango',

                                    '👑 Administrador'

                                ]

                            ]

                        ),

                    mentions: [

                        target

                    ]

                }

            )

        } catch (err) {

            logger.error(
                `Error promote: ${err.message}`
            )

        }

    }

}
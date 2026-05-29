const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const isGroupAdmin =
    require('../../src/utils/isAdmin')

const banPath =
    path.join(
        __dirname,
        '../../database/bans.json'
    )

module.exports = {

    name: 'ban',

    description:
        'Banea usuarios del bot',

    category:
        'admin',

    adminOnly: true,

    groupOnly: true,

    async execute({

        sock,
        from,
        msg

    }) {

        try {

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

            const sender =

                msg.key.participant ||

                msg.participant

            const isAdmin =
                await isGroupAdmin(

                    sock,
                    from,
                    sender

                )

            if (!isAdmin) {

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

            const target =

                msg.message
                ?.extendedTextMessage
                ?.contextInfo
                ?.mentionedJid?.[0]

            if (!target) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'USUARIO REQUERIDO',

                                'Menciona al usuario que quieres banear.\n\nEjemplo: /ban @usuario'

                            )

                    }

                )

            }

            if (target === sender) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'ACCIÓN INVÁLIDA',

                                'No puedes banearte a ti mismo.'

                            )

                    }

                )

            }

            const botNumber =
                sock.user.id.split(':')[0] + '@s.whatsapp.net'

            if (target === botNumber) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'ACCIÓN INVÁLIDA',

                                'No puedes banear al bot.'

                            )

                    }

                )

            }

            if (
                !fs.existsSync(banPath)
            ) {

                fs.writeFileSync(

                    banPath,

                    JSON.stringify(
                        [],
                        null,
                        2
                    )

                )

            }

            let data = []

            try {

                data =
                    JSON.parse(

                        fs.readFileSync(
                            banPath
                        )

                    )

            } catch {

                data = []

            }

            if (
                data.includes(target)
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'YA BANEADO',

                                'Ese usuario ya estaba baneado.'

                            )

                    }

                )

            }

            data.push(target)

            fs.writeFileSync(

                banPath,

                JSON.stringify(
                    data,
                    null,
                    2
                )

            )

            logger.event(
                `Ban aplicado: ${target.split('@')[0]}`
            )

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            'BAN EJECUTADO',

                            [

                                [
                                    'Usuario',
                                    `@${target.split('@')[0]}`
                                ],

                                [
                                    'Estado',
                                    'BANEADO'
                                ],

                                [
                                    'Por',
                                    `@${sender.split('@')[0]}`
                                ]

                            ],

                            'Este usuario ya no puede usar los comandos del bot.'

                        ),

                    mentions: [

                        target,
                        sender

                    ]

                }

            )

        } catch (err) {

            logger.error(
                `Error ban: ${err.message}`
            )

        }

    }

}
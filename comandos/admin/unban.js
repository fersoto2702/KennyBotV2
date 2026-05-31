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

    name: 'unban',

    description:
        'Desbanea usuarios del bot',

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
                                'Menciona al usuario que quieres desbanear.\n\nEjemplo: /unban @usuario'
                            )
                    }
                )

            }

            if (!fs.existsSync(banPath)) {

                fs.writeFileSync(
                    banPath,
                    JSON.stringify([], null, 2)
                )

            }

            let data = []

            try {

                data =
                    JSON.parse(
                        fs.readFileSync(banPath)
                    )

            } catch {

                data = []

            }

            if (!data.includes(target)) {

                return await sock.sendMessage(
                    from,
                    {
                        text:
                            ui.warn(
                                'NO BANEADO',
                                'Ese usuario no está baneado.'
                            )
                    }
                )

            }

            data =
                data.filter(
                    user => user !== target
                )

            fs.writeFileSync(
                banPath,
                JSON.stringify(
                    data,
                    null,
                    2
                )
            )

            logger.event(
                `Unban aplicado: ${target.split('@')[0]}`
            )

            const iconPath =
                path.join(
                    __dirname,
                    '../../assets/icons/unban.jpeg'
                )

            await sock.sendMessage(
                from,
                {
                    image: {
                        url: iconPath
                    },

                    caption:
                        ui.success(
                            'UNBAN EJECUTADO',
                            [
                                [
                                    'Usuario',
                                    `@${target.split('@')[0]}`
                                ],
                                [
                                    'Estado',
                                    'DESBANEADO'
                                ],
                                [
                                    'Por',
                                    `@${sender.split('@')[0]}`
                                ]
                            ],
                            'Este usuario puede volver a usar los comandos del bot.'
                        ),

                    mentions: [
                        target,
                        sender
                    ]
                }
            )

        } catch (err) {

            logger.error(
                `Error unban: ${err.message}`
            )

        }

    }

}
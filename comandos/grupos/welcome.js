const fs =
    require('fs')

const path =
    require('path')

const isGroupAdmin =
    require('../../src/utils/isAdmin')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const welcomePath =
    path.join(
        __dirname,
        '../../database/welcome.json'
    )

module.exports = {

    name:
        'welcome',

    aliases: [
        'bienvenida',
        'welcomemsg'
    ],

    description:
        'Activa o desactiva el mensaje de bienvenida',

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

            if (!from.endsWith('@g.us')) {

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

            const admin =
                await isGroupAdmin(
                    sock,
                    from,
                    sender
                )

            if (!admin) {

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

            if (!fs.existsSync(welcomePath)) {
                fs.writeFileSync(
                    welcomePath,
                    JSON.stringify([], null, 2)
                )
            }

            let data = []

            try {

                data =
                    JSON.parse(
                        fs.readFileSync(welcomePath)
                    )

                if (!Array.isArray(data)) {
                    data = []
                }

            } catch {
                data = []
            }

            const option =
                args[0]
                ?.toLowerCase()
                ?.trim()

            if (option === 'on') {

                if (!data.includes(from)) {
                    data.push(from)
                }

                fs.writeFileSync(
                    welcomePath,
                    JSON.stringify(data, null, 2)
                )

                logger.event(
                    `Welcome ON: ${from.split('@')[0]}`
                )

                return await sock.sendMessage(
                    from,
                    {
                        text:
                            ui.success(
                                'WELCOME ACTIVADO',
                                [
                                    ['Estado', '● ACTIVADO']
                                ]
                            )
                    }
                )

            }

            if (option === 'off') {

                data =
                    data.filter(id => id !== from)

                fs.writeFileSync(
                    welcomePath,
                    JSON.stringify(data, null, 2)
                )

                logger.event(
                    `Welcome OFF: ${from.split('@')[0]}`
                )

                return await sock.sendMessage(
                    from,
                    {
                        text:
                            ui.success(
                                'WELCOME DESACTIVADO',
                                [
                                    ['Estado', '○ DESACTIVADO']
                                ]
                            )
                    }
                )

            }

            const enabled =
                data.includes(from)

            await sock.sendMessage(
                from,
                {
                    text:
                        ui.info(
                            'WELCOME DEL GRUPO',
                            [
                                [
                                    'Estado',
                                    enabled
                                        ? '● ACTIVADO'
                                        : '○ DESACTIVADO'
                                ]
                            ],
                            'Uso:\n/welcome on\n/welcome off'
                        )
                }
            )

        } catch (err) {

            logger.error(
                `Error welcome: ${err.message}`
            )

        }

    }

}
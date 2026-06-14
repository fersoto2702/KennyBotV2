const fs = require('fs')
const path = require('path')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const iconPath =
    path.join(
        __dirname,
        '../../assets/icons/fusion.jpeg'
    )

function createFusion(a, b) {

    const first =
        a.slice(
            0,
            Math.ceil(a.length / 2)
        )

    const second =
        b.slice(
            Math.floor(b.length / 2)
        )

    return first + second

}

module.exports = {

    name: 'fusion',

    aliases: [
        'fuse'
    ],

    description:
        'Fusiona dos nombres',

    category:
        'diversion',

    cooldown: 3,

    async execute({

        sock,
        from,
        args,
        msg

    }) {

        try {

            const mentions =
                msg.message
                    ?.extendedTextMessage
                    ?.contextInfo
                    ?.mentionedJid || []

            let name1
            let name2

            if (mentions.length >= 2) {

                name1 =
                    mentions[0]
                        .split('@')[0]

                name2 =
                    mentions[1]
                        .split('@')[0]

            } else {

                if (args.length < 2) {

                    return await sock.sendMessage(
                        from,
                        {
                            image:
                                fs.readFileSync(iconPath),

                            caption:
                                ui.warn(
                                    'DATOS INSUFICIENTES',
                                    'Uso:\n/fusion @usuario1 @usuario2\n\nO\n\n/fusion nombre1 nombre2'
                                )
                        }
                    )

                }

                name1 = args[0]
                name2 = args[1]

            }

            const fusion =
                createFusion(
                    name1,
                    name2
                )

            logger.event(
                `Fusion: ${name1} + ${name2}`
            )

            await sock.sendMessage(
                from,
                {
                    image:
                        fs.readFileSync(iconPath),

                    caption:
                        ui.success(
                            'FUSIÓN',
                            [
                                [
                                    'Nombre 1',
                                    name1
                                ],
                                [
                                    'Nombre 2',
                                    name2
                                ],
                                [
                                    'Resultado',
                                    fusion
                                ]
                            ]
                        )
                }
            )

        } catch (err) {

            logger.error(
                `Error fusion: ${err.message}`
            )

        }

    }

}
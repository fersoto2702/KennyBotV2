const fs = require('fs')
const path = require('path')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const iconPath =
    path.join(
        __dirname,
        '../../assets/icons/ship.jpeg'
    )

function getCompatibility(a, b) {

    const text =
        `${a}${b}`
            .toLowerCase()

    let hash = 0

    for (let i = 0; i < text.length; i++) {

        hash =
            ((hash << 5) - hash) +
            text.charCodeAt(i)

        hash |= 0

    }

    return Math.abs(hash % 101)

}

function getBar(percent) {

    const filled =
        Math.floor(percent / 10)

    return (
        '█'.repeat(filled) +
        '░'.repeat(10 - filled)
    )

}

function getStatus(percent) {

    if (percent <= 20)
        return '💔 Imposible'

    if (percent <= 50)
        return '😅 Difícil'

    if (percent <= 80)
        return '💕 Buena pareja'

    return '💍 Destinados'

}

module.exports = {

    name: 'ship',

    aliases: [

        'love',
        'compatibilidad'

    ],

    description:
        'Calcula la compatibilidad entre dos personas',

    category:
        'diversion',

    cooldown: 5,

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

            let person1
            let person2

            if (mentions.length >= 2) {

                person1 =
                    `@${mentions[0].split('@')[0]}`

                person2 =
                    `@${mentions[1].split('@')[0]}`

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
                                    'Uso:\n/ship @usuario1 @usuario2\n\nO\n\n/ship nombre1 nombre2'
                                )
                        }
                    )

                }

                person1 =
                    args[0]

                person2 =
                    args.slice(1).join(' ')

            }

            const percent =
                getCompatibility(
                    person1,
                    person2
                )

            const bar =
                getBar(percent)

            const status =
                getStatus(percent)

            logger.event(
                `Ship: ${person1} ❤️ ${person2} (${percent}%)`
            )

            await sock.sendMessage(
                from,
                {
                    image:
                        fs.readFileSync(iconPath),

                    caption:
                        ui.success(
                            'SHIP',
                            [
                                [
                                    'Pareja',
                                    `${person1} ❤️ ${person2}`
                                ],
                                [
                                    'Compatibilidad',
                                    `${percent}%`
                                ],
                                [
                                    'Barra',
                                    bar
                                ],
                                [
                                    'Resultado',
                                    status
                                ]
                            ]
                        ),

                    mentions
                }
            )

        } catch (err) {

            logger.error(
                `Error ship: ${err.message}`
            )

            await sock.sendMessage(
                from,
                {
                    image:
                        fs.readFileSync(iconPath),

                    caption:
                        ui.error(
                            'ERROR',
                            'No se pudo calcular la compatibilidad.'
                        )
                }
            )

        }

    }

}
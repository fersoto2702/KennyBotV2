const fs = require('fs')
const path = require('path')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const iconPath =
    path.join(
        __dirname,
        '../../assets/icons/crush.jpeg'
    )

function getPercent(text) {

    let hash = 0

    for (let i = 0; i < text.length; i++) {

        hash =
            ((hash << 5) - hash) +
            text.charCodeAt(i)

        hash |= 0

    }

    return Math.abs(hash % 101)

}

function getResult(percent) {

    if (percent <= 20)
        return '😬 Ni te topa'

    if (percent <= 40)
        return '😅 Hay esperanza'

    if (percent <= 60)
        return '😊 Interés moderado'

    if (percent <= 80)
        return '😍 Le gustas bastante'

    return '💘 Crush confirmado'

}

module.exports = {

    name: 'crush',

    aliases: [
        'amor'
    ],

    description:
        'Calcula la posibilidad de ser el crush de alguien',

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

            let target

            if (mentions.length > 0) {

                target =
                    mentions[0]
                        .split('@')[0]

            } else {

                target =
                    args.join(' ')
                        .trim()

            }

            if (!target) {

                return await sock.sendMessage(
                    from,
                    {
                        image:
                            fs.readFileSync(iconPath),

                        caption:
                            ui.warn(
                                'OBJETIVO REQUERIDO',
                                'Uso: /crush @usuario'
                            )
                    }
                )

            }

            const percent =
                getPercent(target)

            await sock.sendMessage(
                from,
                {
                    image:
                        fs.readFileSync(iconPath),

                    caption:
                        ui.success(
                            'CRUSH',
                            [
                                [
                                    'Objetivo',
                                    target
                                ],
                                [
                                    'Probabilidad',
                                    `${percent}%`
                                ],
                                [
                                    'Resultado',
                                    getResult(percent)
                                ]
                            ]
                        )
                }
            )

            logger.event(
                `Crush: ${target} (${percent}%)`
            )

        } catch (err) {

            logger.error(
                `Error crush: ${err.message}`
            )

        }

    }

}
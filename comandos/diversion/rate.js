const fs = require('fs')
const path = require('path')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const iconPath =
    path.join(
        __dirname,
        '../../assets/icons/rate.jpeg'
    )

function getRating(text) {

    let hash = 0

    for (let i = 0; i < text.length; i++) {

        hash =
            ((hash << 5) - hash) +
            text.charCodeAt(i)

        hash |= 0

    }

    return Math.abs(hash % 10) + 1

}

function getComment(score) {

    if (score <= 3)
        return '💀 Terrible'

    if (score <= 5)
        return '😐 Regular'

    if (score <= 7)
        return '👍 Bueno'

    if (score <= 9)
        return '🔥 Excelente'

    return '👑 Perfecto'

}

module.exports = {

    name: 'rate',

    aliases: [
        'calificar'
    ],

    description:
        'Califica cualquier cosa',

    category:
        'diversion',

    cooldown: 3,

    async execute({

        sock,
        from,
        args

    }) {

        try {

            const text =
                args.join(' ').trim()

            if (!text) {

                return await sock.sendMessage(
                    from,
                    {
                        image:
                            fs.readFileSync(iconPath),

                        caption:
                            ui.warn(
                                'ELEMENTO REQUERIDO',
                                'Uso: /rate texto'
                            )
                    }
                )

            }

            const score =
                getRating(text)

            await sock.sendMessage(
                from,
                {
                    image:
                        fs.readFileSync(iconPath),

                    caption:
                        ui.success(
                            'RATE',
                            [
                                [
                                    'Elemento',
                                    text
                                ],
                                [
                                    'Calificación',
                                    `${score}/10`
                                ],
                                [
                                    'Comentario',
                                    getComment(score)
                                ]
                            ]
                        )
                }
            )

        } catch (err) {

            logger.error(
                `Error rate: ${err.message}`
            )

        }

    }

}
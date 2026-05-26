const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

// =========================
// PATH
// =========================

const statsPath =

    path.join(

        __dirname,

        '../../database/messages.json'

    )

// =========================
// FORMAT TIME
// =========================

const formatTime = ms => {

    const mins =
        Math.floor(ms / 60000)

    const hours =
        Math.floor(mins / 60)

    const days =
        Math.floor(hours / 24)

    if (days > 0)
        return `${days}d`

    if (hours > 0)
        return `${hours}h`

    return `${mins}m`

}

// =========================
// EXPORT
// =========================

module.exports = {

    name: 'msgstats',

    aliases: [

        'messages',
        'actividad'

    ],

    description: 'Muestra estadísticas de mensajes',

    category: 'general',

    cooldown: 5,

    async execute({

        sock,
        from,
        msg

    }) {

        try {

            // =========================
            // GROUP
            // =========================

            if (
                !from.endsWith('@g.us')
            ) {

                return await sock.sendMessage(from, {

                    text: ui.error(

                        'SOLO GRUPOS',

                        'Este comando solo funciona en grupos.'

                    )

                })

            }

            // =========================
            // DB
            // =========================

            if (
                !fs.existsSync(statsPath)
            ) {

                fs.writeFileSync(

                    statsPath,

                    JSON.stringify({}, null, 2)

                )

            }

            const data = JSON.parse(

                fs.readFileSync(
                    statsPath
                )

            )

            // =========================
            // TARGET
            // =========================

            const target =

                msg.message
                    ?.extendedTextMessage
                    ?.contextInfo
                    ?.mentionedJid?.[0]

                ||

                msg.key.participant

                ||

                msg.key.remoteJid

            const userData =
                data?.[from]?.[target]

            if (!userData) {

                return await sock.sendMessage(from, {

                    text: ui.warn(

                        'SIN DATOS',

                        'Ese usuario no tiene estadísticas.'

                    )

                })

            }

            // =========================
            // POSITION
            // =========================

            const ranking =

                Object.entries(data[from])

                    .sort(

                        (a, b) =>

                            b[1].messages -

                            a[1].messages

                    )

            const position =

                ranking.findIndex(

                    ([id]) => id === target

                ) + 1

            // =========================
            // LAST MSG
            // =========================

            const inactiveMs =

                Date.now() -

                userData.lastMessage

            // =========================
            // SEND
            // =========================

            await sock.sendMessage(from, {

                text: ui.info(

                    'ESTADÍSTICAS',

                    [

                        [

                            'Usuario',

                            `@${target.split('@')[0]}`

                        ],

                        [

                            'Mensajes',

                            `💬 ${userData.messages.toLocaleString()}`

                        ],

                        [

                            'Posición',

                            `🏆 #${position}`

                        ],

                        [

                            'Último msg',

                            `⏱ Hace ${formatTime(inactiveMs)}`

                        ]

                    ]

                ),

                mentions: [target]

            })

        } catch (err) {

            logger.error(

                `MsgStats Error: ${err.message}`

            )

        }

    }

}
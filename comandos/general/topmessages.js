const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const statsPath =
    path.join(
        __dirname,
        '../../database/messages.json'
    )

const MEDALS = [
    '🥇',
    '🥈',
    '🥉'
]

module.exports = {

    name: 'topmessages',

    aliases: [
        'topmsg',
        'activostop'
    ],

    description: 'Muestra los usuarios más activos',

    category: 'general',

    cooldown: 10,

    async execute({
        sock,
        from
    }) {

        try {

            if (!from.endsWith('@g.us')) {

                return await sock.sendMessage(from, {
                    text: ui.error(
                        'SOLO GRUPOS',
                        'Este comando solo funciona en grupos.'
                    )
                })

            }

            if (!fs.existsSync(statsPath)) {
                fs.writeFileSync(
                    statsPath,
                    JSON.stringify({}, null, 2)
                )
            }

            const data = JSON.parse(
                fs.readFileSync(statsPath)
            )

            const group =
                data[from]

            if (
                !group ||
                Object.keys(group).length === 0
            ) {

                return await sock.sendMessage(from, {
                    text: ui.warn(
                        'SIN DATOS',
                        'No hay estadísticas todavía.'
                    )
                })

            }

            const users =
                Object.entries(group)
                    .sort(
                        (a, b) =>
                            b[1].messages -
                            a[1].messages
                    )
                    .slice(0, 10)

            const mentions =
                users.map(([id]) => id)

            const rows =
                users.map(
                    ([id, data], i) => {

                        const medal =
                            MEDALS[i] ||
                            `${i + 1}.`

                        return (
                            `${medal} @${id.split('@')[0]}\n` +
                            `│ 💬 ${data.messages.toLocaleString()} mensajes`
                        )

                    }
                ).join('\n' + ui.divider + '\n')

            await sock.sendMessage(from, {
                text: [
                    '⟨ USUARIOS MÁS ACTIVOS ⟩',
                    ui.divider,
                    rows,
                    ui.divider
                ].join('\n'),
                mentions
            })

        } catch (err) {

            logger.error(
                `TopMessages Error: ${err.message}`
            )

        }

    }

}
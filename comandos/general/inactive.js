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
// EXPORT
// =========================

module.exports = {

    name: 'inactive',

    aliases: [

        'inactivos',
        'deadchat'

    ],

    description: 'Muestra los usuarios menos activos',

    category: 'general',

    cooldown: 10,

    async execute({

        sock,
        from

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

            // =========================
            // SORT
            // =========================

            const users =

                Object.entries(group)

                    .sort(

                        (a, b) =>

                            a[1].messages -

                            b[1].messages

                    )

                    .slice(0, 10)

            // =========================
            // TEXT
            // =========================

            const mentions =

                users.map(
                    ([id]) => id
                )

            const rows =

                users.map(

                    ([id, data], i) => (

                        `💀 @${id.split('@')[0]}\n` +

                        `│ 💬 ${data.messages.toLocaleString()} mensajes`

                    )

                ).join('\n' + ui.divider + '\n')

            // =========================
            // SEND
            // =========================

            await sock.sendMessage(from, {

                text: [

                    '⟨ USUARIOS MÁS INACTIVOS ⟩',

                    ui.divider,

                    rows,

                    ui.divider

                ].join('\n'),

                mentions

            })

        } catch (err) {

            logger.error(

                `Inactive Error: ${err.message}`

            )

        }

    }

}
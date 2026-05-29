const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const levelsPath =
    path.join(
        __dirname,
        '../../database/levels.json'
    )

const MEDALS = [
    '🥇',
    '🥈',
    '🥉'
]

module.exports = {

    name:
        'leaderboard',

    aliases: [
        'lb',
        'top',
        'topxp'
    ],

    description:
        'Muestra el top de usuarios con más nivel',

    category:
        'niveles',

    cooldown: 10,

    async execute({
        sock,
        from
    }) {

        try {

            if (!fs.existsSync(levelsPath)) {
                fs.writeFileSync(
                    levelsPath,
                    JSON.stringify({}, null, 2)
                )
            }

            let levels = {}

            try {
                levels =
                    JSON.parse(
                        fs.readFileSync(levelsPath)
                    )
            } catch {
                levels = {}
            }

            let users =
                Object.entries(levels)

            if (users.length === 0) {

                return await sock.sendMessage(
                    from,
                    {
                        text:
                            ui.info(
                                'LEADERBOARD',
                                [],
                                'No hay datos todavía.'
                            )
                    }
                )

            }

            users = users.map(
                ([id, data]) => {

                    if (typeof data !== 'object') data = {}
                    if (typeof data.level !== 'number') data.level = 1
                    if (typeof data.xp !== 'number') data.xp = 0
                    if (data.level < 1) data.level = 1
                    if (data.xp < 0) data.xp = 0

                    return [id, data]

                }
            )

            users.sort(
                (a, b) =>
                    b[1].xp -
                    a[1].xp
            )

            const top =
                users.slice(0, 10)

            const mentions =
                top.map(([id]) => id)

            const rows =
                top.map(
                    ([id, data], i) => {

                        const medal =
                            MEDALS[i] ||
                            `${i + 1}.`

                        return [
                            `${medal} @${id.split('@')[0]}`,
                            `⭐ Nivel ${data.level}`,
                            `✨ ${Number(data.xp).toLocaleString()} XP`
                        ].join('  •  ')

                    }
                ).join('\n\n')

            logger.event(
                `Leaderboard usado en ${from.split('@')[0]}`
            )

            await sock.sendMessage(
                from,
                {
                    text: [
                        `🏆 LEADERBOARD GLOBAL`,
                        ui.divider,
                        rows,
                        ui.divider,
                        `👥 Usuarios rankeados: ${users.length}`
                    ].join('\n'),
                    mentions
                }
            )

        } catch (err) {

            logger.error(
                `Error leaderboard: ${err.message}`
            )

        }

    }

}
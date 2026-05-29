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

module.exports = {

    name:
        'rank',

    aliases: [
        'ranking',
        'globalrank'
    ],

    description:
        'Muestra tu posición en el ranking global',

    category:
        'niveles',

    cooldown: 5,

    async execute({
        sock,
        from,
        msg
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

            const sender =
                msg.key.participant ||
                msg.key.remoteJid

            if (!levels[sender]) {
                levels[sender] = {
                    xp: 0,
                    level: 1
                }
            }

            if (typeof levels[sender].xp !== 'number') levels[sender].xp = 0
            if (typeof levels[sender].level !== 'number') levels[sender].level = 1
            if (levels[sender].xp < 0) levels[sender].xp = 0
            if (levels[sender].level < 1) levels[sender].level = 1

            fs.writeFileSync(
                levelsPath,
                JSON.stringify(levels, null, 2)
            )

            let users =
                Object.entries(levels)

            users = users.map(
                ([id, data]) => {

                    if (typeof data !== 'object') data = {}
                    if (typeof data.level !== 'number') data.level = 1
                    if (typeof data.xp !== 'number') data.xp = 0

                    return [id, data]

                }
            )

            users.sort(
                (a, b) =>
                    b[1].xp -
                    a[1].xp
            )

            const position =
                users.findIndex(
                    ([id]) => id === sender
                ) + 1

            const userData =
                levels[sender]

            const medal =
                position === 1
                    ? '🥇'
                : position === 2
                    ? '🥈'
                : position === 3
                    ? '🥉'
                : `#${position}`

            logger.event(
                `Rank check: ${sender.split('@')[0]} → #${position}`
            )

            await sock.sendMessage(
                from,
                {
                    text:
                        ui.info(
                            'RANK GLOBAL',
                            [
                                ['Usuario', `@${sender.split('@')[0]}`],
                                ['Posición', `${medal} de ${users.length}`],
                                ['Nivel', `⭐ ${userData.level}`],
                                ['XP', `✨ ${Number(userData.xp).toLocaleString()}`]
                            ]
                        ),
                    mentions: [sender]
                }
            )

        } catch (err) {

            logger.error(
                `Error rank: ${err.message}`
            )

        }

    }

}
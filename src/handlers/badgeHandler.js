const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../utils/logger')

const ui =
    require('../utils/ui')

const {
    isLimited
} = require('../system/rateLimiter')

const badgesPath =
    path.join(
        __dirname,
        '../../database/badges.json'
    )

const levelsPath =
    path.join(
        __dirname,
        '../../database/levels.json'
    )

const economyPath =
    path.join(
        __dirname,
        '../../database/economy.json'
    )

const MAX_BADGES_PER_MESSAGE = 3

const BADGE_RULES = [

    {
        id: '🥉 Nivel 10',
        check: (lvl, money) => lvl >= 10
    },

    {
        id: '🥈 Nivel 25',
        check: (lvl, money) => lvl >= 25
    },

    {
        id: '🥇 Nivel 50',
        check: (lvl, money) => lvl >= 50
    },

    {
        id: '💰 Millonario',
        check: (lvl, money) => money >= 50000
    },

    {
        id: '💎 Multimillonario',
        check: (lvl, money) => money >= 200000
    }

]

function ensureDatabases() {

    const databases = [
        badgesPath,
        levelsPath,
        economyPath
    ]

    for (const file of databases) {

        if (!fs.existsSync(file)) {
            fs.writeFileSync(
                file,
                JSON.stringify({}, null, 2)
            )
        }

    }

}

module.exports = async (sock, msg, from) => {

    try {

        const sender =
            msg.key.participant ||
            msg.key.remoteJid

        if (!sender) return

        if (isLimited(sender, 'flood')) return

        ensureDatabases()

        const badges =
            JSON.parse(
                fs.readFileSync(badgesPath)
            )

        const levels =
            JSON.parse(
                fs.readFileSync(levelsPath)
            )

        const economy =
            JSON.parse(
                fs.readFileSync(economyPath)
            )

        if (!badges[sender]) {
            badges[sender] = []
        }

        const level =
            levels[sender]?.level || 1

        const money =
            (economy[sender]?.coins || 0) +
            (economy[sender]?.bank || 0)

        const newBadges = []

        for (const rule of BADGE_RULES) {

            if (newBadges.length >= MAX_BADGES_PER_MESSAGE) {
                break
            }

            const unlocked =
                rule.check(level, money)

            const alreadyHas =
                badges[sender].includes(rule.id)

            if (unlocked && !alreadyHas) {

                badges[sender].push(rule.id)
                newBadges.push(rule.id)

            }

        }

        if (newBadges.length === 0) return

        fs.writeFileSync(
            badgesPath,
            JSON.stringify(badges, null, 2)
        )

        logger.event(
            `Badges: ${sender.split('@')[0]} → ${newBadges.join(', ')}`
        )

        if (isLimited(sender, 'commands')) return

        const badgeText =
            newBadges
                .map(b => `• ${b}`)
                .join('\n')

        await sock.safeSendMessage(
            from,
            {
                text:
                    ui.success(
                        'NUEVOS LOGROS DESBLOQUEADOS',
                        [
                            ['Usuario', `@${sender.split('@')[0]}`],
                            ['Logros', `${newBadges.length}`],
                            ['Badges', `\n${badgeText}`]
                        ]
                    ),
                mentions: [sender]
            }
        )

    } catch (err) {

        logger.error(
            `BadgeHandler Error: ${err.message}`
        )

    }

}
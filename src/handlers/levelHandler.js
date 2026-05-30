const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../utils/logger')

const ui =
    require('../utils/ui')

const {
    isEnabled
} = require('../utils/toggles')

const {
    isLimited,
    getRemainingTime
} = require('../system/rateLimiter')

const economyPath =
    path.join(
        __dirname,
        '../../database/economy.json'
    )

const levelsPath =
    path.join(
        __dirname,
        '../../database/levels.json'
    )

const inventoryPath =
    path.join(
        __dirname,
        '../../database/inventory.json'
    )

const xpCooldown =
    new Map()

const XP_COOLDOWN =
    60 * 1000

const MAX_LEVELS_PER_MESSAGE =
    5

function ensureDatabases() {

    const databases = [
        [levelsPath, {}],
        [inventoryPath, {}],
        [economyPath, {}]
    ]

    for (const [file, def] of databases) {

        if (!fs.existsSync(file)) {
            fs.writeFileSync(
                file,
                JSON.stringify(def, null, 2)
            )
        }

    }

}

setInterval(() => {

    try {

        const now =
            Date.now()

        for (const [user, exp] of xpCooldown) {

            if (now >= exp) {
                xpCooldown.delete(user)
            }

        }

    } catch {}

}, 60000)

module.exports = async (sock, msg, from) => {

    try {

        if (!from.endsWith('@g.us')) return

        if (!isEnabled(from, 'autolevelup')) return

        const sender =
            msg.key.participant ||
            msg.key.remoteJid

        if (!sender) return

        if (isLimited(sender, 'flood')) return

        const now =
            Date.now()

        const expiration =
            xpCooldown.get(sender)

        if (expiration && now < expiration) return

        xpCooldown.set(
            sender,
            now + XP_COOLDOWN
        )

        ensureDatabases()

        const levels =
            JSON.parse(
                fs.readFileSync(levelsPath)
            )

        const inventory =
            JSON.parse(
                fs.readFileSync(inventoryPath)
            )

        const economy =
            JSON.parse(
                fs.readFileSync(economyPath)
            )

        if (!levels[sender]) levels[sender] = { xp: 0, level: 1 }
        if (!inventory[sender]) inventory[sender] = []
        if (!economy[sender]) economy[sender] = { coins: 0, bank: 0 }

        let xp =
            Math.floor(
                Math.random() * 15
            ) + 5

        const hasBoost =
            inventory[sender].includes('🚀 XP Boost')

        if (hasBoost) {
            xp *= 2
        }

        levels[sender].xp += xp

        let leveledUp = false
        let levelsGained = 0
        let rewards = 0

        while (levelsGained < MAX_LEVELS_PER_MESSAGE) {

            const neededXp =
                levels[sender].level * 100

            if (levels[sender].xp < neededXp) {
                break
            }

            levels[sender].xp -= neededXp
            levels[sender].level += 1
            levelsGained++
            leveledUp = true

            const reward =
                levels[sender].level * 200

            rewards += reward
            economy[sender].coins += reward

        }

        fs.writeFileSync(
            levelsPath,
            JSON.stringify(levels, null, 2)
        )

        fs.writeFileSync(
            economyPath,
            JSON.stringify(economy, null, 2)
        )

        if (!leveledUp) return

        logger.event(
            `LevelUp: ${sender.split('@')[0]} +${levelsGained}`
        )

        if (isLimited(sender, 'commands')) return

        await sock.safeSendMessage(
            from,
            {
                text:
                    ui.success(
                        '¡LEVEL UP!',
                        [
                            ['Usuario', `@${sender.split('@')[0]}`],
                            ['Nivel', `⭐ ${levels[sender].level}`],
                            ['Subiste', `⬆️ +${levelsGained}`],
                            ['Premio', `🪙 +${rewards.toLocaleString()}`],
                            ['XP', `✨ ${levels[sender].xp}`]
                        ]
                    ),
                mentions: [sender]
            }
        )

    } catch (err) {

        logger.error(
            `LevelHandler Error: ${err.message}`
        )

    }

}
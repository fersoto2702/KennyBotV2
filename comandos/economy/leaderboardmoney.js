const fs = require('fs')
const path = require('path')
const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')

const economyPath = path.join(__dirname, '../../database/economy.json')
const iconPath = path.join(__dirname, '../../assets/icons/leaderboardmoney.jpeg')

const MEDALS = ['🥇', '🥈', '🥉']

module.exports = {

    name: 'leaderboardmoney',
    aliases: ['moneylb', 'richest', 'topmoney', 'rich'],
    description: 'Muestra el top de usuarios más ricos',
    category: 'economia',
    cooldown: 10,

    async execute({ sock, from }) {

        try {

            if (!fs.existsSync(economyPath))
                fs.writeFileSync(economyPath, JSON.stringify({}, null, 2))

            let economy = {}
            try { economy = JSON.parse(fs.readFileSync(economyPath)) } catch { economy = {} }

            const users = Object.entries(economy)

            if (users.length === 0)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.info('TOP RICOS', [], 'No hay datos todavía.')
                })

            const fixedUsers = users.map(([id, data]) => {
                if (typeof data.coins !== 'number') data.coins = 0
                if (typeof data.bank !== 'number') data.bank = 0
                return [id, { coins: data.coins, bank: data.bank, total: data.coins + data.bank }]
            })

            fixedUsers.sort((a, b) => b[1].total - a[1].total)

            const top = fixedUsers.slice(0, 10)
            const mentions = top.map(([id]) => id)

            const rows = top.map(([id, data], i) => {
                const medal = MEDALS[i] || `${i + 1}.`
                return `${medal} @${id.split('@')[0]} 💸 ${data.total.toLocaleString()}`
            }).join('\n')

            await sock.sendMessage(from, {
                image: fs.readFileSync(iconPath),
                caption: [`👑 TOP RICOS`, ui.divider, rows, ui.divider].join('\n'),
                mentions
            })

        } catch (err) {
            logger.error(`Error leaderboardmoney: ${err.message}`)
        }

    }

}
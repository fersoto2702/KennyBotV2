const fs = require('fs')
const path = require('path')
const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')

const economyPath = path.join(__dirname, '../../database/economy.json')
const inventoryPath = path.join(__dirname, '../../database/inventory.json')
const levelsPath = path.join(__dirname, '../../database/levels.json')
const iconPath = path.join(__dirname, '../../assets/icons/open.png')

const ITEMS = ['🛡️ Chaleco', '⚔️ Espada', '🚀 XP Boost']
const random = arr => arr[Math.floor(Math.random() * arr.length)]

module.exports = {

    name: 'open',
    aliases: ['box', 'caja', 'lootbox'],
    description: 'Abre una caja misteriosa',
    category: 'economia',
    cooldown: 5,

    async execute({ sock, from, msg }) {

        try {

            const sender = msg.key.participant || msg.key.remoteJid

            for (const file of [economyPath, inventoryPath, levelsPath])
                if (!fs.existsSync(file))
                    fs.writeFileSync(file, JSON.stringify({}, null, 2))

            let economy = {}
            let inventory = {}
            let levels = {}
            try { economy = JSON.parse(fs.readFileSync(economyPath)) } catch { economy = {} }
            try { inventory = JSON.parse(fs.readFileSync(inventoryPath)) } catch { inventory = {} }
            try { levels = JSON.parse(fs.readFileSync(levelsPath)) } catch { levels = {} }

            if (!economy[sender]) economy[sender] = { coins: 0, bank: 0 }
            if (!inventory[sender]) inventory[sender] = []
            if (!levels[sender]) levels[sender] = { xp: 0, level: 1 }
            if (typeof economy[sender].coins !== 'number') economy[sender].coins = 0
            if (typeof economy[sender].bank !== 'number') economy[sender].bank = 0
            if (typeof levels[sender].xp !== 'number') levels[sender].xp = 0
            if (!Array.isArray(inventory[sender])) inventory[sender] = []

            const boxIndex = inventory[sender].indexOf('🎁 Caja misteriosa')

            if (boxIndex === -1)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.error('SIN CAJAS', 'No tienes cajas misteriosas.\n\nCómpralas usando /shop.')
                })

            inventory[sender].splice(boxIndex, 1)

            const rewards = ['coins', 'xp', 'item', 'nothing']
            const reward = random(rewards)

            if (reward === 'coins') {
                const amount = Math.floor(Math.random() * 3000) + 500
                economy[sender].coins += amount
                fs.writeFileSync(economyPath, JSON.stringify(economy, null, 2))
                fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2))
                logger.event(`Caja: ${sender.split('@')[0]} +${amount}`)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.success('CAJA MISTERIOSA', [['Recompensa', `🪙 +${amount.toLocaleString()} monedas`]])
                })
            }

            if (reward === 'xp') {
                const amount = Math.floor(Math.random() * 500) + 100
                levels[sender].xp += amount
                fs.writeFileSync(levelsPath, JSON.stringify(levels, null, 2))
                fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2))
                logger.event(`Caja: ${sender.split('@')[0]} +${amount} XP`)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.success('CAJA MISTERIOSA', [['Recompensa', `✨ +${amount} XP`]])
                })
            }

            if (reward === 'item') {
                const item = random(ITEMS)
                inventory[sender].push(item)
                fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2))
                logger.event(`Caja: ${sender.split('@')[0]} → ${item}`)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.success('CAJA MISTERIOSA', [['Recompensa', item]])
                })
            }

            fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2))
            logger.event(`Caja: ${sender.split('@')[0]} → vacía`)

            await sock.sendMessage(from, {
                image: fs.readFileSync(iconPath),
                caption: ui.warn('CAJA MISTERIOSA', 'La caja estaba vacía... 💀')
            })

        } catch (err) {
            logger.error(`Error open: ${err.message}`)
        }

    }

}
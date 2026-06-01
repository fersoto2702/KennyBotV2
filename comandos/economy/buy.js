const fs = require('fs')
const path = require('path')
const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')

const economyPath = path.join(__dirname, '../../database/economy.json')
const inventoryPath = path.join(__dirname, '../../database/inventory.json')
const iconPath = path.join(__dirname, '../../assets/icons/buy.png')

const items = {
    1: { name: '🛡️ Chaleco', price: 800 },
    2: { name: '⚔️ Espada', price: 1000 },
    3: { name: '💎 VIP', price: 1500 },
    4: { name: '🎁 Caja misteriosa', price: 2000 },
    5: { name: '🚀 XP Boost', price: 2500 }
}

module.exports = {

    name: 'buy',
    aliases: ['comprar'],
    description: 'Compra un item de la tienda',
    category: 'economia',
    cooldown: 5,

    async execute({ sock, from, msg, args }) {

        try {

            const itemId = parseInt(args[0])

            if (!items[itemId])
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.warn('ITEM INVÁLIDO', 'Usa /shop para ver los items disponibles.')
                })

            const item = items[itemId]
            const sender = msg.key.participant || msg.key.remoteJid

            for (const file of [economyPath, inventoryPath])
                if (!fs.existsSync(file))
                    fs.writeFileSync(file, JSON.stringify({}, null, 2))

            let economy = {}
            let inventory = {}
            try { economy = JSON.parse(fs.readFileSync(economyPath)) } catch { economy = {} }
            try { inventory = JSON.parse(fs.readFileSync(inventoryPath)) } catch { inventory = {} }

            if (!economy[sender]) economy[sender] = { coins: 0, bank: 0 }
            if (!inventory[sender]) inventory[sender] = []
            if (typeof economy[sender].coins !== 'number') economy[sender].coins = 0

            if (economy[sender].coins < item.price)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.error('FONDOS INSUFICIENTES', `Necesitas 🪙 ${item.price.toLocaleString()} monedas.`)
                })

            economy[sender].coins -= item.price
            inventory[sender].push(item.name)

            fs.writeFileSync(economyPath, JSON.stringify(economy, null, 2))
            fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2))

            logger.event(`Compra: ${sender.split('@')[0]} → ${item.name}`)

            await sock.sendMessage(from, {
                image: fs.readFileSync(iconPath),
                caption: ui.success('COMPRA REALIZADA', [
                    ['Item', item.name],
                    ['Costo', `🪙 ${item.price.toLocaleString()}`],
                    ['Wallet', `🪙 ${economy[sender].coins.toLocaleString()}`]
                ])
            })

        } catch (err) {
            logger.error(`Error buy: ${err.message}`)
        }

    }

}
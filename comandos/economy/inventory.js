const fs = require('fs')
const path = require('path')
const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')

const inventoryPath = path.join(__dirname, '../../database/inventory.json')
const iconPath = path.join(__dirname, '../../assets/icons/inventory.jpeg')

module.exports = {

    name: 'inventory',
    aliases: ['inv', 'mochila', 'bag'],
    description: 'Muestra tu inventario de items',
    category: 'economia',
    cooldown: 3,

    async execute({ sock, from, msg }) {

        try {

            if (!fs.existsSync(inventoryPath))
                fs.writeFileSync(inventoryPath, JSON.stringify({}, null, 2))

            let inventory = {}
            try { inventory = JSON.parse(fs.readFileSync(inventoryPath)) } catch { inventory = {} }

            const sender = msg.key.participant || msg.key.remoteJid

            if (!inventory[sender]) inventory[sender] = []
            if (!Array.isArray(inventory[sender])) inventory[sender] = []

            const items = inventory[sender]

            if (items.length === 0)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.warn('INVENTARIO VACÍO', 'No tienes items guardados.')
                })

            let list = ''
            items.forEach((item, index) => { list += `${index + 1}. ${item}\n` })

            await sock.sendMessage(from, {
                image: fs.readFileSync(iconPath),
                caption: ui.info('INVENTARIO', [['Items', `${items.length}`]], `\n${list}`)
            })

        } catch (err) {
            logger.error(`Error inventory: ${err.message}`)
        }

    }

}
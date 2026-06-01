const fs = require('fs')
const path = require('path')
const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')

const iconPath = path.join(__dirname, '../../assets/icons/shop.png')

const ITEMS = [
    { id: 1, name: '🛡️ Chaleco', desc: 'Protege de robos', price: 800 },
    { id: 2, name: '⚔️ Espada', desc: 'Mejora tus robos', price: 1000 },
    { id: 3, name: '💎 VIP', desc: 'Beneficios especiales', price: 1500 },
    { id: 4, name: '🎁 Caja misteriosa', desc: 'Recompensa aleatoria', price: 2000 },
    { id: 5, name: '🚀 XP Boost', desc: 'Más XP por mensajes', price: 2500 }
]

module.exports = {

    name: 'shop',
    aliases: ['tienda', 'store'],
    description: 'Muestra la tienda de items',
    category: 'economia',
    cooldown: 3,

    async execute({ sock, from }) {

        try {

            const rows = ITEMS.map(item => [
                `╭─ ${item.id}. ${item.name}`,
                `│ 📝 ${item.desc}`,
                `│ 💰 🪙 ${item.price.toLocaleString()}`,
                `╰──────────────`
            ].join('\n')).join('\n')

            await sock.sendMessage(from, {
                image: fs.readFileSync(iconPath),
                caption: [
                    `🛒 TIENDA OFICIAL`,
                    ui.divider,
                    rows,
                    ui.divider,
                    `📦 Items disponibles: ${ITEMS.length}`,
                    `💡 Comprar: /buy número`
                ].join('\n')
            })

        } catch (err) {
            logger.error(`Error shop: ${err.message}`)
        }

    }

}
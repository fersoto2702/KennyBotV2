const fs = require('fs')
const path = require('path')
const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')

const economyPath = path.join(__dirname, '../../database/economy.json')
const iconPath = path.join(__dirname, '../../assets/icons/pay.jpeg')

module.exports = {

    name: 'pay',
    aliases: ['transfer', 'sendmoney'],
    description: 'Transfiere monedas a otro usuario',
    category: 'economia',
    cooldown: 10,

    async execute({ sock, from, msg, args }) {

        try {

            const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

            if (!target)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.warn('USO INCORRECTO', 'Uso: /pay @usuario cantidad')
                })

            const amount = parseInt(args[1])

            if (isNaN(amount) || amount <= 0)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.warn('CANTIDAD INVÁLIDA', 'Uso: /pay @usuario cantidad')
                })

            const sender = msg.key.participant || msg.key.remoteJid

            if (sender === target)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.error('ACCIÓN INVÁLIDA', 'No puedes transferirte monedas a ti mismo.')
                })

            const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net'

            if (target === botNumber)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.warn('ACCIÓN INVÁLIDA', 'No puedes transferir monedas al bot.')
                })

            if (!fs.existsSync(economyPath))
                fs.writeFileSync(economyPath, JSON.stringify({}, null, 2))

            let economy = {}
            try { economy = JSON.parse(fs.readFileSync(economyPath)) } catch { economy = {} }

            if (!economy[sender]) economy[sender] = { coins: 0, bank: 0 }
            if (!economy[target]) economy[target] = { coins: 0, bank: 0 }

            for (const user of [sender, target]) {
                if (typeof economy[user].coins !== 'number') economy[user].coins = 0
                if (typeof economy[user].bank !== 'number') economy[user].bank = 0
            }

            if (economy[sender].coins < amount)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.error('FONDOS INSUFICIENTES', `Solo tienes 🪙 ${economy[sender].coins.toLocaleString()}.`)
                })

            economy[sender].coins -= amount
            economy[target].coins += amount
            fs.writeFileSync(economyPath, JSON.stringify(economy, null, 2))
            logger.event(`Pay: ${sender.split('@')[0]} → ${target.split('@')[0]} ${amount}`)

            await sock.sendMessage(from, {
                image: fs.readFileSync(iconPath),
                caption: ui.success('TRANSFERENCIA REALIZADA', [
                    ['De', `@${sender.split('@')[0]}`],
                    ['Para', `@${target.split('@')[0]}`],
                    ['Cantidad', `🪙 ${amount.toLocaleString()}`]
                ]),
                mentions: [sender, target]
            })

        } catch (err) {
            logger.error(`Error pay: ${err.message}`)
        }

    }

}
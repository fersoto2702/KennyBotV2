const fs = require('fs')
const path = require('path')
const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')

const economyPath = path.join(__dirname, '../../database/economy.json')
const iconPath = path.join(__dirname, '../../assets/icons/deposit.png')

module.exports = {

    name: 'deposit',
    aliases: ['dep', 'bank'],
    description: 'Deposita monedas en el banco',
    category: 'economia',
    cooldown: 5,

    async execute({ sock, from, msg, args }) {

        try {

            const amount = parseInt(args[0])

            if (isNaN(amount) || amount <= 0)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.warn('CANTIDAD INVÁLIDA', 'Uso: /deposit cantidad')
                })

            const sender = msg.key.participant || msg.key.remoteJid

            if (!fs.existsSync(economyPath))
                fs.writeFileSync(economyPath, JSON.stringify({}, null, 2))

            let economy = {}
            try { economy = JSON.parse(fs.readFileSync(economyPath)) } catch { economy = {} }

            if (!economy[sender]) economy[sender] = { coins: 0, bank: 0 }
            if (typeof economy[sender].coins !== 'number') economy[sender].coins = 0
            if (typeof economy[sender].bank !== 'number') economy[sender].bank = 0

            if (economy[sender].coins < amount)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.error('FONDOS INSUFICIENTES', 'No tienes suficientes monedas.')
                })

            economy[sender].coins -= amount
            economy[sender].bank += amount
            fs.writeFileSync(economyPath, JSON.stringify(economy, null, 2))
            logger.event(`Deposit: ${sender.split('@')[0]} → ${amount}`)

            await sock.sendMessage(from, {
                image: fs.readFileSync(iconPath),
                caption: ui.success('DEPÓSITO REALIZADO', [
                    ['Depositado', `🪙 ${amount.toLocaleString()}`],
                    ['Wallet', `🪙 ${economy[sender].coins.toLocaleString()}`],
                    ['Banco', `🏦 ${economy[sender].bank.toLocaleString()}`]
                ])
            })

        } catch (err) {
            logger.error(`Error deposit: ${err.message}`)
        }

    }

}
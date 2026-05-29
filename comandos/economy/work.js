const fs = require('fs')
const path = require('path')
const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')

const economyPath = path.join(
    __dirname,
    '../../database/economy.json'
)

const cooldowns = new Map()

const JOBS = [
    'Programador 💻',
    'Taxista 🚕',
    'Doctor 🩺',
    'Policía 👮',
    'Chef 👨‍🍳',
    'Streamer 🎮',
    'Youtuber 📹',
    'Hacker 🖥️'
]

const random = arr =>
    arr[Math.floor(Math.random() * arr.length)]

module.exports = {
    name: 'work',
    aliases: ['trabajar', 'job'],
    description: 'Trabaja para ganar monedas',
    category: 'economia',

    async execute({ sock, from, msg }) {
        try {
            const sender =
                msg.key.participant ||
                msg.key.remoteJid

            const now = Date.now()
            const cooldownTime = 60 * 60 * 1000

            if (cooldowns.has(sender)) {
                const expires = cooldowns.get(sender)
                if (now < expires) {
                    const mins = Math.ceil((expires - now) / 60000)
                    return await sock.sendMessage(
                        from,
                        {
                            text: ui.warn(
                                'YA TRABAJASTE',
                                `Vuelve en ${mins} minutos.`
                            )
                        }
                    )
                }
            }

            cooldowns.set(sender, now + cooldownTime)

            if (!fs.existsSync(economyPath)) {
                fs.writeFileSync(
                    economyPath,
                    JSON.stringify({}, null, 2)
                )
            }

            let economy = {}
            try {
                economy = JSON.parse(
                    fs.readFileSync(economyPath)
                )
            } catch {
                economy = {}
            }

            if (!economy[sender]) {
                economy[sender] = {
                    coins: 0,
                    bank: 0
                }
            }

            if (typeof economy[sender].coins !== 'number') {
                economy[sender].coins = 0
            }

            if (typeof economy[sender].bank !== 'number') {
                economy[sender].bank = 0
            }

            const job = random(JOBS)
            const amount = Math.floor(Math.random() * 500) + 100

            economy[sender].coins += amount

            fs.writeFileSync(
                economyPath,
                JSON.stringify(economy, null, 2)
            )

            logger.event(
                `Work: ${sender.split('@')[0]} +${amount} (${job})`
            )

            await sock.sendMessage(
                from,
                {
                    text: ui.success(
                        'TRABAJO COMPLETADO',
                        [
                            ['Usuario', `@${sender.split('@')[0]}`],
                            ['Trabajo', job],
                            ['Ganancia', `${amount} monedas`]
                        ]
                    )
                }
            )
        } catch (err) {
            logger.error(err)
        }
    }
}

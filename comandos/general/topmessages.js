const fs = require('fs')
const path = require('path')
const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')
const { getTopMessages } = require('../../src/database/mysql')

const iconPath = path.join(__dirname, '../../assets/icons/topmessages.jpeg')

const MEDALS = ['🥇', '🥈', '🥉']

module.exports = {

    name: 'topmessages',
    aliases: ['topmsg', 'activostop'],
    description: 'Muestra los usuarios más activos',
    category: 'general',
    cooldown: 10,

    async execute({ sock, from, args }) {

        try {

            if (!from.endsWith('@g.us'))
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.error('SOLO GRUPOS', 'Este comando solo funciona en grupos.')
                })

            const days = parseInt(args[0]) || 7

            if (days < 1 || days > 365)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.warn('DÍAS INVÁLIDOS', 'Usa un número entre 1 y 365.\nEjemplo: /topmessages 30')
                })

            const users = await getTopMessages(from, days, 10)

            if (!users || users.length === 0)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.warn('SIN DATOS', `No hay estadísticas de los últimos ${days} días.`)
                })

            const mentions = users.map(u => u.usuario)

            const rows = users.map((u, i) => {
                const medal = MEDALS[i] || `${i + 1}.`
                return `${medal} @${u.usuario.split('@')[0]}\n│ 💬 ${Number(u.total).toLocaleString()} mensajes`
            }).join('\n' + ui.divider + '\n')

            await sock.sendMessage(from, {
                image: fs.readFileSync(iconPath),
                caption: [
                    `⟨ USUARIOS MÁS ACTIVOS ⟩`,
                    `📅 Últimos ${days} días`,
                    ui.divider,
                    rows,
                    ui.divider
                ].join('\n'),
                mentions
            })

        } catch (err) {
            logger.error(`TopMessages Error: ${err.message}`)
        }

    }

}
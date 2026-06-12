const fs = require('fs')
const path = require('path')
const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')
const { getInactive } = require('../../src/database/mysql')

const iconPath = path.join(__dirname, '../../assets/icons/inactive.jpeg')

const formatTime = ms => {
    const mins = Math.floor(ms / 60000)
    const hours = Math.floor(mins / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}d`
    if (hours > 0) return `${hours}h`
    return `${mins}m`
}

module.exports = {

    name: 'inactive',
    aliases: ['inactivos', 'deadchat'],
    description: 'Muestra los usuarios menos activos',
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
                    caption: ui.warn('DÍAS INVÁLIDOS', 'Usa un número entre 1 y 365.\nEjemplo: /inactive 30')
                })

            const users = await getInactive(from, days, 10)

            if (!users || users.length === 0)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.warn('SIN DATOS', `No hay estadísticas de los últimos ${days} días.`)
                })

            const mentions = users.map(u => u.usuario)

            const rows = users.map(u => {
                const inactiveMs = Date.now() - Number(u.ultimo)
                return `💀 @${u.usuario.split('@')[0]}\n│ 💬 ${Number(u.total).toLocaleString()} mensajes\n│ ⏱ Hace ${formatTime(inactiveMs)}`
            }).join('\n' + ui.divider + '\n')

            await sock.sendMessage(from, {
                image: fs.readFileSync(iconPath),
                caption: [
                    `⟨ USUARIOS MÁS INACTIVOS ⟩`,
                    `📅 Últimos ${days} días`,
                    ui.divider,
                    rows,
                    ui.divider
                ].join('\n'),
                mentions
            })

        } catch (err) {
            logger.error(`Inactive Error: ${err.message}`)
        }

    }

}
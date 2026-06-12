const fs = require('fs')
const path = require('path')
const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')
const { getUserStats } = require('../../src/database/mysql')

const iconPath = path.join(__dirname, '../../assets/icons/msgstats.jpeg')

const formatTime = ms => {
    const mins = Math.floor(ms / 60000)
    const hours = Math.floor(mins / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}d`
    if (hours > 0) return `${hours}h`
    return `${mins}m`
}

module.exports = {

    name: 'msgstats',
    aliases: ['messages', 'actividad'],
    description: 'Muestra estadísticas de mensajes',
    category: 'general',
    cooldown: 5,

    async execute({ sock, from, msg, args }) {

        try {

            if (!from.endsWith('@g.us'))
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.error('SOLO GRUPOS', 'Este comando solo funciona en grupos.')
                })

            const target =
                msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
                msg.key.participant ||
                msg.key.remoteJid

            const days = parseInt(args[0]) || 7

            if (days < 1 || days > 365)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.warn('DÍAS INVÁLIDOS', 'Usa un número entre 1 y 365.\nEjemplo: /msgstats 30')
                })

            const stats = await getUserStats(from, target, days)

            if (!stats.total)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.warn('SIN DATOS', `Ese usuario no tiene estadísticas de los últimos ${days} días.`)
                })

            const inactiveMs = stats.ultimo ? Date.now() - Number(stats.ultimo) : null

            await sock.sendMessage(from, {
                image: fs.readFileSync(iconPath),
                caption: ui.info('ESTADÍSTICAS', [
                    ['Usuario', `@${target.split('@')[0]}`],
                    ['Mensajes', `💬 ${Number(stats.total).toLocaleString()}`],
                    ['Posición', `🏆 #${stats.position}`],
                    ['Período', `📅 ${days} días`],
                    ['Último msg', inactiveMs ? `⏱ Hace ${formatTime(inactiveMs)}` : 'Sin datos']
                ]),
                mentions: [target]
            })

        } catch (err) {
            logger.error(`MsgStats Error: ${err.message}`)
        }

    }

}
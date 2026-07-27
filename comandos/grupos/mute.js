const fs = require('fs')
const path = require('path')
const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')

const mutePath = path.join(__dirname, '../../database/mute.json')
const iconPath = path.join(__dirname, '../../assets/icons/mute.jpeg')

module.exports = {

    name: 'mute',
    aliases: ['silenciar', 'mutear'],
    description: 'Silencia a un usuario del grupo (borra sus mensajes)',
    category: 'grupos',
    adminOnly: true,
    groupOnly: true,

    async execute({ sock, from, args, msg }) {

        try {

            if (!fs.existsSync(mutePath))
                fs.writeFileSync(mutePath, JSON.stringify({}, null, 2))

            let data = {}
            try {
                data = JSON.parse(fs.readFileSync(mutePath))
                if (typeof data !== 'object' || Array.isArray(data)) data = {}
            } catch { data = {} }

            const metadata = await sock.groupMetadata(from)
            const participants = metadata.participants
            const sender = msg.key.participant || msg.participant
            const senderData = participants.find(p => p.id === sender)
            const isAdmin = senderData?.admin === 'admin' || senderData?.admin === 'superadmin'

            if (!isAdmin)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.error('ACCESO DENEGADO', 'Solo administradores pueden usar este comando.')
                })

            const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

            const target = mentioned || (args[0] ? `${args[0].replace(/[^0-9]/g, '')}@s.whatsapp.net` : null)

            if (!target)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.error('FALTA USUARIO', 'Menciona a alguien.\nUso:\n.mute @usuario\n.mute @usuario off')
                })

            if (!data[from]) data[from] = []

            const option = args[args.length - 1]?.toLowerCase()?.trim()

            if (option === 'off') {

                data[from] = data[from].filter(id => id !== target)
                fs.writeFileSync(mutePath, JSON.stringify(data, null, 2))
                logger.event(`Unmute: ${target.split('@')[0]} en ${from.split('@')[0]}`)

                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.success('USUARIO ACTIVADO', [['Usuario', `@${target.split('@')[0]}`], ['Estado', '○ MUTE DESACTIVADO']]),
                    mentions: [target]
                })

            }

            if (!data[from].includes(target)) data[from].push(target)
            fs.writeFileSync(mutePath, JSON.stringify(data, null, 2))
            logger.event(`Mute: ${target.split('@')[0]} en ${from.split('@')[0]}`)

            await sock.sendMessage(from, {
                image: fs.readFileSync(iconPath),
                caption: ui.success('USUARIO SILENCIADO', [['Usuario', `@${target.split('@')[0]}`], ['Estado', '● MUTE ACTIVADO']]),
                mentions: [target]
            })

        } catch (err) {
            logger.error(`Error mute: ${err.message}`)
        }

    }

}
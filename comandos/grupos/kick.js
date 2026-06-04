const fs = require('fs')
const path = require('path')
const isGroupAdmin = require('../../src/utils/isAdmin')
const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')

const iconPath = path.join(__dirname, '../../assets/icons/kick.png')

module.exports = {

    name: 'kick',
    aliases: ['expulsar', 'remove'],
    description: 'Expulsa a un usuario del grupo',
    category: 'grupos',
    adminOnly: true,
    groupOnly: true,

    async execute({ sock, from, msg }) {

        try {

            const sender = msg.key.participant || msg.participant
            const admin = await isGroupAdmin(sock, from, sender)

            if (!admin)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.error('ACCESO DENEGADO', 'Solo administradores pueden usar este comando.')
                })

            const metadata = await sock.groupMetadata(from)
            const participants = metadata.participants
            const botId = sock.user.id.split(':')[0]
            const botData = participants.find(p => p.id.includes(botId))
            const botAdmin = botData?.admin === 'admin' || botData?.admin === 'superadmin'

            if (!botAdmin)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.error('BOT SIN PERMISOS', 'El bot necesita ser administrador.')
                })

            const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

            if (!target)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.warn('USUARIO REQUERIDO', 'Uso: /kick @usuario')
                })

            const targetData = participants.find(p => p.id === target)

            if (!targetData)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.error('USUARIO NO ENCONTRADO', 'Ese usuario no está en el grupo.')
                })

            if (sender === target)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.warn('ACCIÓN INVÁLIDA', 'No puedes expulsarte a ti mismo.')
                })

            const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net'

            if (target === botJid)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.warn('ACCIÓN INVÁLIDA', 'No puedes expulsar al bot.')
                })

            const targetAdmin = await isGroupAdmin(sock, from, target)

            if (targetAdmin)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.error('ACCIÓN INVÁLIDA', 'No puedes expulsar a un administrador.')
                })

            if (targetData?.admin === 'superadmin')
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.error('ACCIÓN INVÁLIDA', 'No puedes expulsar al creador del grupo.')
                })

            const response = await sock.groupParticipantsUpdate(from, [target], 'remove')
            const result = response?.[0]

            if (result?.status && result.status !== '200')
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.error('NO SE PUDO EXPULSAR', `Código: ${result.status}`)
                })

            logger.event(`Kick: ${target.split('@')[0]} de ${from.split('@')[0]}`)

            await sock.sendMessage(from, {
                image: fs.readFileSync(iconPath),
                caption: ui.success('USUARIO EXPULSADO', [['Usuario', `@${target.split('@')[0]}`]]),
                mentions: [target]
            })

        } catch (err) {
            logger.error(`Error kick: ${err.message}`)
        }

    }

}
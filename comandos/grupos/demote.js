const fs = require('fs')
const path = require('path')
const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')

const iconPath = path.join(__dirname, '../../assets/icons/demote.png')

module.exports = {

    name: 'demote',
    aliases: ['degradar', 'unadmin'],
    description: 'Quita el rol de administrador a un usuario',
    category: 'grupos',
    adminOnly: true,
    groupOnly: true,

    async execute({ sock, from, msg }) {

        try {

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
                    caption: ui.warn('USUARIO REQUERIDO', 'Uso: /demote @usuario')
                })

            if (target === sender)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.warn('ACCIÓN INVÁLIDA', 'No puedes degradarte a ti mismo.')
                })

            const targetData = participants.find(p => p.id === target)

            if (!targetData)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.error('USUARIO NO ENCONTRADO', 'Ese usuario no está en el grupo.')
                })

            const targetAdmin = targetData?.admin === 'admin' || targetData?.admin === 'superadmin'

            if (!targetAdmin)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.warn('SIN RANGO', 'Ese usuario no es administrador.')
                })

            if (targetData?.admin === 'superadmin')
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.error('ACCIÓN INVÁLIDA', 'No puedes quitarle rango al creador del grupo.')
                })

            await sock.groupParticipantsUpdate(from, [target], 'demote')
            logger.event(`Demote: ${target.split('@')[0]} degradado en ${from.split('@')[0]}`)

            await sock.sendMessage(from, {
                image: fs.readFileSync(iconPath),
                caption: ui.success('USUARIO DEGRADADO', [
                    ['Usuario', `@${target.split('@')[0]}`],
                    ['Nuevo rango', '○ Miembro']
                ]),
                mentions: [target]
            })

        } catch (err) {
            logger.error(`Error demote: ${err.message}`)
        }

    }

}
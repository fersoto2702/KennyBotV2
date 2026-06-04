const fs = require('fs')
const path = require('path')
const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')

const iconPath = path.join(__dirname, '../../assets/icons/promote.png')

module.exports = {

    name: 'promote',
    aliases: ['promover', 'admin'],
    description: 'Promueve a un usuario a administrador',
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
                    caption: ui.warn('USUARIO REQUERIDO', 'Uso: /promote @usuario')
                })

            if (target === sender)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.warn('ACCIÓN INVÁLIDA', 'No puedes promoverte a ti mismo.')
                })

            const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net'

            if (target === botJid)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.warn('ACCIÓN INVÁLIDA', 'El bot ya tiene permisos.')
                })

            const targetData = participants.find(p => p.id === target)

            if (!targetData)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.error('USUARIO NO ENCONTRADO', 'Ese usuario no está en el grupo.')
                })

            const targetAdmin = targetData?.admin === 'admin' || targetData?.admin === 'superadmin'

            if (targetAdmin)
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.warn('YA ES ADMIN', 'Ese usuario ya es administrador.')
                })

            const response = await sock.groupParticipantsUpdate(from, [target], 'promote')
            const result = response?.[0]

            if (result?.status && result.status !== '200')
                return await sock.sendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.error('NO SE PUDO PROMOVER', `Código: ${result.status}`)
                })

            logger.event(`Promote: ${target.split('@')[0]} en ${from.split('@')[0]}`)

            await sock.sendMessage(from, {
                image: fs.readFileSync(iconPath),
                caption: ui.success('NUEVO ADMINISTRADOR', [
                    ['Usuario', `@${target.split('@')[0]}`],
                    ['Rango', '👑 Administrador']
                ]),
                mentions: [target]
            })

        } catch (err) {
            logger.error(`Error promote: ${err.message}`)
        }

    }

}
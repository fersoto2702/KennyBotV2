const fs = require('fs')
const path = require('path')
const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')

const dbPath = path.join(__dirname, '../../database/soloadmins.json')

module.exports = {

    name: 'admins',
    aliases: ['adminmode', 'onlyadmin'],
    description: 'Restringe el uso del bot solo a administradores',
    category: 'grupos',
    adminOnly: true,
    groupOnly: true,

    async execute({ sock, from, args, msg }) {

        try {

            if (!fs.existsSync(dbPath))
                fs.writeFileSync(dbPath, JSON.stringify([], null, 2))

            let data = []
            try {
                data = JSON.parse(fs.readFileSync(dbPath))
                if (!Array.isArray(data)) data = []
            } catch { data = [] }

            const metadata = await sock.groupMetadata(from)
            const participants = metadata.participants
            const sender = msg.key.participant || msg.participant
            const senderData = participants.find(p => p.id === sender)
            const isAdmin = senderData?.admin === 'admin' || senderData?.admin === 'superadmin'

            if (!isAdmin)
                return await sock.sendMessage(from, {
                    text: ui.error('ACCESO DENEGADO', 'Solo administradores pueden usar este comando.')
                })

            const option = args[0]?.toLowerCase()?.trim()

            if (option === 'on') {

                if (!data.includes(from)) data.push(from)
                fs.writeFileSync(dbPath, JSON.stringify(data, null, 2))
                logger.event(`Admins ON: ${from.split('@')[0]}`)

                return await sock.sendMessage(from, {
                    text: ui.success('MODO SOLO ADMINS', [['Estado', '● ACTIVADO']])
                })

            }

            if (option === 'off') {

                data = data.filter(id => id !== from)
                fs.writeFileSync(dbPath, JSON.stringify(data, null, 2))
                logger.event(`Admins OFF: ${from.split('@')[0]}`)

                return await sock.sendMessage(from, {
                    text: ui.success('MODO SOLO ADMINS', [['Estado', '○ DESACTIVADO']])
                })

            }

            const enabled = data.includes(from)

            await sock.sendMessage(from, {
                text: ui.info('MODO SOLO ADMINS', [
                    ['Estado', enabled ? '● ACTIVADO' : '○ DESACTIVADO']
                ], 'Uso:\n.soloadmins on\n.soloadmins off')
            })

        } catch (err) {

            logger.error(`Error admins: ${err.message}`)

        }

    }

}
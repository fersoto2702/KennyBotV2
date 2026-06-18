const fs = require('fs')
const path = require('path')
const isGroupAdmin = require('../../src/utils/isAdmin')
const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')
const { PhoneNumberUtil } = require('google-libphonenumber')

const phoneUtil = PhoneNumberUtil.getInstance()
const iconPath = path.join(__dirname, '../../assets/icons/tagall.jpeg')
const MAX_MENTIONS = 200

function isoToFlag(iso) {
    if (!iso || iso.length !== 2) return '🌐'
    return [...iso.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0))).join('')
}

function getFlag(jid) {
    try {
        const number = jid.split('@')[0]
        const parsed = phoneUtil.parse('+' + number)
        const regionCode = phoneUtil.getRegionCodeForNumber(parsed)
        return isoToFlag(regionCode)
    } catch { return '🌐' }
}

module.exports = {

    name: 'tagall',
    aliases: ['todos', 'notifyall'],
    description: 'Menciona a todos los miembros del grupo',
    category: 'grupos',
    adminOnly: true,
    groupOnly: true,

    async execute({ sock, from, msg }) {

        try {

            await sock.sendPresenceUpdate('composing', from)

            const sender = msg.key.participant || msg.participant
            const admin = await isGroupAdmin(sock, from, sender)

            if (!admin)
                return await sock.safeSendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.error('ACCESO DENEGADO', 'Solo administradores pueden usar este comando.')
                })

            const metadata = await sock.groupMetadata(from)
            const participants = metadata.participants || []
            const groupName = metadata.subject || 'Grupo sin nombre'

            if (participants.length === 0)
                return await sock.safeSendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.warn('GRUPO VACÍO', 'No hay participantes.')
                })

            const limitedParticipants = participants.slice(0, MAX_MENTIONS)
            const admins = limitedParticipants.filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            const members = limitedParticipants.filter(p => !p.admin)
            const mentions = limitedParticipants.map(p => p.phoneNumber || p.id)

            const adminList = admins.length
                ? admins.map(p => { const jid = p.phoneNumber || p.id; return `👑 ${getFlag(jid)} @${jid.split('@')[0]}` }).join('\n')
                : 'Sin admins'

            const memberList = members.length
                ? members.map(p => { const jid = p.phoneNumber || p.id; return `👤 ${getFlag(jid)} @${jid.split('@')[0]}` }).join('\n')
                : 'Sin miembros'

            await sock.safeSendMessage(from, {
    text: [
        `📢 TAGALL`,
        ui.divider,
        `*🏷️ Grupo*: *${groupName}*`,
        `*👥 Miembros*: *${participants.length}*`,
        `*👑 Admins*: *${admins.length}*`,
        ui.divider,
        `👑 ADMINISTRADORES\n`,
        adminList,
        ui.divider,
        `👥 MIEMBROS\n`,
        memberList,
        ui.divider,
        participants.length > MAX_MENTIONS
            ? `⚠️ Solo se mencionaron ${MAX_MENTIONS} usuarios.`
            : ''
    ].join('\n'),
    mentions
})

            logger.event(`Tagall usado: ${from.split('@')[0]}`)

        } catch (err) {
            logger.error(`Error tagall: ${err.message}`)
            try {
                await sock.safeSendMessage(from, {
                    image: fs.readFileSync(iconPath),
                    caption: ui.error('ERROR', 'No se pudo ejecutar el tagall.')
                })
            } catch {}
        }

    }

}
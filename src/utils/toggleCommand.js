const {
    isEnabled,
    setToggle
} = require('./toggles')

const isGroupAdmin = require('./isAdmin')
const logger = require('./logger')
const ui = require('./ui')

function createToggleCommand({
    name,
    description,
    emoji,
    category = 'configuración',
    aliases = []
}) {
    if (!name) {
        throw new Error('Toggle command requiere name')
    }

    return {
        name,
        description,
        category,
        aliases,
        adminOnly: true,
        groupOnly: true,
        cooldown: 3,

        async execute({ sock, from, args, msg }) {
            try {
                if (!from || !from.endsWith('@g.us')) {
                    return await sock.sendMessage(from, {
                        text: ui.error('SOLO GRUPOS', 'Este comando solo funciona en grupos.')
                    })
                }

                const sender = msg.key.participant || msg.participant || msg.key.remoteJid

                if (!sender) {
                    return await sock.sendMessage(from, {
                        text: ui.error('ERROR DE USUARIO', 'No se pudo identificar al usuario que ejecutó el comando.')
                    })
                }

                const admin = await isGroupAdmin(sock, from, sender)

                if (!admin) {
                    return await sock.sendMessage(from, {
                        text: ui.error('ACCESO DENEGADO', 'Solo administradores pueden usar este comando.')
                    })
                }

                const option = String(args?.[0] || '')
                    .toLowerCase()
                    .trim()

                if (option !== 'on' && option !== 'off') {
                    const enabled = isEnabled(from, name)
                    const status = enabled ? 'ACTIVADO' : 'DESACTIVADO'

                    const text = ui.info(
                        `${emoji || '⚙️'} ${name.toUpperCase()}`,
                        [['Estado', status]],
                        `Uso: /${name} on · /${name} off`
                    )

                    return await sock.sendMessage(from, { text })
                }

                const enabled = option === 'on'
                setToggle(from, name, enabled)

                logger.event(`${name} ${enabled ? 'activado' : 'desactivado'} por ${sender.split('@')[0]} → ${from.split('@')[0]}`)

                const status = enabled ? 'ACTIVADO' : 'DESACTIVADO'
                const footer = enabled
                    ? `${name.toUpperCase()} ahora está activo en este grupo.`
                    : `${name.toUpperCase()} ahora está desactivado en este grupo.`

                const text = ui.success(
                    `${emoji || '⚙️'} ${name.toUpperCase()}`,
                    [
                        ['Estado', status],
                        ['Modificado por', `@${sender.split('@')[0]}`]
                    ],
                    footer
                )

                return await sock.sendMessage(from, {
                    text,
                    mentions: [sender]
                })
            } catch (err) {
                logger.error(`Toggle Error (${name}): ${err.stack || err.message}`)

                try {
                    await sock.sendMessage(from, {
                        text: ui.error('ERROR INTERNO', `No se pudo actualizar ${name}.`)
                    })
                } catch {
                    // Evita otro error si falla el mensaje de error.
                }
            }
        }
    }
}

module.exports = {
    createToggleCommand
}
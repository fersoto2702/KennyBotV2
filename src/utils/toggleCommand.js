const fs =
require('fs')

const path =
require('path')

const {
isEnabled,
setToggle
} = require('./toggles')

const isGroupAdmin =
require('./isAdmin')

const logger =
require('./logger')

const ui =
require('./ui')

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

    async execute({
        sock,
        from,
        args,
        msg
    }) {

        try {

            if (!from || !from.endsWith('@g.us')) {

                return await sock.sendMessage(from, {
                    text: ui.error(
                        'SOLO GRUPOS',
                        'Este comando solo funciona en grupos.'
                    )
                })

            }

            const sender =
                msg.key.participant ||
                msg.participant ||
                msg.key.remoteJid

            const admin =
                await isGroupAdmin(
                    sock,
                    from,
                    sender
                )

            if (!admin) {

                return await sock.sendMessage(from, {
                    text: ui.error(
                        'ACCESO DENEGADO',
                        'Solo administradores pueden usar este comando.'
                    )
                })

            }

            const option =
                String(args?.[0] || '')
                .toLowerCase()
                .trim()

            const iconPath =
                path.join(
                    __dirname,
                    '../../assets/icons',
                    `${name}.jpeg`
                )

            const hasIcon =
                fs.existsSync(iconPath)

            if (option !== 'on' && option !== 'off') {

                const enabled =
                    isEnabled(from, name)

                const caption =
                    ui.info(
                        `${emoji || '⚙️'} ${name.toUpperCase()}`,
                        [
                            [
                                'Estado',
                                enabled
                                    ? '● ACTIVADO'
                                    : '○ DESACTIVADO'
                            ]
                        ],
                        `Uso: /${name} on · /${name} off`
                    )

                return await sock.sendMessage(
                    from,
                    hasIcon
                        ? {
                            image: fs.readFileSync(iconPath),
                            caption
                        }
                        : {
                            text: caption
                        }
                )

            }

            const enabled =
                option === 'on'

            setToggle(from, name, enabled)

            logger.event(
                `${name} ${enabled ? 'activado' : 'desactivado'} → ${from.split('@')[0]}`
            )

            const caption =
                ui.success(
                    `${emoji || '⚙️'} ${name.toUpperCase()}`,
                    [
                        [
                            'Estado',
                            enabled
                                ? '● ACTIVADO'
                                : '○ DESACTIVADO'
                        ],
                        [
                            'Modificado por',
                            `@${sender.split('@')[0]}`
                        ]
                    ]
                )

            await sock.sendMessage(
                from,
                hasIcon
                    ? {
                        image: fs.readFileSync(iconPath),
                        caption,
                        mentions: [sender]
                    }
                    : {
                        text: caption,
                        mentions: [sender]
                    }
            )

        } catch (err) {

            logger.error(
                `Toggle Error (${name}): ${err.message}`
            )

            try {

                await sock.sendMessage(from, {
                    text: ui.error(
                        'ERROR',
                        `No se pudo actualizar ${name}.`
                    )
                })

            } catch {}

        }

    }

}

}

module.exports = {
createToggleCommand
}

const fs =
    require('fs')

const path =
    require('path')

const isGroupAdmin =
    require('../../src/utils/isAdmin')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const joinPath =
    path.join(
        __dirname,
        '../../database/joinMessages.json'
    )

const MAX_MESSAGES = 15

module.exports = {

    name:
        'listjoinmsg',

    aliases: [
        'joinmsgs',
        'listwelcome',
        'welcomelist'
    ],

    description:
        'Lista los mensajes de bienvenida configurados',

    category:
        'bienvenida',

    adminOnly: true,

    groupOnly: true,

    async execute({
        sock,
        from,
        msg
    }) {

        try {

            if (!from.endsWith('@g.us')) {

                return await sock.sendMessage(
                    from,
                    {
                        text:
                            ui.error(
                                'SOLO GRUPOS',
                                'Este comando solo funciona en grupos.'
                            )
                    }
                )

            }

            const sender =
                msg.key.participant ||
                msg.participant

            const admin =
                await isGroupAdmin(
                    sock,
                    from,
                    sender
                )

            if (!admin) {

                return await sock.sendMessage(
                    from,
                    {
                        text:
                            ui.error(
                                'ACCESO DENEGADO',
                                'Solo administradores pueden usar este comando.'
                            )
                    }
                )

            }

            if (!fs.existsSync(joinPath)) {
                fs.writeFileSync(
                    joinPath,
                    JSON.stringify({}, null, 2)
                )
            }

            let data = {}

            try {

                data =
                    JSON.parse(
                        fs.readFileSync(joinPath)
                    )

                if (typeof data !== 'object') {
                    data = {}
                }

            } catch {
                data = {}
            }

            if (!Array.isArray(data[from])) {
                data[from] = []
            }

            if (data[from].length === 0) {

                return await sock.sendMessage(
                    from,
                    {
                        text:
                            ui.warn(
                                'SIN MENSAJES',
                                'No hay mensajes de bienvenida.\n\nUsa /addjoinmsg para agregar uno.'
                            )
                    }
                )

            }

            const rows =
                data[from].map(
                    (message, i) => {

                        const preview =
                            message.length > 50
                                ? message.slice(0, 50) + '...'
                                : message

                        return `│ *${i + 1}.* ${preview}`

                    }
                ).join('\n')

            logger.event(
                `JoinMsgs listados: ${from.split('@')[0]} → ${data[from].length}`
            )

            await sock.sendMessage(
                from,
                {
                    text: [
                        `💬 MENSAJES DE BIENVENIDA`,
                        ui.divider,
                        `Total: ${data[from].length} / ${MAX_MESSAGES}`,
                        ui.divider,
                        rows,
                        ui.divider,
                        `🗑️ Eliminar:`,
                        `/deljoinmsg número`
                    ].join('\n')
                }
            )

        } catch (err) {

            logger.error(
                `Error listjoinmsg: ${err.message}`
            )

        }

    }

}
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

module.exports = {

    name:
        'clearjoinmsg',

    aliases: [
        'resetjoinmsg',
        'clearwelcome',
        'deletejoinmsg'
    ],

    description:
        'Elimina todos los mensajes de bienvenida',

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
                                'No hay mensajes de bienvenida configurados.'
                            )
                    }
                )

            }

            const total =
                data[from].length

            delete data[from]

            fs.writeFileSync(
                joinPath,
                JSON.stringify(data, null, 2)
            )

            logger.event(
                `JoinMsgs eliminados: ${from.split('@')[0]} → ${total}`
            )

            await sock.sendMessage(
                from,
                {
                    text:
                        ui.success(
                            'MENSAJES ELIMINADOS',
                            [
                                ['Borrados', `${total} mensaje${total !== 1 ? 's' : ''}`]
                            ]
                        )
                }
            )

        } catch (err) {

            logger.error(
                `Error clearjoinmsg: ${err.message}`
            )

        }

    }

}
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

const ensureDb = () => {

    try {

        if (!fs.existsSync(joinPath)) {
            fs.writeFileSync(
                joinPath,
                JSON.stringify({}, null, 2)
            )
        }

        const data =
            JSON.parse(
                fs.readFileSync(joinPath)
            )

        return typeof data === 'object'
            ? data
            : {}

    } catch {
        return {}
    }

}

const saveDb = data => {

    fs.writeFileSync(
        joinPath,
        JSON.stringify(data, null, 2)
    )

}

const checkGroup = async (sock, from, msg) => {

    if (!from.endsWith('@g.us')) {
        return 'not_group'
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
        return 'not_admin'
    }

    return 'ok'

}

module.exports = {

    name:
        'addjoinmsg',

    aliases: [
        'setjoinmsg',
        'joinmsg'
    ],

    description:
        'Agrega un mensaje automático al unirse al grupo',

    category:
        'bienvenida',

    adminOnly: true,

    groupOnly: true,

    async execute({
        sock,
        from,
        args,
        msg
    }) {

        try {

            const check =
                await checkGroup(
                    sock,
                    from,
                    msg
                )

            if (check === 'not_group') {

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

            if (check === 'not_admin') {

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

            const text =
                args.join(' ')
                .replace(/\s+/g, ' ')
                .trim()

            if (!text) {

                return await sock.sendMessage(
                    from,
                    {
                        text:
                            ui.warn(
                                'MENSAJE REQUERIDO',
                                'Uso: /addjoinmsg mensaje'
                            )
                    }
                )

            }

            if (text.length > 500) {

                return await sock.sendMessage(
                    from,
                    {
                        text:
                            ui.error(
                                'MENSAJE DEMASIADO LARGO',
                                'Máximo 500 caracteres.'
                            )
                    }
                )

            }

            const data =
                ensureDb()

            if (!Array.isArray(data[from])) {
                data[from] = []
            }

            if (data[from].length >= MAX_MESSAGES) {

                return await sock.sendMessage(
                    from,
                    {
                        text:
                            ui.error(
                                'LÍMITE ALCANZADO',
                                `Máximo ${MAX_MESSAGES} mensajes por grupo.`
                            )
                    }
                )

            }

            if (data[from].includes(text)) {

                return await sock.sendMessage(
                    from,
                    {
                        text:
                            ui.warn(
                                'MENSAJE DUPLICADO',
                                'Ese mensaje ya existe.'
                            )
                    }
                )

            }

            data[from].push(text)

            saveDb(data)

            logger.event(
                `JoinMsg agregado: ${from.split('@')[0]} → ${data[from].length}/${MAX_MESSAGES}`
            )

            await sock.sendMessage(
                from,
                {
                    text:
                        ui.success(
                            'MENSAJE AGREGADO',
                            [
                                ['Total', `${data[from].length} / ${MAX_MESSAGES}`]
                            ]
                        )
                }
            )

        } catch (err) {

            logger.error(
                `Error addjoinmsg: ${err.message}`
            )

        }

    }

}
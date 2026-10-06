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


function ensureDb() {

    try {

        const directory =
            path.dirname(
                joinPath
            )


        if (
            !fs.existsSync(
                directory
            )
        ) {

            fs.mkdirSync(
                directory,
                {
                    recursive: true
                }
            )

        }


        if (
            !fs.existsSync(
                joinPath
            )
        ) {

            fs.writeFileSync(
                joinPath,
                JSON.stringify(
                    {},
                    null,
                    2
                ),
                'utf8'
            )

        }


        const data =
            JSON.parse(
                fs.readFileSync(
                    joinPath,
                    'utf8'
                )
            )


        if (
            !data ||
            typeof data !== 'object' ||
            Array.isArray(data)
        ) {

            return {}

        }


        return data


    } catch (err) {

        logger.error(
            `Error leyendo joinMessages.json: ${err.message}`
        )

        return {}

    }

}


function saveDb(
    data
) {

    fs.writeFileSync(
        joinPath,
        JSON.stringify(
            data,
            null,
            2
        ),
        'utf8'
    )

}


function cleanMessages(
    messages
) {

    if (
        !Array.isArray(
            messages
        )
    ) {

        return []

    }


    return messages
        .filter(
            item =>
                typeof item === 'string'
        )
        .map(
            item =>
                item
                    .replace(
                        /\s+/g,
                        ' '
                    )
                    .trim()
        )
        .filter(Boolean)

}


async function checkGroup(
    sock,
    from,
    msg
) {

    if (
        !from ||
        !from.endsWith('@g.us')
    ) {

        return 'not_group'

    }


    const sender =

        msg.key.participant ||

        msg.participant ||

        msg.key.remoteJid


    if (!sender) {

        return 'no_sender'

    }


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
        'deljoinmsg',

    aliases: [
        'removejoinmsg',
        'rmjoinmsg'
    ],

    description:
        'Elimina un mensaje de bienvenida específico',

    category:
        'bienvenida',

    adminOnly:
        true,

    groupOnly:
        true,


    async execute({

        sock,
        from,
        args = [],
        msg

    }) {

        try {

            const check =
                await checkGroup(

                    sock,

                    from,

                    msg

                )


            if (
                check ===
                'not_group'
            ) {

                return await sock.safeSendMessage(

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


            if (
                check ===
                'no_sender'
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE USUARIO',

                                'No se pudo identificar al usuario que ejecutó el comando.'

                            )

                    }

                )

            }


            if (
                check ===
                'not_admin'
            ) {

                return await sock.safeSendMessage(

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


            const index =
                Number(
                    args[0]
                )


            if (
                !Number.isInteger(
                    index
                ) ||
                index <= 0
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'NÚMERO REQUERIDO',

                                [
                                    'Debes indicar el número del mensaje que deseas eliminar.',
                                    '',
                                    'Uso:',
                                    '/deljoinmsg 2'
                                ].join('\n')

                            )

                    }

                )

            }


            const data =
                ensureDb()


            data[from] =
                cleanMessages(
                    data[from]
                )


            if (
                data[from].length === 0
            ) {

                return await sock.safeSendMessage(

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


            const realIndex =
                index - 1


            if (
                realIndex < 0 ||
                realIndex >= data[from].length
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'NÚMERO INVÁLIDO',

                                `Solo hay ${data[from].length} mensaje${data[from].length !== 1 ? 's' : ''} configurado${data[from].length !== 1 ? 's' : ''}.`

                            )

                    }

                )

            }


            const deleted =
                data[from][realIndex]


            data[from].splice(
                realIndex,
                1
            )


            if (
                data[from].length === 0
            ) {

                delete data[from]

            }


            saveDb(
                data
            )


            logger.event(

                `JoinMsg eliminado: ${from.split('@')[0]} | #${index}`

            )


            const preview =
                deleted.length > 60

                    ? `${deleted.slice(0, 60)}...`

                    : deleted


            const remaining =
                Array.isArray(
                    data[from]
                )
                    ? data[from].length
                    : 0


            return await sock.safeSendMessage(

                from,

                {

                    text:
                        ui.success(

                            'MENSAJE ELIMINADO',

                            [

                                [
                                    'Número',
                                    `#${index}`
                                ],

                                [
                                    'Mensaje',
                                    preview
                                ],

                                [
                                    'Quedan',
                                    `${remaining} mensaje${remaining !== 1 ? 's' : ''}`
                                ]

                            ],

                            'El mensaje de bienvenida fue eliminado correctamente.'

                        )

                }

            )


        } catch (err) {

            logger.error(

                `Error deljoinmsg: ${err.stack || err.message}`

            )


            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DELJOINMSG',

                                'No se pudo eliminar el mensaje de bienvenida.'

                            )

                    }

                )

            } catch {}

        }

    }

}
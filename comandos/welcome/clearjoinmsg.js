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


/* ─────────────────────────────
   ASEGURAR BASE DE DATOS
───────────────────────────── */

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


/* ─────────────────────────────
   GUARDAR BASE
───────────────────────────── */

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


/* ─────────────────────────────
   VALIDAR GRUPO / ADMIN
───────────────────────────── */

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


/* ─────────────────────────────
   COMANDO
───────────────────────────── */

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

    adminOnly:
        true,

    groupOnly:
        true,


    async execute({

        sock,
        from,
        msg

    }) {

        try {

            /* ─────────────────────────────
               VALIDACIÓN
            ───────────────────────────── */

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


            /* ─────────────────────────────
               BASE DE DATOS
            ───────────────────────────── */

            const data =
                ensureDb()


            if (
                !Array.isArray(
                    data[from]
                )
            ) {

                data[from] =
                    []

            }


            /* ─────────────────────────────
               SIN MENSAJES
            ───────────────────────────── */

            if (
                data[from].length === 0
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'SIN MENSAJES',

                                'No hay mensajes de bienvenida configurados para este grupo.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               TOTAL
            ───────────────────────────── */

            const total =
                data[from].length


            /* ─────────────────────────────
               ELIMINAR
            ───────────────────────────── */

            delete data[from]


            saveDb(
                data
            )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `JoinMsgs eliminados: ${from.split('@')[0]} | ${total}`

            )


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            return await sock.safeSendMessage(

                from,

                {

                    text:
                        ui.success(

                            'MENSAJES ELIMINADOS',

                            [

                                [
                                    'Borrados',
                                    `${total} mensaje${total !== 1 ? 's' : ''}`
                                ],

                                [
                                    'Estado',
                                    '○ SIN MENSAJES'
                                ]

                            ],

                            'Todos los mensajes de bienvenida fueron eliminados.'

                        )

                }

            )


        } catch (err) {

            logger.error(

                `Error clearjoinmsg: ${err.stack || err.message}`

            )


            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR CLEARJOINMSG',

                                'No se pudieron eliminar los mensajes de bienvenida.'

                            )

                    }

                )

            } catch {}

        }

    }

}
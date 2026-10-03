const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const isGroupAdmin =
    require('../../src/utils/isAdmin')


const banPath =
    path.join(
        __dirname,
        '../../database/bans.json'
    )


function ensureBanFile() {

    const directory =
        path.dirname(banPath)

    if (!fs.existsSync(directory)) {

        fs.mkdirSync(
            directory,
            {
                recursive: true
            }
        )

    }

    if (!fs.existsSync(banPath)) {

        fs.writeFileSync(
            banPath,
            JSON.stringify(
                [],
                null,
                2
            ),
            'utf8'
        )

    }

}


function readBans() {

    ensureBanFile()

    try {

        const data =
            JSON.parse(
                fs.readFileSync(
                    banPath,
                    'utf8'
                )
            )

        return Array.isArray(data)
            ? data
            : []

    } catch (err) {

        logger.error(
            `Error leyendo bans.json: ${err.message}`
        )

        return []

    }

}


function saveBans(data = []) {

    fs.writeFileSync(
        banPath,
        JSON.stringify(
            data,
            null,
            2
        ),
        'utf8'
    )

}


module.exports = {

    name:
        'unban',

    description:
        'Desbanea usuarios del bot',

    category:
        'admin',

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
               SOLO GRUPOS
            ───────────────────────────── */

            if (
                !from.endsWith('@g.us')
            ) {

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


            /* ─────────────────────────────
               USUARIO QUE EJECUTA
            ───────────────────────────── */

            const sender =

                msg.key.participant ||

                msg.participant


            if (!sender) {

                return await sock.sendMessage(

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


            /* ─────────────────────────────
               VERIFICAR ADMIN
            ───────────────────────────── */

            const isAdmin =
                await isGroupAdmin(

                    sock,
                    from,
                    sender

                )


            if (!isAdmin) {

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


            /* ─────────────────────────────
               USUARIO OBJETIVO
            ───────────────────────────── */

            const contextInfo =

                msg.message
                    ?.extendedTextMessage
                    ?.contextInfo


            const target =

                contextInfo
                    ?.mentionedJid
                    ?.[0]


            if (!target) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'USUARIO REQUERIDO',

                                'Menciona al usuario que quieres desbanear.\n\nEjemplo: /unban @usuario'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               LEER BAN LIST
            ───────────────────────────── */

            let bans =
                readBans()


            /* ─────────────────────────────
               COMPROBAR BAN
            ───────────────────────────── */

            if (
                !bans.includes(target)
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'NO BANEADO',

                                `@${target.split('@')[0]} no está baneado.`

                            ),

                        mentions: [
                            target
                        ]

                    }

                )

            }


            /* ─────────────────────────────
               ELIMINAR BAN
            ───────────────────────────── */

            bans =
                bans.filter(
                    user =>
                        user !== target
                )


            saveBans(bans)


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Unban aplicado: ${target.split('@')[0]} por ${sender.split('@')[0]}`

            )


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            return await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            'UNBAN EJECUTADO',

                            [

                                [
                                    'Usuario',
                                    `@${target.split('@')[0]}`
                                ],

                                [
                                    'Estado',
                                    'DESBANEADO'
                                ],

                                [
                                    'Por',
                                    `@${sender.split('@')[0]}`
                                ]

                            ],

                            'Este usuario puede volver a usar los comandos del bot.'

                        ),

                    mentions: [

                        target,
                        sender

                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error unban: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR INTERNO',

                                'Ocurrió un error al intentar desbanear al usuario.'

                            )

                    }

                )

            } catch {

                // Evita otro error si tampoco se puede enviar el mensaje.

            }

        }

    }

}
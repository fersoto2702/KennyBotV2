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


const dbPath =
    path.join(
        __dirname,
        '../../database/antilink.json'
    )


function ensureDb() {

    try {

        const directory =
            path.dirname(
                dbPath
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
                dbPath
            )
        ) {

            fs.writeFileSync(
                dbPath,
                JSON.stringify(
                    [],
                    null,
                    2
                ),
                'utf8'
            )

        }


        const data =
            JSON.parse(
                fs.readFileSync(
                    dbPath,
                    'utf8'
                )
            )


        return Array.isArray(data)
            ? data
            : []


    } catch (err) {

        logger.error(
            `Error leyendo antilink.json: ${err.message}`
        )

        return []

    }

}


function saveDb(
    data
) {

    fs.writeFileSync(
        dbPath,
        JSON.stringify(
            data,
            null,
            2
        ),
        'utf8'
    )

}


function cleanGroups(
    data
) {

    return [

        ...new Set(

            data.filter(
                item =>
                    typeof item === 'string' &&
                    item.endsWith('@g.us')
            )

        )

    ]

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
        'antilink',

    aliases: [
        'al',
        'antilinks',
        'linkguard'
    ],

    description:
        'Activa o desactiva el sistema AntiLink',

    category:
        'admin',

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


            let data =
                cleanGroups(
                    ensureDb()
                )


            const option =
                String(
                    args[0] || ''
                )
                    .trim()
                    .toLowerCase()


            /* ─────────────────────────────
               ACTIVAR
            ───────────────────────────── */

            if (
                option === 'on'
            ) {

                const alreadyEnabled =
                    data.includes(
                        from
                    )


                if (
                    alreadyEnabled
                ) {

                    return await sock.safeSendMessage(

                        from,

                        {

                            text:
                                ui.info(

                                    'ANTILINK',

                                    [
                                        [
                                            'Estado',
                                            '● ACTIVADO'
                                        ]
                                    ],

                                    'AntiLink ya estaba activado en este grupo.'

                                )

                        }

                    )

                }


                data.push(
                    from
                )


                data =
                    cleanGroups(
                        data
                    )


                saveDb(
                    data
                )


                logger.event(

                    `AntiLink ON: ${from.split('@')[0]}`

                )


                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.success(

                                'ANTILINK ACTIVADO',

                                [

                                    [
                                        'Estado',
                                        '● ACTIVADO'
                                    ],

                                    [
                                        'Protección',
                                        'Links bloqueados'
                                    ]

                                ],

                                'La protección AntiLink fue activada correctamente.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               DESACTIVAR
            ───────────────────────────── */

            if (
                option === 'off'
            ) {

                const wasEnabled =
                    data.includes(
                        from
                    )


                if (
                    !wasEnabled
                ) {

                    return await sock.safeSendMessage(

                        from,

                        {

                            text:
                                ui.info(

                                    'ANTILINK',

                                    [
                                        [
                                            'Estado',
                                            '○ DESACTIVADO'
                                        ]
                                    ],

                                    'AntiLink ya estaba desactivado en este grupo.'

                                )

                        }

                    )

                }


                data =
                    data.filter(

                        id =>
                            id !== from

                    )


                saveDb(
                    data
                )


                logger.event(

                    `AntiLink OFF: ${from.split('@')[0]}`

                )


                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.success(

                                'ANTILINK DESACTIVADO',

                                [

                                    [
                                        'Estado',
                                        '○ DESACTIVADO'
                                    ]

                                ],

                                'La protección AntiLink fue desactivada correctamente.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               ESTADO
            ───────────────────────────── */

            const enabled =
                data.includes(
                    from
                )


            return await sock.safeSendMessage(

                from,

                {

                    text:
                        ui.info(

                            'ANTILINK',

                            [

                                [
                                    'Estado',
                                    enabled
                                        ? '● ACTIVADO'
                                        : '○ DESACTIVADO'
                                ],

                                [
                                    'Grupo',
                                    from.split('@')[0]
                                ]

                            ],

                            'Uso: /antilink on · /antilink off'

                        )

                }

            )


        } catch (err) {

            logger.error(

                `Error antilink: ${err.stack || err.message}`

            )


            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR ANTILINK',

                                'No se pudo actualizar la configuración AntiLink.'

                            )

                    }

                )

            } catch {}

        }

    }

}
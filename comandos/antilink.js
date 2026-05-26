const fs =
    require('fs')

const path =
    require('path')

const isGroupAdmin =
    require('../src/utils/isAdmin')

const logger =
    require('../src/utils/logger')

const ui =
    require('../src/utils/ui')

const dbPath =
    path.join(

        __dirname,

        '../../database/antilink.json'

    )

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

    adminOnly: true,

    groupOnly: true,

    async execute({

        sock,
        from,
        args,
        msg

    }) {

        try {

            // =========================
            // GROUP CHECK
            // =========================

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

            // =========================
            // ADMIN CHECK
            // =========================

            const sender =

                msg.key.participant ||

                msg.participant

            const admin =

                await isGroupAdmin(

                    sock,
                    from,
                    sender

                )

            if (
                !admin
            ) {

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

            // =========================
            // CREATE FILE
            // =========================

            if (
                !fs.existsSync(dbPath)
            ) {

                fs.writeFileSync(

                    dbPath,

                    JSON.stringify(
                        [],
                        null,
                        2
                    )

                )

            }

            // =========================
            // READ DB
            // =========================

            let data = []

            try {

                data =
                    JSON.parse(

                        fs.readFileSync(
                            dbPath
                        )

                    )

                if (
                    !Array.isArray(data)
                ) {

                    data = []

                }

            } catch {

                data = []

            }

            // =========================
            // CLEAN DUPLICATES
            // =========================

            data =
                [...new Set(data)]

            // =========================
            // OPTION
            // =========================

            const option =

                args[0]?.toLowerCase()

            // =========================
            // ENABLE
            // =========================

            if (
                option === 'on'
            ) {

                if (
                    !data.includes(from)
                ) {

                    data.push(from)

                }

                fs.writeFileSync(

                    dbPath,

                    JSON.stringify(
                        data,
                        null,
                        2
                    )

                )

                logger.event(

                    `AntiLink ON: ${from.split('@')[0]}`

                )

                return await sock.sendMessage(

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

                                ]

                            )

                    }

                )

            }

            // =========================
            // DISABLE
            // =========================

            if (
                option === 'off'
            ) {

                data =
                    data.filter(
                        id => id !== from
                    )

                fs.writeFileSync(

                    dbPath,

                    JSON.stringify(
                        data,
                        null,
                        2
                    )

                )

                logger.event(

                    `AntiLink OFF: ${from.split('@')[0]}`

                )

                return await sock.sendMessage(

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

                                ]

                            )

                    }

                )

            }

            // =========================
            // STATUS
            // =========================

            const enabled =

                data.includes(from)

            await sock.sendMessage(

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
                `Error antilink: ${err.message}`
            )

        }

    }

}
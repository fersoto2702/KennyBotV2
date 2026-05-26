const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const mutePath =
    path.join(

        __dirname,

        '../../database/mute.json'

    )

module.exports = {

    name:
        'mute',

    aliases: [

        'silenciar',
        'mutegroup'

    ],

    description:
        'Silencia o activa los comandos del grupo',

    category:
        'grupos',

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
            // CREATE FILE
            // =========================

            if (
                !fs.existsSync(mutePath)
            ) {

                fs.writeFileSync(

                    mutePath,

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
                            mutePath
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
            // METADATA
            // =========================

            const metadata =

                await sock.groupMetadata(
                    from
                )

            const participants =
                metadata.participants

            const sender =

                msg.key.participant ||

                msg.participant

            // =========================
            // ADMIN CHECK
            // =========================

            const senderData =

                participants.find(

                    p => p.id === sender

                )

            const isAdmin =

                senderData?.admin === 'admin' ||

                senderData?.admin === 'superadmin'

            if (
                !isAdmin
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
            // OPTION
            // =========================

            const option =

                args[0]
                ?.toLowerCase()
                ?.trim()

            // =========================
            // ON
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

                    mutePath,

                    JSON.stringify(
                        data,
                        null,
                        2
                    )

                )

                logger.event(

                    `Mute ON: ${from.split('@')[0]}`

                )

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.success(

                                'GRUPO SILENCIADO',

                                [

                                    [

                                        'Estado',

                                        '● MUTE ACTIVADO'

                                    ]

                                ]

                            )

                    }

                )

            }

            // =========================
            // OFF
            // =========================

            if (
                option === 'off'
            ) {

                data =

                    data.filter(
                        id => id !== from
                    )

                fs.writeFileSync(

                    mutePath,

                    JSON.stringify(
                        data,
                        null,
                        2
                    )

                )

                logger.event(

                    `Mute OFF: ${from.split('@')[0]}`

                )

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.success(

                                'GRUPO ACTIVADO',

                                [

                                    [

                                        'Estado',

                                        '○ MUTE DESACTIVADO'

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

                            'MUTE DEL GRUPO',

                            [

                                [

                                    'Estado',

                                    enabled
                                        ? '● SILENCIADO'
                                        : '○ ACTIVO'

                                ]

                            ],

                            'Uso:\n/mute on\n/mute off'

                        )

                }

            )

        } catch (err) {

            logger.error(
                `Error mute: ${err.message}`
            )

        }

    }

}
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
        'deljoinmsg',

    aliases: [

        'removejoinmsg',
        'deletejoinmsg'

    ],

    description:
        'Elimina un mensaje de bienvenida específico',

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
            // INDEX
            // =========================

            const index =

                Number(args[0])

            if (
                !Number.isInteger(index) ||
                index <= 0
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'NÚMERO REQUERIDO',

                                'Uso: /deljoinmsg número'

                            )

                    }

                )

            }

            // =========================
            // CREATE FILE
            // =========================

            if (
                !fs.existsSync(joinPath)
            ) {

                fs.writeFileSync(

                    joinPath,

                    JSON.stringify(
                        {},
                        null,
                        2
                    )

                )

            }

            // =========================
            // READ DB
            // =========================

            let data = {}

            try {

                data =
                    JSON.parse(

                        fs.readFileSync(
                            joinPath
                        )

                    )

                if (
                    typeof data !== 'object'
                ) {

                    data = {}

                }

            } catch {

                data = {}

            }

            // =========================
            // GROUP DATA
            // =========================

            if (
                !Array.isArray(data[from])
            ) {

                data[from] = []

            }

            // =========================
            // EMPTY
            // =========================

            if (
                data[from].length === 0
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'SIN MENSAJES',

                                'No hay mensajes configurados.'

                            )

                    }

                )

            }

            // =========================
            // REAL INDEX
            // =========================

            const realIndex =
                index - 1

            if (
                !data[from][realIndex]
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'NÚMERO INVÁLIDO',

                                `Solo hay ${data[from].length} mensajes.`

                            )

                    }

                )

            }

            // =========================
            // DELETE
            // =========================

            const deleted =
                data[from][realIndex]

            data[from].splice(
                realIndex,
                1
            )

            // =========================
            // SAVE
            // =========================

            fs.writeFileSync(

                joinPath,

                JSON.stringify(
                    data,
                    null,
                    2
                )

            )

            logger.event(

                `JoinMsg eliminado: ${from.split('@')[0]} → #${index}`

            )

            // =========================
            // PREVIEW
            // =========================

            const preview =

                deleted.length > 40

                    ? deleted.slice(0, 40) + '...'

                    : deleted

            // =========================
            // SEND
            // =========================

            await sock.sendMessage(

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

                                    `${data[from].length} mensaje${data[from].length !== 1 ? 's' : ''}`

                                ]

                            ]

                        )

                }

            )

        } catch (err) {

            logger.error(
                `Error deljoinmsg: ${err.message}`
            )

        }

    }

}
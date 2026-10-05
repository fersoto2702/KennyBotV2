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


const welcomePath =
    path.join(
        __dirname,
        '../../database/welcome.json'
    )


function ensureWelcomeFile() {

    const directory =
        path.dirname(
            welcomePath
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
            welcomePath
        )
    ) {

        fs.writeFileSync(
            welcomePath,
            JSON.stringify(
                [],
                null,
                2
            ),
            'utf8'
        )

    }

}


function readWelcomeData() {

    ensureWelcomeFile()


    try {

        const data =
            JSON.parse(
                fs.readFileSync(
                    welcomePath,
                    'utf8'
                )
            )


        return Array.isArray(data)
            ? data
            : []

    } catch (err) {

        logger.error(
            `Error leyendo welcome.json: ${err.message}`
        )

        return []

    }

}


function saveWelcomeData(
    data
) {

    fs.writeFileSync(
        welcomePath,
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
        'welcome',

    aliases: [
        'bienvenida',
        'welcomemsg'
    ],

    description:
        'Activa o desactiva el mensaje de bienvenida',

    category:
        'grupos',

    adminOnly:
        true,

    groupOnly:
        true,


    async execute({

        sock,
        from,
        args,
        msg

    }) {

        try {

            /* ─────────────────────────────
               SOLO GRUPOS
            ───────────────────────────── */

            if (
                !from.endsWith(
                    '@g.us'
                )
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'SOLO GRUPOS',

                                'Este comando solo funciona dentro de grupos.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               REMITENTE
            ───────────────────────────── */

            const sender =

                msg.key.participant ||

                msg.participant ||

                msg.key.remoteJid


            if (!sender) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE USUARIO',

                                'No se pudo identificar al usuario.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               VALIDAR ADMIN
            ───────────────────────────── */

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

                                'Solo los administradores pueden cambiar la bienvenida.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               DATOS
            ───────────────────────────── */

            let data =
                readWelcomeData()


            const option =
                String(
                    args?.[0] || ''
                )
                    .trim()
                    .toLowerCase()


            const enabled =
                data.includes(
                    from
                )


            /* ─────────────────────────────
               ACTIVAR
            ───────────────────────────── */

            if (
                option === 'on'
            ) {

                if (
                    !enabled
                ) {

                    data.push(
                        from
                    )


                    saveWelcomeData(
                        data
                    )

                }


                logger.event(

                    `Welcome ON: ${from.split('@')[0]} | ${sender.split('@')[0]}`

                )


                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.success(

                                '👋 WELCOME ACTIVADO',

                                [

                                    [
                                        'Estado',
                                        '● ACTIVADO'
                                    ],

                                    [
                                        'Configurado por',
                                        `@${sender.split('@')[0]}`
                                    ]

                                ],

                                enabled
                                    ? 'El mensaje de bienvenida ya estaba activado.'
                                    : 'KennyBot enviará un mensaje cuando entre un nuevo miembro.'

                            ),

                        mentions: [
                            sender
                        ]

                    }

                )

            }


            /* ─────────────────────────────
               DESACTIVAR
            ───────────────────────────── */

            if (
                option === 'off'
            ) {

                if (
                    enabled
                ) {

                    data =
                        data.filter(
                            id =>
                                id !== from
                        )


                    saveWelcomeData(
                        data
                    )

                }


                logger.event(

                    `Welcome OFF: ${from.split('@')[0]} | ${sender.split('@')[0]}`

                )


                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.success(

                                '👋 WELCOME DESACTIVADO',

                                [

                                    [
                                        'Estado',
                                        '○ DESACTIVADO'
                                    ],

                                    [
                                        'Configurado por',
                                        `@${sender.split('@')[0]}`
                                    ]

                                ],

                                enabled
                                    ? 'KennyBot dejó de enviar mensajes de bienvenida.'
                                    : 'La bienvenida ya estaba desactivada.'

                            ),

                        mentions: [
                            sender
                        ]

                    }

                )

            }


            /* ─────────────────────────────
               ESTADO ACTUAL
            ───────────────────────────── */

            return await sock.sendMessage(

                from,

                {

                    text:
                        ui.info(

                            '👋 WELCOME DEL GRUPO',

                            [

                                [
                                    'Estado',
                                    enabled
                                        ? '● ACTIVADO'
                                        : '○ DESACTIVADO'
                                ]

                            ],

                            [
                                'Uso:',
                                '/welcome on',
                                '/welcome off'
                            ].join('\n')

                        )

                }

            )


        } catch (err) {

            logger.error(

                `Error welcome: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE WELCOME',

                                'No se pudo cambiar el estado de la bienvenida.'

                            )

                    }

                )

            } catch {}

        }

    }

}
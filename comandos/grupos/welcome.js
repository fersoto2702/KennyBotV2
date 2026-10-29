const isGroupAdmin =
    require('../../src/utils/isAdmin')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const welcomeSystem =
    require('../../src/handlers/welcomeSystem')

function normalizeJid(
    jid
) {

    if (!jid) {

        return null

    }

    return String(
        jid
    )
        .trim()
        .replace(
            /:\d+@/,
            '@'
        )

}

function getBotName(
    sock
) {

    return String(
        sock?.botProfile?.name ||
        'KennyBot'
    )
        .trim()

}

async function sendMessage(
    sock,
    jid,
    content
) {

    if (
        typeof sock.safeSendMessage ===
        'function'
    ) {

        return await sock.safeSendMessage(
            jid,
            content
        )

    }

    return await sock.sendMessage(
        jid,
        content
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
        msg,
        prefix = '.'

    }) {

        try {

            /*
             * ─────────────────────────────
             * SOLO GRUPOS
             * ─────────────────────────────
             */

            if (
                !from ||
                !from.endsWith(
                    '@g.us'
                )
            ) {

                return await sendMessage(
                    sock,
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

            /*
             * ─────────────────────────────
             * REMITENTE
             * ─────────────────────────────
             */

            const sender =
                normalizeJid(

                    msg?.key?.fromMe

                        ? (
                            sock?.user?.lid ||
                            sock?.user?.id
                        )

                        : (
                            msg?.key?.participant ||
                            msg?.participant ||
                            msg?.key?.remoteJid
                        )

                )

            if (
                !sender
            ) {

                return await sendMessage(
                    sock,
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

            /*
             * ─────────────────────────────
             * VALIDAR ADMIN
             * ─────────────────────────────
             */

            const admin =
                await isGroupAdmin(
                    sock,
                    from,
                    sender
                )

            if (
                !admin
            ) {

                return await sendMessage(
                    sock,
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

            /*
             * ─────────────────────────────
             * CONFIGURACIÓN ACTUAL
             * ─────────────────────────────
             */

            const config =
                welcomeSystem.getGroupConfig(
                    from
                )

            const option =
                String(
                    args?.[0] ||
                    ''
                )
                    .trim()
                    .toLowerCase()

            const botName =
                getBotName(
                    sock
                )

            /*
             * ─────────────────────────────
             * ACTIVAR
             * ─────────────────────────────
             */

            if (
                [
                    'on',
                    'activar',
                    'activa',
                    'enable',
                    '1',
                    'true'
                ].includes(
                    option
                )
            ) {

                if (
                    config.welcome
                ) {

                    return await sendMessage(
                        sock,
                        from,
                        {
                            text:
                                ui.info(
                                    '👋 WELCOME',
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
                                    'El mensaje de bienvenida ya estaba activado.'
                                ),

                            mentions: [
                                sender
                            ]
                        }
                    )

                }

                const success =
                    welcomeSystem.setWelcomeEnabled(
                        from,
                        true
                    )

                if (
                    !success
                ) {

                    throw new Error(
                        'No se pudo guardar la configuración de bienvenida.'
                    )

                }

                logger.event(
                    `${botName} | Welcome ON | ${from.split('@')[0]} | ${sender.split('@')[0]}`
                )

                return await sendMessage(
                    sock,
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
                                `${botName} enviará un mensaje cuando entre un nuevo miembro.`
                            ),

                        mentions: [
                            sender
                        ]
                    }
                )

            }

            /*
             * ─────────────────────────────
             * DESACTIVAR
             * ─────────────────────────────
             */

            if (
                [
                    'off',
                    'desactivar',
                    'desactiva',
                    'disable',
                    '0',
                    'false'
                ].includes(
                    option
                )
            ) {

                if (
                    !config.welcome
                ) {

                    return await sendMessage(
                        sock,
                        from,
                        {
                            text:
                                ui.info(
                                    '👋 WELCOME',
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
                                    'La bienvenida ya estaba desactivada.'
                                ),

                            mentions: [
                                sender
                            ]
                        }
                    )

                }

                const success =
                    welcomeSystem.setWelcomeEnabled(
                        from,
                        false
                    )

                if (
                    !success
                ) {

                    throw new Error(
                        'No se pudo guardar la configuración de bienvenida.'
                    )

                }

                logger.event(
                    `${botName} | Welcome OFF | ${from.split('@')[0]} | ${sender.split('@')[0]}`
                )

                return await sendMessage(
                    sock,
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
                                `${botName} dejó de enviar mensajes de bienvenida.`
                            ),

                        mentions: [
                            sender
                        ]
                    }
                )

            }

            /*
             * ─────────────────────────────
             * ESTADO ACTUAL
             * ─────────────────────────────
             */

            return await sendMessage(
                sock,
                from,
                {
                    text:
                        ui.info(
                            '👋 WELCOME DEL GRUPO',
                            [
                                [
                                    'Estado',
                                    config.welcome
                                        ? '● ACTIVADO'
                                        : '○ DESACTIVADO'
                                ],
                                [
                                    'Bot',
                                    botName
                                ]
                            ],
                            [
                                'Uso:',
                                `${prefix}welcome on`,
                                `${prefix}welcome off`,
                                '',
                                `Mensaje personalizado:`,
                                `${prefix}setwelcome <mensaje>`
                            ]
                                .join(
                                    '\n'
                                )
                        )
                }
            )

        } catch (err) {

            logger.error(
                `${getBotName(sock)} | Error welcome: ${err.stack || err.message}`
            )

            try {

                await sendMessage(
                    sock,
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

            return false

        }

    }

}
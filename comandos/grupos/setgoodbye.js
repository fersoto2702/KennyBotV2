const isGroupAdmin =
    require('../../src/utils/isAdmin')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const welcomeSystem =
    require('../../src/system/welcomeSystem')


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
        'setgoodbye',

    aliases: [
        'setdespedida'
    ],

    description:
        'Configura el mensaje personalizado de despedida',

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
                                'Solo los administradores pueden cambiar el mensaje de despedida.'
                            )
                    }
                )

            }


            const message =
                Array.isArray(
                    args
                )
                    ? args.join(
                        ' '
                    ).trim()
                    : ''


            if (
                !message
            ) {

                const config =
                    welcomeSystem.getGroupConfig(
                        from
                    )

                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.info(
                                '🚪 MENSAJE DE DESPEDIDA',
                                [
                                    [
                                        'Estado',
                                        config.goodbye
                                            ? '● ACTIVADO'
                                            : '○ DESACTIVADO'
                                    ]
                                ],
                                [
                                    'Mensaje actual:',
                                    '',
                                    config.goodbyeMessage,
                                    '',
                                    'Variables disponibles:',
                                    '{user} → usuario',
                                    '{group} → nombre del grupo',
                                    '{members} → cantidad de miembros',
                                    '{bot} → nombre del bot',
                                    '',
                                    'Uso:',
                                    `${prefix}setgoodbye <mensaje>`,
                                    '',
                                    'Ejemplo:',
                                    `${prefix}setgoodbye 👋 Hasta luego {user}. Gracias por formar parte de *{group}*.`
                                ]
                                    .join(
                                        '\n'
                                    )
                            )
                    }
                )

            }


            if (
                message.length >
                2000
            ) {

                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.error(
                                'MENSAJE DEMASIADO LARGO',
                                'El mensaje de despedida no puede superar los 2000 caracteres.'
                            )
                    }
                )

            }


            const success =
                welcomeSystem.setGoodbyeMessage(
                    from,
                    message
                )


            if (
                !success
            ) {

                throw new Error(
                    'No se pudo guardar el mensaje de despedida.'
                )

            }


            const botName =
                getBotName(
                    sock
                )


            logger.event(
                `${botName} | SetGoodbye | ${from.split('@')[0]} | ${sender.split('@')[0]}`
            )


            return await sendMessage(
                sock,
                from,
                {
                    text:
                        ui.success(
                            '🚪 DESPEDIDA ACTUALIZADA',
                            [
                                [
                                    'Configurado por',
                                    `@${sender.split('@')[0]}`
                                ]
                            ],
                            [
                                'Nuevo mensaje:',
                                '',
                                message,
                                '',
                                'Variables disponibles:',
                                '{user}',
                                '{group}',
                                '{members}',
                                '{bot}'
                            ]
                                .join(
                                    '\n'
                                )
                        ),

                    mentions: [
                        sender
                    ]
                }
            )


        } catch (err) {

            logger.error(
                `${getBotName(sock)} | Error setgoodbye: ${err.stack || err.message}`
            )


            try {

                await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.error(
                                'ERROR DE SETGOODBYE',
                                'No se pudo guardar el mensaje de despedida.'
                            )
                    }
                )

            } catch {}


            return false

        }

    }

}
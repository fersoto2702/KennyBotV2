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
        'resetwelcome',

    aliases: [
        'resetbienvenida'
    ],

    description:
        'Restaura el mensaje de bienvenida predeterminado',

    category:
        'grupos',

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
                                'Solo los administradores pueden restaurar la bienvenida.'
                            )
                    }
                )

            }


            const success =
                welcomeSystem.resetWelcomeMessage(
                    from
                )


            if (
                !success
            ) {

                throw new Error(
                    'No se pudo restaurar el mensaje de bienvenida.'
                )

            }


            const config =
                welcomeSystem.getGroupConfig(
                    from
                )


            logger.event(
                `${getBotName(sock)} | ResetWelcome | ${from.split('@')[0]} | ${sender.split('@')[0]}`
            )


            return await sendMessage(
                sock,
                from,
                {
                    text:
                        ui.success(
                            '👋 BIENVENIDA RESTAURADA',
                            [
                                [
                                    'Configurado por',
                                    `@${sender.split('@')[0]}`
                                ]
                            ],
                            [
                                'Mensaje predeterminado:',
                                '',
                                config.welcomeMessage
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
                `${getBotName(sock)} | Error resetwelcome: ${err.stack || err.message}`
            )


            try {

                await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.error(
                                'ERROR DE RESETWELCOME',
                                'No se pudo restaurar el mensaje de bienvenida.'
                            )
                    }
                )

            } catch {}


            return false

        }

    }

}
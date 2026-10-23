const {
    isEnabled,
    setToggle
} = require('./toggles')

const logger =
    require('./logger')

const ui =
    require('./ui')

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

function createToggleCommand({

    name,

    description,

    emoji,

    category = 'configuracion',

    aliases = []

}) {

    if (
        !name
    ) {

        throw new Error(
            'Toggle command requiere name'
        )

    }

    const normalizedName =
        String(
            name
        )
            .trim()
            .toLowerCase()

    const normalizedAliases =
        Array.isArray(
            aliases
        )
            ? aliases
                .map(
                    alias =>
                        String(
                            alias || ''
                        )
                            .trim()
                            .toLowerCase()
                )
                .filter(Boolean)
            : []

    return {

        name:
            normalizedName,

        description:
            String(
                description || ''
            )
                .trim(),

        category:
            String(
                category || 'configuracion'
            )
                .trim(),

        aliases:
            normalizedAliases,

        adminOnly:
            true,

        groupOnly:
            true,
async execute({

            sock,

            from,

            args,

            msg,

            prefix = '/'

        }) {

            try {

                const botName =
                    getBotName(
                        sock
                    )

                if (
                    !from ||
                    !from.endsWith(
                        '@g.us'
                    )
                ) {

                    await sock.safeSendMessage(
                        from,
                        {
                            text:
                                ui.error(
                                    'SOLO GRUPOS',
                                    'Este comando solo funciona en grupos.'
                                )
                        }
                    )

                    return false

                }

                const sender =
                    normalizeJid(

                        msg.key?.participant ||

                        msg.participant ||

                        msg.key?.remoteJid

                    )

                if (
                    !sender
                ) {

                    await sock.safeSendMessage(
                        from,
                        {
                            text:
                                ui.error(
                                    'ERROR DE USUARIO',
                                    'No se pudo identificar al usuario que ejecutó el comando.'
                                )
                        }
                    )

                    return false

                }

                const option =
                    String(
                        args?.[0] ||
                        ''
                    )
                        .toLowerCase()
                        .trim()

                if (
                    option !==
                    'on' &&
                    option !==
                    'off'
                ) {

                    const enabled =
                        isEnabled(
                            from,
                            normalizedName
                        )

                    const status =
                        enabled
                            ? 'ACTIVADO'
                            : 'DESACTIVADO'

                    const text =
                        ui.info(
                            `${emoji || '⚙️'} ${normalizedName.toUpperCase()}`,
                            [
                                [
                                    'Estado',
                                    status
                                ]
                            ],
                            `Uso: ${prefix}${normalizedName} on · ${prefix}${normalizedName} off`
                        )

                    await sock.safeSendMessage(
                        from,
                        {
                            text
                        }
                    )

                    return true

                }

                const enabled =
                    option ===
                    'on'

                const saved =
                    setToggle(
                        from,
                        normalizedName,
                        enabled
                    )

                if (
                    !saved
                ) {

                    await sock.safeSendMessage(
                        from,
                        {
                            text:
                                ui.error(
                                    'ERROR',
                                    `No se pudo guardar el estado de ${normalizedName}.`
                                )
                        }
                    )

                    return false

                }

                logger.event(
                    `${botName} | ${normalizedName} ${enabled ? 'activado' : 'desactivado'} por ${sender.split('@')[0]} → ${from.split('@')[0]}`
                )

                const status =
                    enabled
                        ? 'ACTIVADO'
                        : 'DESACTIVADO'

                const footer =
                    enabled
                        ? `${normalizedName.toUpperCase()} ahora está activo en este grupo.`
                        : `${normalizedName.toUpperCase()} ahora está desactivado en este grupo.`

                const text =
                    ui.success(
                        `${emoji || '⚙️'} ${normalizedName.toUpperCase()}`,
                        [
                            [
                                'Estado',
                                status
                            ],
                            [
                                'Modificado por',
                                `@${sender.split('@')[0]}`
                            ]
                        ],
                        footer
                    )

                await sock.safeSendMessage(
                    from,
                    {
                        text,

                        mentions:
                            [
                                sender
                            ]
                    }
                )

                return true

            } catch (err) {

                logger.error(
                    `Toggle Error (${normalizedName}): ${err.stack || err.message}`
                )

                try {

                    await sock.safeSendMessage(
                        from,
                        {
                            text:
                                ui.error(
                                    'ERROR INTERNO',
                                    `No se pudo actualizar ${normalizedName}.`
                                )
                        }
                    )

                } catch {}

                return false

            }

        }

    }

}

module.exports = {

    createToggleCommand

}
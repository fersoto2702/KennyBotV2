const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../utils/logger')

const ui =
    require('../utils/ui')

const comandos =
    require('../utils/commandRegistry')

const {

    addWarn,
    resetWarns

} = require('../utils/warnSystem')

const {

    isFlooding

} = require('../utils/floodSystem')

const {

    isLimited,
    isGroupLimited,
    getRemainingTime

} = require('../system/rateLimiter')

// =========================
// PATHS
// =========================

const mutePath =

    path.join(

        __dirname,

        '../../database/mute.json'

    )

// =========================
// CACHE
// =========================

const aliasesCache =
    new Map()

const cooldowns =
    new Map()

// =========================
// LOAD COMMANDS
// =========================

function loadCommands(dir) {

    const files =
        fs.readdirSync(dir)

    for (const file of files) {

        const fullPath =
            path.join(dir, file)

        const stat =
            fs.statSync(fullPath)

        // =========================
        // DIRECTORY
        // =========================

        if (stat.isDirectory()) {

            loadCommands(fullPath)

            continue

        }

        // =========================
        // ONLY JS
        // =========================

        if (!file.endsWith('.js'))
            continue

        try {

            delete require.cache[
                require.resolve(fullPath)
            ]

            const cmd =
                require(fullPath)

            // =========================
            // VALIDATE
            // =========================

            if (!cmd.name) {

                logger.error(
                    `${file} no tiene name`
                )

                continue

            }

            // =========================
            // COMMAND
            // =========================

            comandos.set(
                cmd.name,
                cmd
            )

            aliasesCache.set(
                cmd.name,
                cmd
            )

            // =========================
            // ALIASES
            // =========================

            if (
                Array.isArray(
                    cmd.aliases
                )
            ) {

                for (const alias of cmd.aliases) {

                    aliasesCache.set(
                        alias,
                        cmd
                    )

                }

            }

            logger.success(
                `Comando cargado: ${cmd.name}`
            )

        } catch (err) {

            logger.error(
                `Error cargando ${file}: ${err.message}`
            )

        }

    }

}

loadCommands(

    path.join(

        __dirname,

        '../../comandos'

    )

)

// =========================
// HELPERS
// =========================

const ensureMuteDb = () => {

    if (
        !fs.existsSync(mutePath)
    ) {

        fs.writeFileSync(

            mutePath,

            JSON.stringify([], null, 2)

        )

    }

}

const getSender = msg =>

    msg.key.participant ||

    msg.participant ||

    msg.key.remoteJid

const isGroup = jid =>

    jid.endsWith('@g.us')

// =========================
// HANDLER
// =========================

module.exports = async ({

    sock,
    msg,
    from,
    text,
    settings

}) => {

    try {

        // =========================
        // VALIDATE
        // =========================

        if (!msg?.message)
            return

        if (!text)
            return

        if (typeof text !== 'string')
            return

        // =========================
        // PREFIX
        // =========================

        const prefixes =

            settings.prefixes ||

            [settings.prefix || '/']

        const prefix =

            prefixes.find(

                p =>
                    text.startsWith(p)

            )

        if (!prefix)
            return

        // =========================
        // ARGS
        // =========================

        const args =

            text
                .slice(prefix.length)
                .trim()
                .split(/ +/)

        const commandName =

            args.shift()
                ?.toLowerCase()

        if (!commandName)
            return

        // =========================
        // COMMAND
        // =========================

        const command =

            aliasesCache.get(
                commandName
            )

        if (!command)
            return

        // =========================
        // SENDER
        // =========================

        const sender =
            getSender(msg)

        if (!sender)
            return

        // =========================
        // AUTO TYPING
        // =========================

        try {

            await sock.sendPresenceUpdate(

                'composing',
                from

            )

        } catch {}

        // =========================
        // FLOOD
        // =========================

        if (

            isGroup(from) &&
            isFlooding(sender)

        ) {

            logger.warn(

                `Flood: ${sender.split('@')[0]}`

            )

            const warns =

                addWarn(
                    from,
                    sender
                )

            const bar =

                '●'.repeat(
                    Math.min(warns, 3)
                ) +

                '○'.repeat(
                    Math.max(0, 3 - warns)
                )

            // =========================
            // REMOVE
            // =========================

            if (warns >= 3) {

                try {

                    await sock.groupParticipantsUpdate(

                        from,
                        [sender],
                        'remove'

                    )

                    resetWarns(
                        from,
                        sender
                    )

                    logger.event(

                        `Expulsado por flood: ${sender.split('@')[0]}`

                    )

                    return await sock.safeSendMessage(

                        from,

                        {

                            text:

                                ui.error(

                                    'USUARIO EXPULSADO',

                                    `@${sender.split('@')[0]} fue expulsado por flood.`

                                ),

                            mentions: [sender]

                        }

                    )

                } catch {

                    return await sock.safeSendMessage(

                        from,

                        {

                            text:

                                ui.error(

                                    'SIN PERMISOS',

                                    'No pude expulsar al usuario.'

                                )

                        }

                    )

                }

            }

            return await sock.safeSendMessage(

                from,

                {

                    text:

                        ui.warn(

                            'FLOOD DETECTADO',

                            `@${sender.split('@')[0]}\nWarns: ${bar} ${warns}/3`

                        ),

                    mentions: [sender]

                }

            )

        }

        // =========================
        // MUTE
        // =========================

        ensureMuteDb()

        const mutedGroups =

            JSON.parse(

                fs.readFileSync(
                    mutePath
                )

            )

        if (

            mutedGroups.includes(from)

        ) {

            const metadata =

                await sock.groupMetadata(
                    from
                )

            const senderData =

                metadata.participants.find(

                    p =>
                        p.id === sender

                )

            const isAdmin =

                senderData?.admin === 'admin' ||

                senderData?.admin === 'superadmin'

            if (!isAdmin)
                return

        }

        // =========================
        // OWNER ONLY
        // =========================

        if (command.ownerOnly) {

            const number =

                sender
                    .split('@')[0]

            if (

                !settings.ownerNumber.includes(
                    number
                )

            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:

                            ui.error(

                                'ACCESO DENEGADO',

                                'Solo el owner puede usar este comando.'

                            )

                    }

                )

            }

        }

        // =========================
        // GROUP ONLY
        // =========================

        if (

            command.groupOnly &&
            !isGroup(from)

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

        // =========================
        // PRIVATE ONLY
        // =========================

        if (

            command.privateOnly &&
            isGroup(from)

        ) {

            return await sock.safeSendMessage(

                from,

                {

                    text:

                        ui.error(

                            'SOLO PRIVADO',

                            'Este comando solo funciona en privado.'

                        )

                }

            )

        }

        // =========================
        // ADMIN ONLY
        // =========================

        if (command.adminOnly) {

            if (!isGroup(from)) {

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

            const metadata =

                await sock.groupMetadata(
                    from
                )

            const senderData =

                metadata.participants.find(

                    p =>
                        p.id === sender

                )

            const isAdmin =

                senderData?.admin === 'admin' ||

                senderData?.admin === 'superadmin'

            if (!isAdmin) {

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

        }

        // =========================
        // PREMIUM
        // =========================

        if (command.premiumOnly) {

            try {

                const isPremium =
                    require('../utils/isPremium')

                if (
                    !isPremium(sender)
                ) {

                    return await sock.safeSendMessage(

                        from,

                        {

                            text:

                                ui.error(

                                    'PREMIUM ONLY',

                                    'Este comando es exclusivo para usuarios premium.'

                                )

                        }

                    )

                }

            } catch (err) {

                logger.error(
                    `Premium middleware: ${err.message}`
                )

            }

        }

        // =========================
        // COOLDOWN
        // =========================

        const cooldown =

            command.cooldown || 0

        if (cooldown > 0) {

            const key =

                `${sender}:${command.name}`

            const now =
                Date.now()

            const expiration =
                cooldowns.get(key)

            if (

                expiration &&
                now < expiration

            ) {

                const left =

                    (
                        (expiration - now) / 1000
                    ).toFixed(1)

                return await sock.safeSendMessage(

                    from,

                    {

                        text:

                            ui.warn(

                                'COOLDOWN ACTIVO',

                                `Espera ${left}s antes de usar ${prefix}${command.name}.`

                            )

                    }

                )

            }

            cooldowns.set(

                key,

                now + cooldown * 1000

            )

        }

        // =========================
        // LOG
        // =========================

        logger.cmd(

            `${command.name} → ${sender.split('@')[0]}`

        )

        // =========================
        // RATE LIMIT
        // =========================

if (

    isLimited(
        sender,
        'commands'
    )

) {

    const left =

        getRemainingTime(

            sender,
            'commands'

        )

    return await sock.safeSendMessage(

        from,

        {

            text:

                ui.warn(

                    'RATE LIMIT',

                    `Estás usando demasiados comandos.\n\nEspera ${left}s.`

                )

        }

    )

}

// =========================
// GROUP LIMIT
// =========================

if (

    isGroupLimited(
        from,
        'commands'
    )

) {

    return await sock.safeSendMessage(

        from,

        {

            text:

                ui.warn(

                    'GRUPO SATURADO',

                    'Demasiados comandos en poco tiempo.'

                )

        }

    )

}

        // =========================
        // EXECUTE
        // =========================

        try {

            await command.execute({

                sock,
                msg,
                from,
                args,
                settings,
                prefix

            })

        } catch (err) {

            logger.error(

                `Execute ${command.name}: ${err.message}`

            )

            await sock.safeSendMessage(

                from,

                {

                    text:

                        ui.error(

                            'ERROR',

                            'Ocurrió un error ejecutando el comando.'

                        )

                }

            )

        }

    } catch (err) {

        logger.error(

            `CommandHandler Error: ${err.message}`

        )

    }

}
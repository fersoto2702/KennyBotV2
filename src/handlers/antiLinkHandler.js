const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../utils/logger')

const ui =
    require('../utils/ui')

const {

    isLimited,
    isGroupLimited,
    getRemainingTime

} = require('../system/rateLimiter')

// =========================
// PATHS
// =========================

const antiLinkPath =

    path.join(

        __dirname,

        '../../database/antilink.json'

    )

const warnsPath =

    path.join(

        __dirname,

        '../../database/warns.json'

    )

// =========================
// REGEX
// =========================

const linkRegex =

    /(https?:\/\/|www\.|chat\.whatsapp\.com|t\.me|discord\.gg)/gi

// =========================
// CONFIG
// =========================

const MAX_WARNS = 3

// =========================
// ENSURE DBS
// =========================

function ensureDatabases() {

    const databases = [

        [antiLinkPath, []],

        [warnsPath, {}]

    ]

    for (const [file, def] of databases) {

        if (!fs.existsSync(file)) {

            fs.writeFileSync(

                file,

                JSON.stringify(
                    def,
                    null,
                    2
                )

            )

        }

    }

}

// =========================
// EXPORT
// =========================

module.exports = async (

    sock,
    msg,
    from,
    text

) => {

    try {

        // =========================
        // GROUP ONLY
        // =========================

        if (
            !from.endsWith('@g.us')
        ) return

        // =========================
        // VALIDATE
        // =========================

        if (
            !text ||
            typeof text !== 'string'
        ) return

        // =========================
        // ENSURE DBS
        // =========================

        ensureDatabases()

        const antiLinkDB =

            JSON.parse(

                fs.readFileSync(
                    antiLinkPath
                )

            )

        const warns =

            JSON.parse(

                fs.readFileSync(
                    warnsPath
                )

            )

        // =========================
        // ENABLED?
        // =========================

        if (
            !antiLinkDB.includes(from)
        ) return

        // =========================
        // LINK?
        // =========================

        if (
            !linkRegex.test(text)
        ) return

        // =========================
        // SENDER
        // =========================

        const sender =

            msg.key.participant ||

            msg.participant

        if (!sender)
            return

        // =========================
        // RATE LIMIT
        // =========================

        if (

            isLimited(
                sender,
                'flood'
            )

        ) {

            logger.warn(

                `Flood AntiLink: ${sender.split('@')[0]}`

            )

            return

        }

        // =========================
        // GROUP PROTECTION
        // =========================

        if (

            isGroupLimited(
                from,
                'flood'
            )

        ) {

            logger.warn(

                `Grupo saturado AntiLink: ${from.split('@')[0]}`

            )

            return

        }

        // =========================
        // GROUP INFO
        // =========================

        const metadata =

            await sock.groupMetadata(
                from
            )

        const participants =

            metadata.participants || []

        const senderData =

            participants.find(

                p =>
                    p.id === sender

            )

        // =========================
        // ADMIN BYPASS
        // =========================

        const isAdmin =

            senderData?.admin === 'admin' ||

            senderData?.admin === 'superadmin'

        if (isAdmin)
            return

        // =========================
        // BOT ADMIN
        // =========================

        const botId =

            sock.user.id
                .split(':')[0]

        const botData =

            participants.find(

                p =>
                    p.id.includes(botId)

            )

        const botAdmin =

            botData?.admin === 'admin' ||

            botData?.admin === 'superadmin'

        if (!botAdmin) {

            return await sock.safeSendMessage(

                from,

                {

                    text:

                        ui.error(

                            'BOT SIN PERMISOS',

                            'El bot necesita ser administrador.'

                        )

                }

            )

        }

        logger.warn(

            `Link detectado: ${sender.split('@')[0]}`

        )

        // =========================
        // DELETE MESSAGE
        // =========================

        try {

            await sock.sendMessage(

                from,

                {

                    delete:
                        msg.key

                }

            )

            logger.event(

                `Mensaje eliminado: ${sender.split('@')[0]}`

            )

        } catch (err) {

            logger.error(

                `Delete error: ${err.message}`

            )

        }

        // =========================
        // WARNS
        // =========================

        if (!warns[sender]) {

            warns[sender] = {

                warns: 0

            }

        }

        warns[sender].warns += 1

        const total =

            warns[sender].warns

        // =========================
        // BAR
        // =========================

        const bar =

            '●'.repeat(
                Math.min(total, MAX_WARNS)
            ) +

            '○'.repeat(
                Math.max(0, MAX_WARNS - total)
            )

        // =========================
        // SAVE
        // =========================

        fs.writeFileSync(

            warnsPath,

            JSON.stringify(

                warns,
                null,
                2

            )

        )

        // =========================
        // WARN MESSAGE
        // =========================

        await sock.safeSendMessage(

            from,

            {

                text:

                    ui.warn(

                        'LINK ELIMINADO',

                        [

                            `Usuario: @${sender.split('@')[0]}`,

                            `Warns: ${bar} ${total}/${MAX_WARNS}`

                        ].join('\n')

                    ),

                mentions: [sender]

            }

        )

        // =========================
        // AUTO KICK
        // =========================

        if (
            total >= MAX_WARNS
        ) {

            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:

                            ui.error(

                                'USUARIO EXPULSADO',

                                `@${sender.split('@')[0]} acumuló ${MAX_WARNS} warns por enviar links.`

                            ),

                        mentions: [sender]

                    }

                )

                await sock.groupParticipantsUpdate(

                    from,

                    [sender],

                    'remove'

                )

                logger.event(

                    `Expulsado por links: ${sender.split('@')[0]}`

                )

                delete warns[sender]

                fs.writeFileSync(

                    warnsPath,

                    JSON.stringify(

                        warns,
                        null,
                        2

                    )

                )

            } catch (err) {

                logger.error(

                    `Kick error: ${err.message}`

                )

                await sock.safeSendMessage(

                    from,

                    {

                        text:

                            ui.error(

                                'ERROR',

                                'No pude expulsar al usuario.'

                            )

                    }

                )

            }

        }

    } catch (err) {

        logger.error(

            `AntiLink Error: ${err.message}`

        )

    }

}
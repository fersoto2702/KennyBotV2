const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../utils/logger')

const ui =
    require('../utils/ui')

const isGroupAdmin =
    require('../utils/isAdmin')

const {
    checkLimited,
    checkGroupLimited,
    getRemainingTime
} = require('../system/rateLimiter')

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

const linkRegex =
    /(https?:\/\/|www\.|chat\.whatsapp\.com|t\.me|discord\.gg)/i

const MAX_WARNS =
    3

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

function getBotProfile(
    sock
) {

    return (
        sock?.botProfile ||
        {
            id:
                'main',

            name:
                'KennyBot'
        }
    )

}

function getBotProfileId(
    sock
) {

    return String(
        sock?.botProfile?.id ||
        sock?.botProfileId ||
        'main'
    )
        .trim()
        .toLowerCase()

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

function ensureDirectory(
    file
) {

    const directory =
        path.dirname(
            file
        )

    if (
        !fs.existsSync(
            directory
        )
    ) {

        fs.mkdirSync(
            directory,
            {
                recursive:
                    true
            }
        )

    }

}

function ensureDatabases() {

    try {

        ensureDirectory(
            antiLinkPath
        )

        ensureDirectory(
            warnsPath
        )

        if (
            !fs.existsSync(
                antiLinkPath
            )
        ) {

            fs.writeFileSync(
                antiLinkPath,
                JSON.stringify(
                    [],
                    null,
                    2
                ),
                'utf8'
            )

        }

        if (
            !fs.existsSync(
                warnsPath
            )
        ) {

            fs.writeFileSync(
                warnsPath,
                JSON.stringify(
                    {},
                    null,
                    2
                ),
                'utf8'
            )

        }

    } catch (err) {

        logger.error(
            `AntiLink DB Init Error: ${err.stack || err.message}`
        )

    }

}

function readJson(
    file,
    fallback
) {

    try {

        const raw =
            fs.readFileSync(
                file,
                'utf8'
            )

        const parsed =
            JSON.parse(
                raw
            )

        return parsed

    } catch (err) {

        logger.error(
            `AntiLink JSON Read Error (${path.basename(file)}): ${err.stack || err.message}`
        )

        return fallback

    }

}

function writeJson(
    file,
    data
) {

    try {

        fs.writeFileSync(
            file,
            JSON.stringify(
                data,
                null,
                2
            ),
            'utf8'
        )

        return true

    } catch (err) {

        logger.error(
            `AntiLink JSON Write Error (${path.basename(file)}): ${err.stack || err.message}`
        )

        return false

    }

}

function isAntiLinkEnabled(
    database,
    group
) {

    if (
        !Array.isArray(
            database
        )
    ) {

        return false

    }

    return database.includes(
        group
    )

}

function ensureGroupWarns(
    warns,
    group
) {

    if (
        !warns[group] ||
        typeof warns[group] !==
        'object' ||
        Array.isArray(
            warns[group]
        )
    ) {

        warns[group] =
            {}

    }

    return warns[group]

}

function getUserWarns(
    warns,
    group,
    user
) {

    const groupWarns =
        ensureGroupWarns(
            warns,
            group
        )

    const current =
        groupWarns[user]

    if (
        typeof current ===
        'number'
    ) {

        return current

    }

    if (
        current &&
        typeof current.warns ===
        'number'
    ) {

        return current.warns

    }

    return 0

}

function setUserWarns(
    warns,
    group,
    user,
    total
) {

    const groupWarns =
        ensureGroupWarns(
            warns,
            group
        )

    groupWarns[user] =
        Number(
            total ||
            0
        )

}

function deleteUserWarns(
    warns,
    group,
    user
) {

    if (
        !warns[group] ||
        typeof warns[group] !==
        'object'
    ) {

        return

    }

    delete warns[group][user]

    if (
        Object.keys(
            warns[group]
        ).length ===
        0
    ) {

        delete warns[group]

    }

}

function buildWarnBar(
    total
) {

    return (

        '●'.repeat(
            Math.min(
                total,
                MAX_WARNS
            )
        )

        +

        '○'.repeat(
            Math.max(
                0,
                MAX_WARNS -
                total
            )
        )

    )

}

module.exports =
    async (
        sock,
        msg,
        from,
        text
    ) => {

        try {

            if (
                !from ||
                !from.endsWith(
                    '@g.us'
                )
            ) {

                return false

            }

            if (
                !text ||
                typeof text !==
                'string'
            ) {

                return false

            }

            ensureDatabases()

            const antiLinkDB =
                readJson(
                    antiLinkPath,
                    []
                )

            if (
                !isAntiLinkEnabled(
                    antiLinkDB,
                    from
                )
            ) {

                return false

            }

            if (
                !linkRegex.test(
                    text
                )
            ) {

                return false

            }

            const sender =
                normalizeJid(

                    msg.key?.participant ||

                    msg.participant ||

                    msg.key?.remoteJid

                )

            const senderAlt =
                normalizeJid(

                    msg.key?.participantAlt ||

                    msg.participantAlt ||

                    null

                )

            if (
                !sender
            ) {

                return false

            }

            const botProfileId =
                getBotProfileId(
                    sock
                )

            const botName =
                getBotName(
                    sock
                )

            if (
                checkLimited(
                    sender,
                    'flood',
                    botProfileId
                )
            ) {

                const remaining =
                    getRemainingTime(
                        sender,
                        'flood',
                        botProfileId
                    )

                logger.warn(
                    `${botName} | Flood AntiLink: ${sender.split('@')[0]} | ${remaining}s`
                )

                return true

            }

            if (
                checkGroupLimited(
                    from,
                    'flood',
                    botProfileId
                )
            ) {

                logger.warn(
                    `${botName} | Grupo saturado AntiLink: ${from.split('@')[0]}`
                )

                return true

            }

            let senderAdmin =
                await isGroupAdmin(
                    sock,
                    from,
                    sender
                )

            if (
                !senderAdmin &&
                senderAlt
            ) {

                senderAdmin =
                    await isGroupAdmin(
                        sock,
                        from,
                        senderAlt
                    )

            }

            if (
                senderAdmin
            ) {

                return false

            }

            const botJid =
                sock.user?.lid ||
                sock.user?.id

            const botAdmin =
                await isGroupAdmin(
                    sock,
                    from,
                    botJid
                )

            if (
                !botAdmin
            ) {

                await sock.safeSendMessage(
                    from,
                    {
                        text:
                            ui.error(
                                'BOT SIN PERMISOS',
                                'El bot necesita ser administrador.'
                            )
                    }
                )

                return true

            }

            logger.warn(
                `${botName} | Link detectado: ${sender.split('@')[0]}`
            )

            try {

                if (
                    typeof sock.safeDeleteMessage ===
                    'function'
                ) {

                    await sock.safeDeleteMessage(
                        from,
                        msg.key
                    )

                } else {

                    await sock.sendMessage(
                        from,
                        {
                            delete:
                                msg.key
                        }
                    )

                }

                logger.event(
                    `${botName} | Mensaje eliminado: ${sender.split('@')[0]}`
                )

            } catch (err) {

                logger.error(
                    `${botName} | Delete AntiLink Error: ${err.stack || err.message}`
                )

            }

            const warns =
                readJson(
                    warnsPath,
                    {}
                )

            const previousWarns =
                getUserWarns(
                    warns,
                    from,
                    sender
                )

            const total =
                previousWarns +
                1

            setUserWarns(
                warns,
                from,
                sender,
                total
            )

            const bar =
                buildWarnBar(
                    total
                )

            writeJson(
                warnsPath,
                warns
            )

            await sock.safeSendMessage(
                from,
                {
                    text:
                        ui.warn(
                            'LINK ELIMINADO',
                            [
                                `Usuario: @${sender.split('@')[0]}`,
                                `Warns: ${bar} ${total}/${MAX_WARNS}`
                            ]
                                .join('\n')
                        ),

                    mentions:
                        [sender]
                }
            )

            if (
                total >=
                MAX_WARNS
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

                            mentions:
                                [sender]
                        }
                    )

                    if (
                        typeof sock.safeGroupUpdate ===
                        'function'
                    ) {

                        await sock.safeGroupUpdate(
                            from,
                            [sender],
                            'remove'
                        )

                    } else {

                        await sock.groupParticipantsUpdate(
                            from,
                            [sender],
                            'remove'
                        )

                    }

                    logger.event(
                        `${botName} | Expulsado por links: ${sender.split('@')[0]}`
                    )

                    deleteUserWarns(
                        warns,
                        from,
                        sender
                    )

                    writeJson(
                        warnsPath,
                        warns
                    )

                } catch (err) {

                    logger.error(
                        `${botName} | Kick AntiLink Error: ${err.stack || err.message}`
                    )

                    try {

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

                    } catch {}

                }

            }

            return true

        } catch (err) {

            logger.error(
                `AntiLink Error: ${err.stack || err.message}`
            )

            return false

        }

    }
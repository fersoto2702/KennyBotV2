const fs =
    require('fs')

const path =
    require('path')

const settings =
    require('../src/config/settings')

const badgeHandler =
    require('../src/handlers/badgeHandler')

const antiLinkHandler =
    require('../src/handlers/antiLinkHandler')

const commandHandler =
    require('../src/handlers/commandHandler')

const spamHandler =
    require('../src/handlers/spamHandler')

const levelHandler =
    require('../src/handlers/levelHandler')

const economyHandler =
    require('../src/handlers/economyHandler')

const messageStatsHandler =
    require('../src/handlers/messageStatsHandler')

const {
    ensureMember
} = require(
    '../src/database/repositories/memberRepository'
)

const {
    ensureInitialGoldCard
} = require(
    '../src/database/repositories/memberCardRepository'
)

const {
    registerValidMessage,
    registerCommand
} = require(
    '../src/database/repositories/activityRepository'
)

const {
    registerSeasonMessage,
    registerSeasonCommand
} = require(
    '../src/database/repositories/seasonRepository'
)

const {
    checkCardUnlock
} = require(
    '../src/services/cardUnlockService'
)

const {
    syncMemberObjectivesByType
} = require(
    '../src/services/objectiveProgressService'
)

const getText =
    require('../src/utils/getText')

const logger =
    require('../src/utils/logger')

const processedMessages =
    new Set()

setInterval(
    () => {

        try {

            processedMessages.clear()

        } catch {}

    },
    1000 * 60 * 5
)

const mutePath =
    path.join(
        __dirname,
        '../database/mute.json'
    )

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

function isGroup(
    jid
) {

    return Boolean(
        jid &&
        jid.endsWith(
            '@g.us'
        )
    )

}

function getBotProfile(
    sock
) {

    return (
        sock?.botProfile ||
        settings?.bots?.main ||
        {
            id:
                'main',

            name:
                settings?.botName ||
                'KennyBot'
        }
    )

}

function getBotProfileId(
    sock
) {

    const profile =
        getBotProfile(
            sock
        )

    return String(
        profile?.id ||
        sock?.botProfileId ||
        'main'
    )
        .trim()
        .toLowerCase()

}

function getBotName(
    sock
) {

    const profile =
        getBotProfile(
            sock
        )

    return String(
        profile?.name ||
        settings?.botName ||
        'KennyBot'
    )
        .trim()

}

function getPrefixes() {

    return (
        Array.isArray(
            settings?.prefixes
        )
            ? settings.prefixes
            : [
                settings?.prefix ||
                '/'
            ]
    )
        .map(
            prefix =>
                String(
                    prefix ||
                    ''
                )
                    .trim()
        )
        .filter(
            Boolean
        )

}

function getMatchedPrefix(
    text
) {

    if (
        typeof text !==
        'string'
    ) {

        return null

    }

    return (
        getPrefixes()
            .find(
                prefix =>
                    text.startsWith(
                        prefix
                    )
            )
        ||
        null
    )

}

function getMaintenanceCommands() {

    return new Set(
        (
            Array.isArray(
                settings?.maintenanceCommands
            )
                ? settings.maintenanceCommands
                : []
        )
            .map(
                value =>
                    String(
                        value ||
                        ''
                    )
                        .trim()
                        .toLowerCase()
            )
            .filter(
                Boolean
            )
    )

}

function isCardSystemMaintenance() {

    const maintenance =
        getMaintenanceCommands()

    return (
        maintenance.has(
            'card'
        ) ||
        maintenance.has(
            'cardinfo'
        ) ||
        maintenance.has(
            'collection'
        ) ||
        maintenance.has(
            'equip'
        ) ||
        maintenance.has(
            'packs'
        ) ||
        maintenance.has(
            'openpack'
        ) ||
        maintenance.has(
            'pick'
        ) ||
        maintenance.has(
            'myclub'
        )
    )

}

function ensureMuteDb() {

    try {

        const directory =
            path.dirname(
                mutePath
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

        if (
            !fs.existsSync(
                mutePath
            )
        ) {

            fs.writeFileSync(
                mutePath,
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
            `Mute DB init error: ${err.stack || err.message}`
        )

    }

}

function readMuteDb() {

    ensureMuteDb()

    try {

        const data =
            JSON.parse(
                fs.readFileSync(
                    mutePath,
                    'utf8'
                )
            )

        if (
            !data ||
            typeof data !==
                'object' ||
            Array.isArray(
                data
            )
        ) {

            return {}

        }

        return data

    } catch (err) {

        logger.error(
            `Mute DB read error: ${err.stack || err.message}`
        )

        return {}

    }

}

function isUserMuted(
    from,
    sender,
    senderAlt
) {

    const data =
        readMuteDb()

    const list =
        Array.isArray(
            data[from]
        )
            ? data[from]
            : []

    const normalizedList =
        list
            .map(
                normalizeJid
            )
            .filter(
                Boolean
            )

    const normalizedSender =
        normalizeJid(
            sender
        )

    const normalizedAlt =
        normalizeJid(
            senderAlt
        )

    return (
        normalizedList.includes(
            normalizedSender
        )
        ||
        (
            normalizedAlt &&
            normalizedList.includes(
                normalizedAlt
            )
        )
    )

}

async function syncMessageObjectives(
    memberId
) {

    const types = [
        'MESSAGES',
        'ACTIVE_DAYS',
        'STREAK'
    ]

    for (
        const type
        of types
    ) {

        try {

            await syncMemberObjectivesByType(
                memberId,
                type
            )

        } catch (err) {

            logger.error(
                `Objective ${type} Sync Error: ${err.stack || err.message}`
            )

        }

    }

}

async function syncCommandObjectives(
    memberId
) {

    try {

        await syncMemberObjectivesByType(
            memberId,
            'COMMANDS'
        )

    } catch (err) {

        logger.error(
            `Objective COMMANDS Sync Error: ${err.stack || err.message}`
        )

    }

}

async function runCommand(
    sock,
    msg,
    from,
    text
) {

    return Boolean(
        await commandHandler({

            sock,

            msg,

            from,

            text,

            settings,

            botProfile:
                sock?.botProfile ||
                null

        })
    )

}

module.exports =
    async (
        sock,
        messages
    ) => {

        try {

            const msg =
                messages?.[0]

            if (
                !msg ||
                !msg.message
            ) {

                return

            }

            if (
                msg.key?.remoteJid ===
                'status@broadcast'
            ) {

                return

            }

            const from =
                normalizeJid(
                    msg.key?.remoteJid
                )

            if (
                !from
            ) {

                return

            }

            const isFromMe =
                msg.key?.fromMe ===
                true

            const botProfileId =
                getBotProfileId(
                    sock
                )

            const botName =
                getBotName(
                    sock
                )

            const sender =
                normalizeJid(

                    isFromMe

                        ? (
                            sock?.user?.lid ||
                            sock?.user?.id
                        )

                        : (
                            msg.key?.participant ||
                            msg.participant ||
                            msg.key?.remoteJid
                        )

                )

            const senderAlt =
                normalizeJid(

                    isFromMe

                        ? (
                            sock?.user?.id ||
                            sock?.user?.lid ||
                            null
                        )

                        : (
                            msg.key?.participantAlt ||
                            msg.participantAlt ||
                            null
                        )

                )

            if (
                !sender
            ) {

                return

            }

            const timestamp =
                Number(
                    msg.messageTimestamp ||
                    0
                )

            const now =
                Math.floor(
                    Date.now() /
                    1000
                )

            if (
                timestamp &&
                now -
                    timestamp >
                15
            ) {

                return

            }

            const messageId =
                msg.key?.id

            if (
                !messageId
            ) {

                return

            }

            const processedKey =
                [
                    botProfileId,
                    from,
                    messageId
                ]
                    .join(
                        ':'
                    )

            if (
                processedMessages.has(
                    processedKey
                )
            ) {

                return

            }

            processedMessages.add(
                processedKey
            )

            setTimeout(
                () => {

                    processedMessages.delete(
                        processedKey
                    )

                },
                30000
            )

            const text =
                getText(
                    msg
                )
                    ?.trim()

            if (
                !text
            ) {

                return

            }

            const matchedPrefix =
                getMatchedPrefix(
                    text
                )

            /*
             * Mensajes enviados desde la propia
             * cuenta conectada al bot.
             *
             * Solo permitimos comandos.
             *
             * Los mensajes normales se ignoran
             * para evitar loops y actividad falsa.
             */

            if (
                isFromMe
            ) {

                if (
                    !matchedPrefix
                ) {

                    return

                }

                logger.event(
                    `[${botProfileId}] SELF -> ${text}`
                )

                try {

                    return await runCommand(
                        sock,
                        msg,
                        from,
                        text
                    )

                } catch (err) {

                    logger.error(
                        `${botName} | Self Command Handler Error: ${err.stack || err.message}`
                    )

                    return false

                }

            }

            /*
             * A partir de aquí solamente se
             * procesan mensajes de otras cuentas.
             */

            if (
                isGroup(
                    from
                ) &&
                isUserMuted(
                    from,
                    sender,
                    senderAlt
                )
            ) {

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

                } catch (err) {

                    logger.error(
                        `${botName} | Delete muted msg: ${err.stack || err.message}`
                    )

                }

                return

            }

            logger.event(
                `[${botProfileId}] ${sender.split('@')[0]} -> ${text}`
            )

            let isSpam =
                false

            try {

                isSpam =
                    Boolean(
                        await spamHandler(
                            sock,
                            msg,
                            from
                        )
                    )

            } catch (err) {

                logger.error(
                    `${botName} | Spam Handler Error: ${err.stack || err.message}`
                )

            }

            if (
                isSpam
            ) {

                logger.warn(
                    `${botName} | Spam detectado: ${sender.split('@')[0]}`
                )

                return

            }

            let antiLinkBlocked =
                false

            try {

                antiLinkBlocked =
                    Boolean(
                        await antiLinkHandler(
                            sock,
                            msg,
                            from,
                            text
                        )
                    )

            } catch (err) {

                logger.error(
                    `${botName} | AntiLink Handler Error: ${err.stack || err.message}`
                )

            }

            if (
                antiLinkBlocked
            ) {

                return

            }

            let member =
                null

            try {

                member =
                    await ensureMember(
                        sender,
                        senderAlt,
                        msg.pushName ||
                        null
                    )

                if (
                    member &&
                    !isCardSystemMaintenance()
                ) {

                    try {

                        await ensureInitialGoldCard(
                            member.id
                        )

                    } catch (err) {

                        logger.error(
                            `${botName} | Member Card DB Error: ${err.stack || err.message}`
                        )

                    }

                }

            } catch (err) {

                logger.error(
                    `${botName} | Member DB Error: ${err.stack || err.message}`
                )

            }

            if (
                member
            ) {

                try {

                    await registerValidMessage(
                        member.id
                    )

                    await registerSeasonMessage(
                        member.id
                    )

                    await syncMessageObjectives(
                        member.id
                    )

                    if (
                        !isCardSystemMaintenance()
                    ) {

                        const unlock =
                            await checkCardUnlock(
                                member.id
                            )

                        if (
                            unlock?.unlocked &&
                            unlock?.card
                        ) {

                            const memberName =
                                member.display_name ||
                                msg.pushName ||
                                'Miembro'

                            logger.info(
                                `${botName} | Nueva carta desbloqueada: ${memberName} | ${unlock.card.card_name} | OVR ${unlock.card.rating}`
                            )

                            const unlockText = [
                                'ㅤ۟∩　ׅ　🎉　ׅ　*NUEVA CARTA*　ׄᰙ',
                                '',
                                `𖣣ֶㅤ֯⌗ 👤  ׄ ⬭ *Jugador:* ${memberName}`,
                                `𖣣ֶㅤ֯⌗ 🃏  ׄ ⬭ *Carta:* ${unlock.card.card_name}`,
                                `𖣣ֶㅤ֯⌗ ⭐  ׄ ⬭ *OVR:* ${unlock.card.rating}`,
                                '',
                                '╰─ 𓂃 Usa .card para ver tu nueva carta'
                            ]
                                .filter(
                                    Boolean
                                )
                                .join(
                                    '\n'
                                )

                            if (
                                typeof sock.safeSendMessage ===
                                'function'
                            ) {

                                await sock.safeSendMessage(
                                    from,
                                    {
                                        text:
                                            unlockText
                                    }
                                )

                            } else {

                                await sock.sendMessage(
                                    from,
                                    {
                                        text:
                                            unlockText
                                    }
                                )

                            }

                        }

                    }

                } catch (err) {

                    logger.error(
                        `${botName} | Activity/Card DB Error: ${err.stack || err.message}`
                    )

                }

            }

            try {

                await messageStatsHandler(
                    msg,
                    from
                )

            } catch (err) {

                logger.error(
                    `${botName} | Message Stats Handler Error: ${err.stack || err.message}`
                )

            }

            try {

                await levelHandler(
                    sock,
                    msg,
                    from
                )

            } catch (err) {

                logger.error(
                    `${botName} | Level Handler Error: ${err.stack || err.message}`
                )

            }

            try {

                await economyHandler(
                    sock,
                    msg,
                    from
                )

            } catch (err) {

                logger.error(
                    `${botName} | Economy Handler Error: ${err.stack || err.message}`
                )

            }

            try {

                await badgeHandler(
                    sock,
                    msg,
                    from
                )

            } catch (err) {

                logger.error(
                    `${botName} | Badge Handler Error: ${err.stack || err.message}`
                )

            }

            if (
                !matchedPrefix
            ) {

                return

            }

            let commandProcessed =
                false

            try {

                commandProcessed =
                    await runCommand(
                        sock,
                        msg,
                        from,
                        text
                    )

            } catch (err) {

                logger.error(
                    `${botName} | Command Handler Error: ${err.stack || err.message}`
                )

                return

            }

            if (
                commandProcessed &&
                member
            ) {

                try {

                    await registerCommand(
                        member.id
                    )

                    await registerSeasonCommand(
                        member.id
                    )

                    await syncCommandObjectives(
                        member.id
                    )

                } catch (err) {

                    logger.error(
                        `${botName} | Command Activity DB Error: ${err.stack || err.message}`
                    )

                }

            }

        } catch (err) {

            logger.error(
                `Messages Event Error: ${err.stack || err.message}`
            )

        }

    }
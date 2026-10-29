const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../utils/logger')

const ui =
    require('../utils/ui')

const {
    isGroupLimited
} = require('./rateLimiter')

const welcomePath =
    path.join(
        __dirname,
        '../../database/welcome.json'
    )

const joinPath =
    path.join(
        __dirname,
        '../../database/joinMessages.json'
    )

const goodbyePath =
    path.join(
        __dirname,
        '../../database/goodbyeMessages.json'
    )

const socketStates =
    new WeakMap()

const CONFIG = {

    cacheTime:
        60000,

    maxMentions:
        5,

    antiRaidLimit:
        10,

    antiRaidInterval:
        15000

}

const DEFAULTS = {

    welcome:
        false,

    goodbye:
        false,

    welcomeMessage:
        'Bienvenido/a {user} a *{group}*.\n\nAhora somos *{members}* miembros.',

    goodbyeMessage:
        'Hasta luego {user}.\n\nAhora somos *{members}* miembros en *{group}*.'

}

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

function getSocketState(
    sock
) {

    if (
        !sock ||
        (
            typeof sock !==
                'object' &&
            typeof sock !==
                'function'
        )
    ) {

        throw new Error(
            'Socket inválido'
        )

    }

    if (
        !socketStates.has(
            sock
        )
    ) {

        socketStates.set(
            sock,
            {

                metadataCache:
                    new Map(),

                joinTracker:
                    new Map()

            }
        )

    }

    return socketStates.get(
        sock
    )

}

function ensureFiles() {

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
                recursive:
                    true
            }
        )

    }

    const databases = [

        [
            welcomePath,
            {}
        ],

        [
            joinPath,
            {}
        ],

        [
            goodbyePath,
            {}
        ]

    ]

    for (
        const [
            file,
            defaultValue
        ]
        of databases
    ) {

        if (
            !fs.existsSync(
                file
            )
        ) {

            fs.writeFileSync(
                file,
                JSON.stringify(
                    defaultValue,
                    null,
                    2
                ),
                'utf8'
            )

        }

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

        return JSON.parse(
            raw
        )

    } catch {

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
            `WelcomeSystem Write Error (${path.basename(file)}): ${err.stack || err.message}`
        )

        return false

    }

}

function migrateLegacyWelcomeData(
    data
) {

    if (
        Array.isArray(
            data
        )
    ) {

        const migrated =
            {}

        for (
            const group
            of data
        ) {

            const groupJid =
                normalizeJid(
                    group
                )

            if (
                !groupJid
            ) {

                continue

            }

            migrated[groupJid] = {

                welcome:
                    true,

                goodbye:
                    true,

                welcomeMessage:
                    DEFAULTS.welcomeMessage,

                goodbyeMessage:
                    DEFAULTS.goodbyeMessage,

                updatedAt:
                    Date.now()

            }

        }

        writeJson(
            welcomePath,
            migrated
        )

        return migrated

    }

    if (
        !data ||
        typeof data !==
            'object'
    ) {

        return {}

    }

    return data

}

function readConfigDatabase() {

    ensureFiles()

    const data =
        readJson(
            welcomePath,
            {}
        )

    return migrateLegacyWelcomeData(
        data
    )

}

function getGroupConfig(
    groupJid
) {

    const normalized =
        normalizeJid(
            groupJid
        )

    const data =
        readConfigDatabase()

    const config =
        normalized
            ? data[normalized] || {}
            : {}

    return {

        welcome:
            config.welcome ===
                true,

        goodbye:
            config.goodbye ===
                true,

        welcomeMessage:
            typeof config.welcomeMessage ===
                'string' &&
            config.welcomeMessage.trim()
                ? config.welcomeMessage
                : DEFAULTS.welcomeMessage,

        goodbyeMessage:
            typeof config.goodbyeMessage ===
                'string' &&
            config.goodbyeMessage.trim()
                ? config.goodbyeMessage
                : DEFAULTS.goodbyeMessage,

        updatedAt:
            Number(
                config.updatedAt ||
                0
            )

    }

}

function updateGroupConfig(
    groupJid,
    changes
) {

    const normalized =
        normalizeJid(
            groupJid
        )

    if (
        !normalized ||
        !normalized.endsWith(
            '@g.us'
        )
    ) {

        return false

    }

    const data =
        readConfigDatabase()

    data[normalized] = {

        ...getGroupConfig(
            normalized
        ),

        ...changes,

        updatedAt:
            Date.now()

    }

    return writeJson(
        welcomePath,
        data
    )

}

function setWelcomeEnabled(
    groupJid,
    enabled
) {

    return updateGroupConfig(
        groupJid,
        {
            welcome:
                Boolean(
                    enabled
                )
        }
    )

}

function setGoodbyeEnabled(
    groupJid,
    enabled
) {

    return updateGroupConfig(
        groupJid,
        {
            goodbye:
                Boolean(
                    enabled
                )
        }
    )

}

function setWelcomeMessage(
    groupJid,
    message
) {

    const text =
        String(
            message ||
            ''
        )
            .trim()

    if (
        !text
    ) {

        return false

    }

    return updateGroupConfig(
        groupJid,
        {
            welcomeMessage:
                text
        }
    )

}

function setGoodbyeMessage(
    groupJid,
    message
) {

    const text =
        String(
            message ||
            ''
        )
            .trim()

    if (
        !text
    ) {

        return false

    }

    return updateGroupConfig(
        groupJid,
        {
            goodbyeMessage:
                text
        }
    )

}

function resetWelcomeMessage(
    groupJid
) {

    return updateGroupConfig(
        groupJid,
        {
            welcomeMessage:
                DEFAULTS.welcomeMessage
        }
    )

}

function resetGoodbyeMessage(
    groupJid
) {

    return updateGroupConfig(
        groupJid,
        {
            goodbyeMessage:
                DEFAULTS.goodbyeMessage
        }
    )

}

async function sendWelcomeMessage(
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

async function getProfilePicture(
    sock,
    user
) {

    try {

        if (
            typeof sock.profilePictureUrl !==
            'function'
        ) {

            return null

        }

        const url =
            await sock.profilePictureUrl(
                user,
                'image'
            )

        return (
            typeof url ===
                'string' &&
            url.trim()
                ? url.trim()
                : null
        )

    } catch {

        return null

    }

}


async function sendParticipantMessage(
    sock,
    groupJid,
    user,
    text
) {

    const profilePicture =
        await getProfilePicture(
            sock,
            user
        )

    if (
        profilePicture
    ) {

        try {

            return await sendWelcomeMessage(
                sock,
                groupJid,
                {
                    image: {
                        url:
                            profilePicture
                    },

                    caption:
                        text,

                    mentions: [
                        user
                    ]
                }
            )

        } catch (err) {

            logger.warn(
                `${getBotName(sock)} | No se pudo enviar foto de perfil de ${getDisplayNumber(user)}: ${err.message}`
            )

        }

    }

    return await sendWelcomeMessage(
        sock,
        groupJid,
        {
            text,

            mentions: [
                user
            ]
        }
    )

}

async function getMetadata(
    sock,
    group,
    forceRefresh = false
) {

    const groupJid =
        normalizeJid(
            group
        )

    if (
        !groupJid
    ) {

        throw new Error(
            'Grupo inválido'
        )

    }

    const state =
        getSocketState(
            sock
        )

    const now =
        Date.now()

    const cached =
        state.metadataCache.get(
            groupJid
        )

    if (
        !forceRefresh &&
        cached &&
        now -
            cached.timestamp <
            CONFIG.cacheTime
    ) {

        return cached.data

    }

    const metadata =
        await sock.groupMetadata(
            groupJid
        )

    state.metadataCache.set(
        groupJid,
        {

            data:
                metadata,

            timestamp:
                now

        }
    )

    return metadata

}

function detectRaid(
    sock,
    group,
    count = 1
) {

    const groupJid =
        normalizeJid(
            group
        )

    if (
        !groupJid
    ) {

        return false

    }

    const state =
        getSocketState(
            sock
        )

    const now =
        Date.now()

    const joins =
        state.joinTracker.get(
            groupJid
        ) ||
        []

    const filtered =
        joins.filter(
            timestamp =>
                now -
                    timestamp <
                CONFIG.antiRaidInterval
        )

    const additions =
        Math.max(
            1,
            Number(
                count
            ) ||
            1
        )

    for (
        let i = 0;
        i < additions;
        i++
    ) {

        filtered.push(
            now
        )

    }

    state.joinTracker.set(
        groupJid,
        filtered
    )

    return (
        filtered.length >=
        CONFIG.antiRaidLimit
    )

}

function getDisplayNumber(
    jid
) {

    const normalized =
        normalizeJid(
            jid
        )

    if (
        !normalized
    ) {

        return 'desconocido'

    }

    return normalized
        .split('@')[0]

}

function replaceVariables(
    template,
    {
        user,
        group,
        members,
        bot
    }
) {

    return String(
        template ||
        ''
    )
        .replace(
            /\{user\}/gi,
            user
        )
        .replace(
            /\{group\}/gi,
            group
        )
        .replace(
            /\{members\}/gi,
            String(
                members
            )
        )
        .replace(
            /\{bot\}/gi,
            bot
        )

}

async function welcomeSystem(
    sock,
    update
) {

    try {

        ensureFiles()

        const groupJid =
            normalizeJid(
                update?.id
            )

        if (
            !groupJid ||
            !groupJid.endsWith(
                '@g.us'
            )
        ) {

            return false

        }

        const action =
            String(
                update?.action ||
                ''
            )
                .trim()
                .toLowerCase()

        if (
            action !==
                'add' &&
            action !==
                'remove'
        ) {

            return false

        }

        const config =
            getGroupConfig(
                groupJid
            )

        if (
            action ===
                'add' &&
            !config.welcome
        ) {

            return false

        }

        if (
            action ===
                'remove' &&
            !config.goodbye
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

        const rawParticipants =
            Array.isArray(
                update?.participants
            )
                ? update.participants
                : []

        const participants =
            rawParticipants
                .map(
                    normalizeJid
                )
                .filter(
                    Boolean
                )
                .slice(
                    0,
                    CONFIG.maxMentions
                )

        if (
            participants.length ===
            0
        ) {

            return false

        }

        if (
            action ===
            'add'
        ) {

            if (
                detectRaid(
                    sock,
                    groupJid,
                    participants.length
                )
            ) {

                logger.warn(
                    `${botName} | Raid detectado: ${groupJid}`
                )

                await sendWelcomeMessage(
                    sock,
                    groupJid,
                    {
                        text:
                            ui.error(
                                'ANTI RAID',
                                'Demasiados usuarios entrando en poco tiempo.'
                            )
                    }
                )

                return false

            }

            if (
                isGroupLimited(
                    groupJid,
                    'joins',
                    botProfileId
                )
            ) {

                logger.warn(
                    `${botName} | Join flood: ${groupJid}`
                )

                return false

            }

        }

        const metadata =
            await getMetadata(
                sock,
                groupJid,
                true
            )

        const groupName =
            String(
                metadata?.subject ||
                'Grupo'
            )

        const memberCount =
            Array.isArray(
                metadata?.participants
            )
                ? metadata.participants.length
                : 0

        const legacyJoinMessages =
            action ===
            'add'
                ? readJson(
                    joinPath,
                    {}
                )
                : {}

        const legacyGoodbyeMessages =
            action ===
            'remove'
                ? readJson(
                    goodbyePath,
                    {}
                )
                : {}

        if (
            action ===
            'add'
        ) {

            const customMessages =
                Array.isArray(
                    legacyJoinMessages?.[
                        groupJid
                    ]
                )
                    ? legacyJoinMessages[
                        groupJid
                    ]
                    : []

            for (
                const user
                of participants
            ) {

                const number =
                    getDisplayNumber(
                        user
                    )

                const mention =
                    `@${number}`

                logger.event(
                    `${botName} | Join: ${number}`
                )

                const text =
                    replaceVariables(
                        config.welcomeMessage,
                        {
                            user:
                                mention,

                            group:
                                groupName,

                            members:
                                memberCount,

                            bot:
                                botName
                        }
                    )

                await sendParticipantMessage(
                    sock,
                    groupJid,
                    user,
                    text
                )

                for (
                    const message
                    of customMessages
                ) {

                    await sendWelcomeMessage(
                        sock,
                        groupJid,
                        {
                            text:
                                String(
                                    message
                                )
                                    .replace(
                                        /@user/g,
                                        mention
                                    ),

                            mentions: [
                                user
                            ]
                        }
                    )

                }

            }

            return true

        }

        if (
            action ===
            'remove'
        ) {

            const customMessages =
                Array.isArray(
                    legacyGoodbyeMessages?.[
                        groupJid
                    ]
                )
                    ? legacyGoodbyeMessages[
                        groupJid
                    ]
                    : []

            for (
                const user
                of participants
            ) {

                const number =
                    getDisplayNumber(
                        user
                    )

                const mention =
                    `@${number}`

                logger.event(
                    `${botName} | Leave: ${number}`
                )

                const text =
                    replaceVariables(
                        config.goodbyeMessage,
                        {
                            user:
                                mention,

                            group:
                                groupName,

                            members:
                                memberCount,

                            bot:
                                botName
                        }
                    )

                await sendParticipantMessage(
                    sock,
                    groupJid,
                    user,
                    text
                )

                for (
                    const message
                    of customMessages
                ) {

                    await sendWelcomeMessage(
                        sock,
                        groupJid,
                        {
                            text:
                                String(
                                    message
                                )
                                    .replace(
                                        /@user/g,
                                        mention
                                    ),

                            mentions: [
                                user
                            ]
                        }
                    )

                }

            }

            return true

        }

        return false

    } catch (err) {

        logger.error(
            `${getBotName(sock)} | WelcomeSystem Error: ${err.stack || err.message}`
        )

        return false

    }

}

welcomeSystem.clearMetadataCache =
    (
        sock,
        group = null
    ) => {

        const state =
            socketStates.get(
                sock
            )

        if (
            !state
        ) {

            return false

        }

        if (
            !group
        ) {

            state.metadataCache.clear()

            return true

        }

        const groupJid =
            normalizeJid(
                group
            )

        if (
            !groupJid
        ) {

            return false

        }

        return state.metadataCache.delete(
            groupJid
        )

    }

welcomeSystem.clearSocketState =
    sock => {

        if (
            !socketStates.has(
                sock
            )
        ) {

            return false

        }

        socketStates.delete(
            sock
        )

        return true

    }

welcomeSystem.getGroupConfig =
    getGroupConfig

welcomeSystem.setWelcomeEnabled =
    setWelcomeEnabled

welcomeSystem.setGoodbyeEnabled =
    setGoodbyeEnabled

welcomeSystem.setWelcomeMessage =
    setWelcomeMessage

welcomeSystem.setGoodbyeMessage =
    setGoodbyeMessage

welcomeSystem.resetWelcomeMessage =
    resetWelcomeMessage

welcomeSystem.resetGoodbyeMessage =
    resetGoodbyeMessage

welcomeSystem.DEFAULTS =
    DEFAULTS

module.exports =
    welcomeSystem
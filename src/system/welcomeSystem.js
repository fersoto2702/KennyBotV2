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
            []
        ],
        [
            joinPath,
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

        const parsed =
            JSON.parse(
                raw
            )

        return parsed

    } catch {

        return fallback

    }

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

        const welcomeGroups =
            readJson(
                welcomePath,
                []
            )

        if (
            !Array.isArray(
                welcomeGroups
            ) ||
            !welcomeGroups.includes(
                groupJid
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
                groupJid
            )

        const groupName =
            String(
                metadata?.subject ||
                'Grupo'
            )

        const joinMessages =
            action ===
            'add'
                ? readJson(
                    joinPath,
                    {}
                )
                : {}

        if (
            action ===
            'add'
        ) {

            const customMessages =
                Array.isArray(
                    joinMessages?.[
                        groupJid
                    ]
                )
                    ? joinMessages[
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

                logger.event(
                    `${botName} | Join: ${number}`
                )

                await sendWelcomeMessage(
                    sock,
                    groupJid,
                    {
                        text:
                            ui.success(
                                'BIENVENIDO',
                                [
                                    [
                                        'Usuario',
                                        `@${number}`
                                    ],
                                    [
                                        'Grupo',
                                        groupName
                                    ]
                                ]
                            ),

                        mentions:
                            [
                                user
                            ]
                    }
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
                                        `@${number}`
                                    ),

                            mentions:
                                [
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

            for (
                const user
                of participants
            ) {

                const number =
                    getDisplayNumber(
                        user
                    )

                logger.event(
                    `${botName} | Leave: ${number}`
                )

                await sendWelcomeMessage(
                    sock,
                    groupJid,
                    {
                        text:
                            ui.info(
                                'HASTA LUEGO',
                                [
                                    [
                                        'Usuario',
                                        `@${number}`
                                    ],
                                    [
                                        'Grupo',
                                        groupName
                                    ]
                                ]
                            ),

                        mentions:
                            [
                                user
                            ]
                    }
                )

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

module.exports =
    welcomeSystem
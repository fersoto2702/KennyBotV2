const logger =
    require('../utils/logger')

const socketCaches =
    new WeakMap()

const CACHE_TIME =
    60 * 1000

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

function getSocketCache(
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

        return null

    }

    if (
        !socketCaches.has(
            sock
        )
    ) {

        socketCaches.set(
            sock,
            new Map()
        )

    }

    return socketCaches.get(
        sock
    )

}

function getParticipantAliases(
    participant
) {

    if (
        !participant
    ) {

        return []

    }

    return [

        participant.id,

        participant.phoneNumber,

        participant.lid

    ]
        .map(
            normalizeJid
        )
        .filter(
            Boolean
        )

}

function participantIsAdmin(
    participant
) {

    return (
        participant?.admin ===
            'admin'
        ||
        participant?.admin ===
            'superadmin'
    )

}

function findBotParticipant(
    participants,
    sock
) {

    const botJids = [

        sock?.user?.id,

        sock?.user?.lid

    ]
        .map(
            normalizeJid
        )
        .filter(
            Boolean
        )

    if (
        botJids.length ===
        0
    ) {

        return null

    }

    return (
        participants.find(
            participant => {

                const aliases =
                    getParticipantAliases(
                        participant
                    )

                return botJids.some(
                    jid =>
                        aliases.includes(
                            jid
                        )
                )

            }
        )
        ||
        null
    )

}

async function getParticipants(
    sock,
    from,
    forceRefresh = false
) {

    const cache =
        getSocketCache(
            sock
        )

    if (
        !cache
    ) {

        throw new Error(
            'Socket inválido'
        )

    }

    const groupJid =
        normalizeJid(
            from
        )

    if (
        !groupJid ||
        !groupJid.endsWith(
            '@g.us'
        )
    ) {

        return []
    }

    const now =
        Date.now()

    const cached =
        cache.get(
            groupJid
        )

    if (
        !forceRefresh &&
        cached &&
        now <
        cached.expire
    ) {

        return cached.participants

    }

    const metadata =
        await sock.groupMetadata(
            groupJid
        )

    const participants =
        Array.isArray(
            metadata?.participants
        )
            ? metadata.participants
            : []

    cache.set(
        groupJid,
        {
            participants,

            expire:
                now +
                CACHE_TIME
        }
    )

    return participants

}

async function isBotAdmin(
    sock,
    from
) {

    try {

        const groupJid =
            normalizeJid(
                from
            )

        if (
            !groupJid ||
            !groupJid.endsWith(
                '@g.us'
            )
        ) {

            return false

        }

        let participants =
            await getParticipants(
                sock,
                groupJid,
                false
            )

        let bot =
            findBotParticipant(
                participants,
                sock
            )

        if (
            bot
        ) {

            return participantIsAdmin(
                bot
            )

        }

        participants =
            await getParticipants(
                sock,
                groupJid,
                true
            )

        bot =
            findBotParticipant(
                participants,
                sock
            )

        return participantIsAdmin(
            bot
        )

    } catch (err) {

        const botName =
            String(
                sock?.botProfile?.name ||
                'KennyBot'
            )
                .trim()

        logger.error(
            `${botName} | Error isBotAdmin: ${err.stack || err.message}`
        )

        return false

    }

}

isBotAdmin.clearCache =
    (
        from,
        sock
    ) => {

        const cache =
            socketCaches.get(
                sock
            )

        if (
            !cache
        ) {

            return false

        }

        const groupJid =
            normalizeJid(
                from
            )

        if (
            !groupJid
        ) {

            return false

        }

        return cache.delete(
            groupJid
        )

    }

isBotAdmin.clearSocketCache =
    sock => {

        if (
            !socketCaches.has(
                sock
            )
        ) {

            return false

        }

        socketCaches.delete(
            sock
        )

        return true

    }

isBotAdmin.normalizeJid =
    normalizeJid

isBotAdmin.findBotParticipant =
    findBotParticipant

module.exports =
    isBotAdmin
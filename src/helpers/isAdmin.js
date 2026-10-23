const logger =
    require('../utils/logger')

const socketCaches =
    new WeakMap()

const CACHE_TIME =
    10 * 1000

function getSocketCache(
    sock
) {

    if (
        !sock ||
        (
            typeof sock !== 'object' &&
            typeof sock !== 'function'
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

function isLid(
    jid
) {

    return String(
        jid || ''
    )
        .trim()
        .endsWith(
            '@lid'
        )

}

function getNumber(
    jid
) {

    const normalized =
        normalizeJid(
            jid
        )

    if (
        !normalized ||
        isLid(
            normalized
        )
    ) {

        return null

    }

    const number =
        normalized
            .split('@')[0]
            .replace(
                /\D/g,
                ''
            )

    return number ||
        null

}

function getParticipantJids(
    participant
) {

    if (!participant) {

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
        .filter(Boolean)

}

function findParticipant(
    participants,
    jid
) {

    if (
        !Array.isArray(
            participants
        )
    ) {

        return null

    }

    const target =
        normalizeJid(
            jid
        )

    if (!target) {

        return null

    }

    const exact =
        participants.find(
            participant => {

                const candidates =
                    getParticipantJids(
                        participant
                    )

                return candidates.includes(
                    target
                )

            }
        )

    if (
        exact
    ) {

        return exact

    }

    if (
        isLid(
            target
        )
    ) {

        return null

    }

    const targetNumber =
        getNumber(
            target
        )

    if (
        !targetNumber
    ) {

        return null

    }

    return (
        participants.find(
            participant => {

                const candidates =
                    getParticipantJids(
                        participant
                    )

                return candidates.some(
                    candidate => {

                        if (
                            isLid(
                                candidate
                            )
                        ) {

                            return false

                        }

                        const number =
                            getNumber(
                                candidate
                            )

                        return (
                            number &&
                            number ===
                            targetNumber
                        )

                    }
                )

            }
        ) ||
        null
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

async function getParticipants(
    sock,
    from,
    forceRefresh = false
) {

    if (
        !sock ||
        !from
    ) {

        return {
            participants:
                [],

            cached:
                false
        }

    }

    const cache =
        getSocketCache(
            sock
        )

    const now =
        Date.now()

    const cached =
        cache?.get(
            from
        )

    if (
        !forceRefresh &&
        cached &&
        now <
        cached.expire
    ) {

        return {
            participants:
                cached.participants,

            cached:
                true
        }

    }

    const metadata =
        await sock.groupMetadata(
            from
        )

    const participants =
        Array.isArray(
            metadata?.participants
        )
            ? metadata.participants
            : []

    cache?.set(
        from,
        {
            participants,

            expire:
                now +
                CACHE_TIME
        }
    )

    return {
        participants,

        cached:
            false
    }

}

async function isGroupAdmin(
    sock,
    from,
    sender
) {

    try {

        if (
            !sock ||
            !from ||
            !sender
        ) {

            return false

        }

        if (
            typeof from !==
            'string'
        ) {

            return false

        }

        if (
            !from.endsWith(
                '@g.us'
            )
        ) {

            return false

        }

        const normalizedSender =
            normalizeJid(
                sender
            )

        if (
            !normalizedSender
        ) {

            return false

        }

        let {
            participants,
            cached
        } =
            await getParticipants(
                sock,
                from
            )

        let member =
            findParticipant(
                participants,
                normalizedSender
            )

        if (
            participantIsAdmin(
                member
            )
        ) {

            return true

        }

        if (
            cached
        ) {

            const fresh =
                await getParticipants(
                    sock,
                    from,
                    true
                )

            participants =
                fresh.participants

            member =
                findParticipant(
                    participants,
                    normalizedSender
                )

        }

        return participantIsAdmin(
            member
        )

    } catch (err) {

        logger.error(
            `Error isAdmin: ${err.stack || err.message}`
        )

        return false

    }

}

isGroupAdmin.clearCache =
    function clearCache(
        from,
        sock = null
    ) {

        if (
            !from
        ) {

            return false

        }

        if (
            sock
        ) {

            const cache =
                socketCaches.get(
                    sock
                )

            if (
                !cache
            ) {

                return false

            }

            return cache.delete(
                from
            )

        }

        return false

    }

isGroupAdmin.clearSocketCache =
    function clearSocketCache(
        sock
    ) {

        if (
            !sock
        ) {

            return false

        }

        return socketCaches.delete(
            sock
        )

    }

isGroupAdmin.clearAllCache =
    function clearAllCache() {

        return false

    }

isGroupAdmin.normalizeJid =
    normalizeJid

isGroupAdmin.findParticipant =
    findParticipant

isGroupAdmin.participantIsAdmin =
    participantIsAdmin

module.exports =
    isGroupAdmin
const logger =
    require('../utils/logger')

const users =
    new Map()

const groups =
    new Map()

const CONFIG = {

    commands: {
        limit: 8,
        interval: 10000
    },

    media: {
        limit: 4,
        interval: 15000
    },

    stickers: {
        limit: 3,
        interval: 20000
    },

    mentions: {
        limit: 2,
        interval: 30000
    },

    flood: {
        limit: 15,
        interval: 10000
    },

    joins: {
        limit: 10,
        interval: 60000
    }

}

function normalizeKey(
    value
) {

    return String(
        value || ''
    )
        .trim()

}

function normalizeScope(
    scope
) {

    const value =
        String(
            scope || 'main'
        )
            .trim()
            .toLowerCase()

    return value ||
        'main'

}

function buildKey(
    value,
    scope
) {

    return [
        normalizeScope(
            scope
        ),
        normalizeKey(
            value
        )
    ]
        .join(':')

}

function clean(
    timestamps,
    interval
) {

    if (
        !Array.isArray(
            timestamps
        )
    ) {

        return []

    }

    const now =
        Date.now()

    return timestamps.filter(
        timestamp =>
            now -
            timestamp <
            interval
    )

}

function getUserBucket(
    user,
    scope = 'main'
) {

    const key =
        buildKey(
            user,
            scope
        )

    if (
        !users.has(
            key
        )
    ) {

        users.set(
            key,
            {}
        )

    }

    return users.get(
        key
    )

}

function getGroupBucket(
    group,
    scope = 'main'
) {

    const key =
        buildKey(
            group,
            scope
        )

    if (
        !groups.has(
            key
        )
    ) {

        groups.set(
            key,
            {}
        )

    }

    return groups.get(
        key
    )

}

function registerHit(
    bucket,
    type
) {

    const config =
        CONFIG[type]

    if (
        !config
    ) {

        return false

    }

    if (
        !Array.isArray(
            bucket[type]
        )
    ) {

        bucket[type] =
            []

    }

    bucket[type] =
        clean(
            bucket[type],
            config.interval
        )

    bucket[type].push(
        Date.now()
    )

    return (
        bucket[type].length >
        config.limit
    )

}

function checkBucket(
    bucket,
    type
) {

    const config =
        CONFIG[type]

    if (
        !config
    ) {

        return false

    }

    if (
        !Array.isArray(
            bucket[type]
        )
    ) {

        return false

    }

    bucket[type] =
        clean(
            bucket[type],
            config.interval
        )

    return (
        bucket[type].length >
        config.limit
    )

}

function isLimited(
    user,
    type,
    scope = 'main'
) {

    if (
        !user
    ) {

        return false

    }

    const bucket =
        getUserBucket(
            user,
            scope
        )

    return registerHit(
        bucket,
        type
    )

}

function checkLimited(
    user,
    type,
    scope = 'main'
) {

    if (
        !user
    ) {

        return false

    }

    const bucket =
        getUserBucket(
            user,
            scope
        )

    return checkBucket(
        bucket,
        type
    )

}

function isGroupLimited(
    group,
    type,
    scope = 'main'
) {

    if (
        !group
    ) {

        return false

    }

    const bucket =
        getGroupBucket(
            group,
            scope
        )

    return registerHit(
        bucket,
        type
    )

}

function checkGroupLimited(
    group,
    type,
    scope = 'main'
) {

    if (
        !group
    ) {

        return false

    }

    const bucket =
        getGroupBucket(
            group,
            scope
        )

    return checkBucket(
        bucket,
        type
    )

}

function resetUser(
    user,
    scope = 'main'
) {

    if (
        !user
    ) {

        return false

    }

    return users.delete(
        buildKey(
            user,
            scope
        )
    )

}

function resetGroup(
    group,
    scope = 'main'
) {

    if (
        !group
    ) {

        return false

    }

    return groups.delete(
        buildKey(
            group,
            scope
        )
    )

}

function getRemainingTime(
    user,
    type,
    scope = 'main'
) {

    const config =
        CONFIG[type]

    if (
        !config ||
        !user
    ) {

        return 0

    }

    const bucket =
        getUserBucket(
            user,
            scope
        )

    if (
        !Array.isArray(
            bucket[type]
        )
    ) {

        return 0

    }

    bucket[type] =
        clean(
            bucket[type],
            config.interval
        )

    if (
        bucket[type].length ===
        0
    ) {

        return 0

    }

    const oldest =
        bucket[type][0]

    const remaining =
        Math.ceil(
            (
                config.interval -
                (
                    Date.now() -
                    oldest
                )
            ) /
            1000
        )

    return Math.max(
        remaining,
        0
    )

}

setInterval(
    () => {

        try {

            for (
                const [
                    user,
                    data
                ]
                of users
            ) {

                let empty =
                    true

                for (
                    const type
                    in data
                ) {

                    const config =
                        CONFIG[type]

                    if (
                        !config
                    ) {

                        delete data[type]

                        continue

                    }

                    data[type] =
                        clean(
                            data[type],
                            config.interval
                        )

                    if (
                        data[type].length >
                        0
                    ) {

                        empty =
                            false

                    }

                }

                if (
                    empty
                ) {

                    users.delete(
                        user
                    )

                }

            }

            for (
                const [
                    group,
                    data
                ]
                of groups
            ) {

                let empty =
                    true

                for (
                    const type
                    in data
                ) {

                    const config =
                        CONFIG[type]

                    if (
                        !config
                    ) {

                        delete data[type]

                        continue

                    }

                    data[type] =
                        clean(
                            data[type],
                            config.interval
                        )

                    if (
                        data[type].length >
                        0
                    ) {

                        empty =
                            false

                    }

                }

                if (
                    empty
                ) {

                    groups.delete(
                        group
                    )

                }

            }

        } catch (err) {

            logger.error(
                `RateLimiter Cleanup: ${err.stack || err.message}`
            )

        }

    },
    60000
)

logger.success(
    'UnifiedRateLimiter cargado'
)

module.exports = {

    isLimited,

    checkLimited,

    isGroupLimited,

    checkGroupLimited,

    resetUser,

    resetGroup,

    getRemainingTime

}
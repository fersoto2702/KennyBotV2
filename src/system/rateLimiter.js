const logger =
    require('../utils/logger')

// =========================
// STORAGE
// =========================

const users =
    new Map()

const groups =
    new Map()

// =========================
// CONFIG
// =========================

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

// =========================
// CLEAN
// =========================

function clean(

    timestamps,
    interval

) {

    const now =
        Date.now()

    return timestamps.filter(

        t => now - t < interval

    )

}

// =========================
// USER BUCKET
// =========================

function getUserBucket(user) {

    if (!users.has(user)) {

        users.set(user, {})

    }

    return users.get(user)

}

// =========================
// GROUP BUCKET
// =========================

function getGroupBucket(group) {

    if (!groups.has(group)) {

        groups.set(group, {})

    }

    return groups.get(group)

}

// =========================
// HIT
// =========================

function hit(

    bucket,
    type

) {

    const config =
        CONFIG[type]

    if (!config)
        return false

    if (!bucket[type]) {

        bucket[type] = []

    }

    bucket[type] = clean(

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

// =========================
// USER LIMIT
// =========================

function isLimited(

    user,
    type

) {

    const bucket =
        getUserBucket(user)

    return hit(
        bucket,
        type
    )

}

// =========================
// GROUP LIMIT
// =========================

function isGroupLimited(

    group,
    type

) {

    const bucket =
        getGroupBucket(group)

    return hit(
        bucket,
        type
    )

}

// =========================
// RESET
// =========================

function resetUser(user) {

    users.delete(user)

}

function resetGroup(group) {

    groups.delete(group)

}

// =========================
// GET REMAINING
// =========================

function getRemainingTime(

    user,
    type

) {

    const config =
        CONFIG[type]

    if (!config)
        return 0

    const bucket =
        getUserBucket(user)

    if (
        !bucket[type] ||
        bucket[type].length === 0
    ) {

        return 0

    }

    const oldest =
        bucket[type][0]

    const remaining =

        Math.ceil(

            (
                config.interval -
                (Date.now() - oldest)
            ) / 1000

        )

    return Math.max(
        remaining,
        0
    )

}

// =========================
// CLEANUP
// =========================

setInterval(() => {

    try {

        const now =
            Date.now()

        for (const [user, data] of users) {

            let empty = true

            for (const type in data) {

                data[type] = clean(

                    data[type],

                    CONFIG[type]?.interval || 0

                )

                if (
                    data[type].length > 0
                ) {

                    empty = false

                }

            }

            if (empty) {

                users.delete(user)

            }

        }

        for (const [group, data] of groups) {

            let empty = true

            for (const type in data) {

                data[type] = clean(

                    data[type],

                    CONFIG[type]?.interval || 0

                )

                if (
                    data[type].length > 0
                ) {

                    empty = false

                }

            }

            if (empty) {

                groups.delete(group)

            }

        }

    } catch (err) {

        logger.error(

            `RateLimiter Cleanup: ${err.message}`

        )

    }

}, 60000)

// =========================
// READY
// =========================

logger.success(
    'UnifiedRateLimiter cargado'
)

module.exports = {

    isLimited,

    isGroupLimited,

    resetUser,

    resetGroup,

    getRemainingTime

}
const spamMap =
    new Map()

// =========================
// CONFIG
// =========================

const CLEANUP_TIME =
    60 * 1000

// =========================
// NORMALIZE
// =========================

const normalize = user =>

    user
        ?.split(':')[0]
        ?.trim()

// =========================
// CLEANUP
// =========================

setInterval(() => {

    const now =
        Date.now()

    for (const [user, timestamps] of spamMap) {

        const valid =
            timestamps.filter(
                t => now - t < CLEANUP_TIME
            )

        if (valid.length === 0) {

            spamMap.delete(user)

            continue

        }

        spamMap.set(user, valid)

    }

}, CLEANUP_TIME)

// =========================
// SPAM
// =========================

const isSpamming = (

    user,
    limit = 6,
    interval = 5000

) => {

    try {

        const now =
            Date.now()

        const id =
            normalize(user)

        if (!id)
            return false

        const timestamps =
            spamMap.get(id) || []

        const filtered =
            timestamps.filter(
                t => now - t < interval
            )

        filtered.push(now)

        spamMap.set(id, filtered)

        return filtered.length > limit

    } catch {

        return false

    }

}

// =========================
// MEDIA SIZE
// =========================

const isMediaTooLarge = (
    size,
    maxMB
) => {

    if (
        typeof size !== 'number'
    ) {

        return false

    }

    return (

        size / 1024 / 1024

    ) > maxMB

}

// =========================
// FORMAT SIZE
// =========================

const getFileSizeMB = bytes => {

    if (
        typeof bytes !== 'number'
    ) {

        return '0.00'

    }

    return (

        bytes / 1024 / 1024

    ).toFixed(2)

}

// =========================
// EXPORTS
// =========================

module.exports = {

    isSpamming,
    isMediaTooLarge,
    getFileSizeMB

}
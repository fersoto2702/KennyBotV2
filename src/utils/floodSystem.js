const floodMap =
    new Map()

const CLEANUP_TIME =
    60 * 1000

const normalize = user =>

    user
        ?.split(':')[0]
        ?.trim()

setInterval(() => {

    const now =
        Date.now()

    for (const [user, timestamps] of floodMap) {

        const valid =
            timestamps.filter(
                t => now - t < CLEANUP_TIME
            )

        if (valid.length === 0) {

            floodMap.delete(user)

            continue

        }

        floodMap.set(user, valid)

    }

}, CLEANUP_TIME)

const isFlooding = (

    user,
    limit = 5,
    interval = 7000

) => {

    try {

        const id =
            normalize(user)

        if (!id)
            return false

        const now =
            Date.now()

        const timestamps =
            floodMap.get(id) || []

        const filtered =
            timestamps.filter(
                t => now - t < interval
            )

        filtered.push(now)

        floodMap.set(id, filtered)

        return filtered.length > limit

    } catch {

        return false

    }

}

const resetFlood = user => {

    const id =
        normalize(user)

    if (!id)
        return

    floodMap.delete(id)

}

const getFloodCount = (

    user,
    interval = 7000

) => {

    const id =
        normalize(user)

    if (!id)
        return 0

    const now =
        Date.now()

    const timestamps =
        floodMap.get(id) || []

    return timestamps.filter(
        t => now - t < interval
    ).length

}

module.exports = {

    isFlooding,

    resetFlood,

    getFloodCount

}
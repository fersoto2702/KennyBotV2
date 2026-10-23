const floodMap =
    new Map()

const CLEANUP_TIME =
    60 * 1000

const normalizeUser =
    user => {

        if (!user) {

            return null

        }

        return String(
            user
        )
            .trim()
            .replace(
                /:\d+@/,
                '@'
            )

    }

const normalizeScope =
    scope => {

        const value =
            String(
                scope ||
                'main'
            )
                .trim()
                .toLowerCase()

        return value ||
            'main'

    }

const buildKey =
    (
        user,
        scope
    ) => {

        const normalizedUser =
            normalizeUser(
                user
            )

        if (
            !normalizedUser
        ) {

            return null

        }

        return [
            normalizeScope(
                scope
            ),
            normalizedUser
        ]
            .join(':')

    }

setInterval(
    () => {

        const now =
            Date.now()

        for (
            const [
                key,
                timestamps
            ]
            of floodMap
        ) {

            const valid =
                (
                    Array.isArray(
                        timestamps
                    )
                        ? timestamps
                        : []
                )
                    .filter(
                        timestamp =>
                            now -
                            timestamp <
                            CLEANUP_TIME
                    )

            if (
                valid.length ===
                0
            ) {

                floodMap.delete(
                    key
                )

                continue

            }

            floodMap.set(
                key,
                valid
            )

        }

    },
    CLEANUP_TIME
)

const isFlooding =
    (

        user,

        limit = 5,

        interval = 7000,

        scope = 'main'

    ) => {

        try {

            const key =
                buildKey(
                    user,
                    scope
                )

            if (
                !key
            ) {

                return false

            }

            const now =
                Date.now()

            const timestamps =
                floodMap.get(
                    key
                ) ||
                []

            const filtered =
                timestamps.filter(
                    timestamp =>
                        now -
                        timestamp <
                        interval
                )

            filtered.push(
                now
            )

            floodMap.set(
                key,
                filtered
            )

            return (
                filtered.length >
                limit
            )

        } catch {

            return false

        }

    }

const resetFlood =
    (

        user,

        scope = 'main'

    ) => {

        const key =
            buildKey(
                user,
                scope
            )

        if (
            !key
        ) {

            return false

        }

        return floodMap.delete(
            key
        )

    }

const resetFloodAllScopes =
    user => {

        const normalizedUser =
            normalizeUser(
                user
            )

        if (
            !normalizedUser
        ) {

            return 0

        }

        let removed =
            0

        for (
            const key
            of floodMap.keys()
        ) {

            if (
                key.endsWith(
                    `:${normalizedUser}`
                )
            ) {

                floodMap.delete(
                    key
                )

                removed++

            }

        }

        return removed

    }

const getFloodCount =
    (

        user,

        interval = 7000,

        scope = 'main'

    ) => {

        const key =
            buildKey(
                user,
                scope
            )

        if (
            !key
        ) {

            return 0

        }

        const now =
            Date.now()

        const timestamps =
            floodMap.get(
                key
            ) ||
            []

        const filtered =
            timestamps.filter(
                timestamp =>
                    now -
                    timestamp <
                    interval
            )

        if (
            filtered.length !==
            timestamps.length
        ) {

            if (
                filtered.length >
                0
            ) {

                floodMap.set(
                    key,
                    filtered
                )

            } else {

                floodMap.delete(
                    key
                )

            }

        }

        return filtered.length

    }

const getFloodStats =
    () => {

        return {

            entries:
                floodMap.size

        }

    }

module.exports = {

    isFlooding,

    resetFlood,

    resetFloodAllScopes,

    getFloodCount,

    getFloodStats

}
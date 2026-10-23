const spamMap =
    new Map()

const CLEANUP_TIME =
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

function buildSpamKey(
    user,
    scope
) {

    const id =
        normalizeJid(
            user
        )

    if (
        !id
    ) {

        return null

    }

    return [
        normalizeScope(
            scope
        ),
        id
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
            of spamMap
        ) {

            const valid =
                timestamps.filter(
                    timestamp =>
                        now -
                            timestamp <
                        CLEANUP_TIME
                )

            if (
                valid.length ===
                0
            ) {

                spamMap.delete(
                    key
                )

                continue

            }

            spamMap.set(
                key,
                valid
            )

        }

    },
    CLEANUP_TIME
)

const isSpamming =
    (
        user,
        limit = 6,
        interval = 5000,
        scope = 'main'
    ) => {

        try {

            const key =
                buildSpamKey(
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
                spamMap.get(
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

            spamMap.set(
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

const isMediaTooLarge =
    (
        size,
        maxMB
    ) => {

        if (
            typeof size !==
            'number'
        ) {

            return false

        }

        return (
            size /
            1024 /
            1024
        ) >
            maxMB

    }

const getFileSizeMB =
    bytes => {

        if (
            typeof bytes !==
            'number'
        ) {

            return '0.00'

        }

        return (
            bytes /
            1024 /
            1024
        )
            .toFixed(
                2
            )

    }

const resetSpam =
    (
        user,
        scope = 'main'
    ) => {

        const key =
            buildSpamKey(
                user,
                scope
            )

        if (
            !key
        ) {

            return false

        }

        return spamMap.delete(
            key
        )

    }

const getSpamStats =
    () => ({
        entries:
            spamMap.size
    })

module.exports = {
    isSpamming,
    isMediaTooLarge,
    getFileSizeMB,
    resetSpam,
    getSpamStats
}
const logger =
    require('../utils/logger')

const users =
    new Map()

const LIMIT =
    5

const TIME =
    10000

const CLEANUP_TIME =
    60000

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

function getBotId(
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

function buildUserKey(
    sock,
    from,
    sender
) {

    return [
        getBotId(
            sock
        ),
        normalizeJid(
            from
        ) || 'unknown',
        normalizeJid(
            sender
        ) || 'unknown'
    ]
        .join(':')

}

setInterval(
    () => {

        const now =
            Date.now()

        for (
            const [
                id,
                data
            ]
            of users
        ) {

            if (
                now -
                data.lastMessage >
                CLEANUP_TIME
            ) {

                users.delete(
                    id
                )

            }

        }

    },
    CLEANUP_TIME
)

module.exports =
    async (
        sock,
        msg,
        from
    ) => {

        try {

            const sender =
                normalizeJid(

                    msg.key?.participant ||

                    msg.participant ||

                    msg.key?.remoteJid

                )

            if (
                !sender
            ) {

                return false

            }

            const botJids = [

                sock.user?.id,

                sock.user?.lid

            ]
                .map(
                    normalizeJid
                )
                .filter(Boolean)

            if (
                botJids.includes(
                    sender
                )
            ) {

                return false

            }

            const key =
                buildUserKey(
                    sock,
                    from,
                    sender
                )

            const now =
                Date.now()

            if (
                !users.has(
                    key
                )
            ) {

                users.set(
                    key,
                    {
                        messages:
                            1,

                        firstMessage:
                            now,

                        lastMessage:
                            now
                    }
                )

                return false

            }

            const data =
                users.get(
                    key
                )

            if (
                now -
                data.firstMessage >
                TIME
            ) {

                data.messages =
                    1

                data.firstMessage =
                    now

                data.lastMessage =
                    now

                return false

            }

            data.messages++

            data.lastMessage =
                now

            if (
                data.messages >
                LIMIT
            ) {

                logger.warn(
                    `${getBotName(sock)} | Spam detectado: ${sender.split('@')[0]}`
                )

                return true

            }

            return false

        } catch (err) {

            logger.error(
                `Error SpamHandler: ${err.stack || err.message}`
            )

            return false

        }

    }
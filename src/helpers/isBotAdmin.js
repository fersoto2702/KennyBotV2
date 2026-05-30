const logger =
    require('../utils/logger')

const cache =
    new Map()

const CACHE_TIME =
    60 * 1000

const normalize = jid =>

    jid
        ?.split(':')[0]
        ?.split('@')[0]

module.exports = async (
    sock,
    from
) => {

    try {

        const now =
            Date.now()

        const cached =
            cache.get(from)

        let participants

        if (
            cached &&
            now < cached.expire
        ) {

            participants =
                cached.participants

        } else {

            const metadata =
                await sock.groupMetadata(from)

            participants =
                metadata.participants

            cache.set(from, {

                participants,
                expire:
                    now + CACHE_TIME

            })

        }

        const botId =
            normalize(sock.user.id)

        const bot =
            participants.find(
                p =>
                    normalize(p.id) ===
                    botId
            )

        return (

            bot?.admin === 'admin' ||

            bot?.admin === 'superadmin'

        )

    } catch (err) {

        logger.error(
            `Error isBotAdmin: ${err.message}`
        )

        return false

    }

}
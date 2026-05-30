const logger =
    require('../utils/logger')

const cache =
    new Map()

const CACHE_TIME =
    60 * 1000

const normalize = jid =>
    jid?.split(':')[0]

module.exports = async (sock, from, sender) => {

    try {

        const cached =
            cache.get(from)

        const now =
            Date.now()

        let participants

        if (cached && now < cached.expire) {

            participants =
                cached.participants

        } else {

            const metadata =
                await sock.groupMetadata(from)

            participants =
                metadata.participants

            cache.set(from, {
                participants,
                expire: now + CACHE_TIME
            })

        }

        const member =
            participants.find(
                p =>
                    normalize(p.id) ===
                    normalize(sender)
            )

        return (
            member?.admin === 'admin' ||
            member?.admin === 'superadmin'
        )

    } catch (err) {

        logger.error(
            `Error isAdmin: ${err.message}`
        )

        return false

    }

}
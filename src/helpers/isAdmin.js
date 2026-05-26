const logger =
    require('../utils/logger')

// =========================
// CACHE
// =========================

const cache =
    new Map()

const CACHE_TIME =
    60 * 1000

// =========================
// NORMALIZE
// =========================

const normalize = jid =>
    jid?.split(':')[0]

// =========================
// EXPORT
// =========================

module.exports = async (
    sock,
    from,
    sender
) => {

    try {

        // =========================
        // CACHE
        // =========================

        const cached =
            cache.get(from)

        const now =
            Date.now()

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

        // =========================
        // USER
        // =========================

        const member =
            participants.find(
                p =>
                    normalize(p.id) ===
                    normalize(sender)
            )

        // =========================
        // ADMIN
        // =========================

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
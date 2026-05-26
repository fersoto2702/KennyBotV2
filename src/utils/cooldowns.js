const cooldowns =
    new Map()

// =========================
// CONFIG
// =========================

const CLEANUP_INTERVAL =
    60 * 1000

// =========================
// NORMALIZE
// =========================

const normalize = jid =>

    jid
        ?.split(':')[0]
        ?.trim()

// =========================
// CLEANUP
// =========================

setInterval(() => {

    const now =
        Date.now()

    for (const [key, expire] of cooldowns) {

        if (now >= expire) {

            cooldowns.delete(key)

        }

    }

}, CLEANUP_INTERVAL)

// =========================
// COOLDOWN
// =========================

const checkCooldown = (

    user,
    command,
    seconds = 3

) => {

    try {

        const id =
            normalize(user)

        if (
            !id ||
            !command
        ) {

            return {
                active: false,
                left: 0
            }

        }

        const duration =
            Math.max(
                1,
                Number(seconds) || 1
            )

        const key =
            `${id}:${command}`

        const now =
            Date.now()

        const expire =
            cooldowns.get(key)

        // =========================
        // ACTIVE
        // =========================

        if (
            expire &&
            now < expire
        ) {

            return {

                active: true,

                left: Math.ceil(

                    (expire - now) / 1000

                )

            }

        }

        // =========================
        // SET
        // =========================

        cooldowns.set(

            key,

            now + duration * 1000

        )

        return {

            active: false,
            left: 0

        }

    } catch {

        return {

            active: false,
            left: 0

        }

    }

}

// =========================
// EXPORTS
// =========================

module.exports = {

    checkCooldown

}
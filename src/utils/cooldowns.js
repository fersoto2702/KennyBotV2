const cooldowns =
    new Map()

const CLEANUP_INTERVAL =
    60 * 1000

const normalize = jid =>

    jid
        ?.split(':')[0]
        ?.trim()

setInterval(() => {

    const now =
        Date.now()

    for (const [key, expire] of cooldowns) {

        if (now >= expire) {

            cooldowns.delete(key)

        }

    }

}, CLEANUP_INTERVAL)

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

module.exports = {

    checkCooldown

}
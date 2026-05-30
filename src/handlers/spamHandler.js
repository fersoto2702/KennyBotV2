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

setInterval(() => {

    const now =
        Date.now()

    for (const [id, data] of users) {

        if (now - data.lastMessage > CLEANUP_TIME) {
            users.delete(id)
        }

    }

}, CLEANUP_TIME)

module.exports = async (sock, msg, from) => {

    try {

        const sender =
            msg.key.participant ||
            msg.key.remoteJid

        if (sender === sock.user.id) {
            return false
        }

        const now =
            Date.now()

        if (!users.has(sender)) {

            users.set(sender, {
                messages: 1,
                firstMessage: now,
                lastMessage: now
            })

            return false

        }

        const data =
            users.get(sender)

        if (now - data.firstMessage > TIME) {

            data.messages     = 1
            data.firstMessage = now
            data.lastMessage  = now

            return false

        }

        data.messages++
        data.lastMessage = now

        if (data.messages > LIMIT) {

            logger.warn(
                `Spam detectado: ${sender.split('@')[0]}`
            )

            return true

        }

        return false

    } catch (err) {

        logger.error(
            `Error SpamHandler: ${err.message}`
        )

        return false

    }

}
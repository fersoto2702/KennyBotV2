const {
    registerMessage
} = require('../database/mysql')

const logger =
    require('../utils/logger')

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

module.exports =
    async (
        msg,
        from
    ) => {

        try {

            if (
                !from ||
                typeof from !==
                'string'
            ) {

                return false

            }

            if (
                !from.endsWith(
                    '@g.us'
                )
            ) {

                return false

            }

            if (
                !msg?.message
            ) {

                return false

            }

            if (
                msg.key?.fromMe
            ) {

                return false

            }

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

            await registerMessage(
                from,
                sender
            )

            return true

        } catch (err) {

            logger.error(
                `MessageStatsHandler: ${err.stack || err.message}`
            )

            return false

        }

    }
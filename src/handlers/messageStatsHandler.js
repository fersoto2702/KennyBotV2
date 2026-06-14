const { registerMessage } = require('../database/mysql')
const logger = require('../utils/logger')

module.exports = async ({ msg, from }) => {

    try {

        if (!from) return

        if (typeof from !== 'string') return

        if (!from.endsWith('@g.us')) return

        if (!msg?.message) return

        if (msg.key.fromMe) return

        const sender =
            msg.key.participant ||
            msg.participant ||
            msg.key.remoteJid

        if (!sender) return

        await registerMessage(from, sender)

    } catch (err) {
        logger.error(`MessageStatsHandler: ${err.message}`)
    }

}
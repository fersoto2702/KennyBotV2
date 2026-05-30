const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../utils/logger')

const statsPath =
    path.join(
        __dirname,
        '../../database/messages.json'
    )

let cache = {}

let changed = false

const ensureDb = () => {

    try {

        if (!fs.existsSync(statsPath)) {
            fs.writeFileSync(
                statsPath,
                JSON.stringify({}, null, 2)
            )
        }

        cache = JSON.parse(
            fs.readFileSync(statsPath, 'utf8')
        )

    } catch (err) {

        logger.error(
            `MessageStats Init Error: ${err.message}`
        )

        cache = {}

    }

}

ensureDb()

setInterval(() => {

    try {

        if (!changed) return

        fs.writeFileSync(
            statsPath,
            JSON.stringify(cache, null, 2)
        )

        changed = false

    } catch (err) {

        logger.error(
            `MessageStats Save Error: ${err.message}`
        )

    }

}, 30000)

module.exports = async (sock, msg, from) => {

    try {

        if (!from.endsWith('@g.us')) return

        const sender =
            msg.key.participant ||
            msg.participant ||
            msg.key.remoteJid

        if (!sender) return

        if (!cache[from]) {
            cache[from] = {}
        }

        if (!cache[from][sender]) {
            cache[from][sender] = {
                messages: 0,
                lastMessage: Date.now()
            }
        }

        cache[from][sender].messages += 1

        cache[from][sender].lastMessage =
            Date.now()

        changed = true

    } catch (err) {

        logger.error(
            `MessageStats Error: ${err.message}`
        )

    }

}
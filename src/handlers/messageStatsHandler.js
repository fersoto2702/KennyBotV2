const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../utils/logger')

// =========================
// PATH
// =========================

const statsPath =

    path.join(

        __dirname,

        '../../database/messages.json'

    )

// =========================
// CACHE
// =========================

let cache = {}

let changed = false

// =========================
// INIT
// =========================

const ensureDb = () => {

    try {

        if (
            !fs.existsSync(statsPath)
        ) {

            fs.writeFileSync(

                statsPath,

                JSON.stringify({}, null, 2)

            )

        }

        cache = JSON.parse(

            fs.readFileSync(
                statsPath,
                'utf8'
            )

        )

    } catch (err) {

        logger.error(

            `MessageStats Init Error: ${err.message}`

        )

        cache = {}

    }

}

ensureDb()

// =========================
// AUTO SAVE
// =========================

setInterval(() => {

    try {

        if (!changed)
            return

        fs.writeFileSync(

            statsPath,

            JSON.stringify(
                cache,
                null,
                2
            )

        )

        changed = false

    } catch (err) {

        logger.error(

            `MessageStats Save Error: ${err.message}`

        )

    }

}, 30000)

// =========================
// EXPORT
// =========================

module.exports = async (

    sock,
    msg,
    from

) => {

    try {

        // =========================
        // GROUP ONLY
        // =========================

        if (
            !from.endsWith('@g.us')
        ) return

        // =========================
        // USER
        // =========================

        const sender =

            msg.key.participant ||

            msg.participant ||

            msg.key.remoteJid

        if (!sender)
            return

        // =========================
        // GROUP
        // =========================

        if (!cache[from]) {

            cache[from] = {}

        }

        // =========================
        // USER DATA
        // =========================

        if (!cache[from][sender]) {

            cache[from][sender] = {

                messages: 0,

                lastMessage: Date.now()

            }

        }

        // =========================
        // UPDATE
        // =========================

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
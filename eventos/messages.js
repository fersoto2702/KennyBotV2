const settings =
    require('../src/config/settings')

const badgeHandler =
    require('../src/handlers/badgeHandler')

const antiLinkHandler =
    require('../src/handlers/antiLinkHandler')

const commandHandler =
    require('../src/handlers/commandHandler')

const spamHandler =
    require('../src/handlers/spamHandler')

const levelHandler =
    require('../src/handlers/levelHandler')

const economyHandler =
    require('../src/handlers/economyHandler')

const messageStatsHandler =
    require('../src/handlers/messageStatsHandler')

const getText =
    require('../src/utils/getText')

const logger =
    require('../src/utils/logger')

const ui =
    require('../src/utils/ui')

// =========================
// MESSAGE CACHE
// =========================

const processedMessages =
    new Set()

// =========================
// CLEANUP CACHE
// =========================

setInterval(() => {

    try {

        processedMessages.clear()

    } catch {}

}, 1000 * 60 * 5)

// =========================
// EXPORT
// =========================

module.exports = async (

    sock,
    messages

) => {

    try {

        // =========================
        // MESSAGE
        // =========================

        const msg =
            messages?.[0]

        // =========================
        // VALIDATE
        // =========================

        if (!msg)
            return

        if (!msg.message)
            return

        // =========================
        // IGNORE SELF
        // =========================

        if (msg.key?.fromMe)
            return

        // =========================
        // IGNORE STATUS
        // =========================

        if (

            msg.key?.remoteJid ===
            'status@broadcast'

        ) return

        // =========================
        // CHAT
        // =========================

        const from =
            msg.key?.remoteJid

        if (!from)
            return

        // =========================
        // TIMESTAMP
        // =========================

        const timestamp = Number(
            msg.messageTimestamp || 0
        )

        const now = Math.floor(
            Date.now() / 1000
        )

        // =========================
        // OLD MESSAGE
        // =========================

        if (

            timestamp &&
            now - timestamp > 15

        ) return

        // =========================
        // MESSAGE ID
        // =========================

        const messageId =
            msg.key?.id

        if (!messageId)
            return

        // =========================
        // DUPLICATE
        // =========================

        if (

            processedMessages.has(
                messageId
            )

        ) return

        processedMessages.add(
            messageId
        )

        setTimeout(() => {

            processedMessages.delete(
                messageId
            )

        }, 30000)

        // =========================
        // TEXT
        // =========================

        const text =
            getText(msg)?.trim()

        // =========================
        // EMPTY
        // =========================

        if (!text)
            return

        // =========================
        // LOG
        // =========================

        const sender =

            msg.key.participant ||

            msg.participant ||

            msg.key.remoteJid

        logger.event(

            `${sender?.split('@')[0]} -> ${text}`

        )

        // =========================
        // SPAM
        // =========================

        const isSpam =
            await spamHandler(

                sock,
                msg,
                from

            )

        if (isSpam) {

            logger.warn(
                `Spam detectado: ${sender?.split('@')[0]}`
            )

            return await sock.sendMessage(

                from,

                {

                    text: ui.warn(

                        'SPAM DETECTADO',

                        'Estás enviando mensajes demasiado rápido.\n\nEspera un momento antes de continuar.'

                    )

                }

            )

        }

        // =========================
        // MESSAGE STATS
        // =========================

        await messageStatsHandler(

            sock,
            msg,
            from

        )

        // =========================
        // ANTILINK
        // =========================

        await antiLinkHandler(

            sock,
            msg,
            from,
            text

        )

        // =========================
        // LEVELS
        // =========================

        await levelHandler(

            sock,
            msg,
            from

        )

        // =========================
        // ECONOMY
        // =========================

        await economyHandler(

            sock,
            msg,
            from

        )

        // =========================
        // BADGES
        // =========================

        await badgeHandler(

            sock,
            msg,
            from

        )

        // =========================
        // COMMANDS
        // =========================

        if (

            text.startsWith(
                settings.prefix
            )

        ) {

            await commandHandler({

                sock,
                msg,
                from,
                text,
                settings

            })

        }

    } catch (err) {

        logger.error(

            `Messages Event Error: ${err.message}`

        )

    }

}
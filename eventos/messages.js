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

const processedMessages =
    new Set()

setInterval(() => {

    try {
        processedMessages.clear()
    } catch {}

}, 1000 * 60 * 5)

module.exports = async (sock, messages) => {

    try {

        const msg =
            messages?.[0]

        if (!msg) return
        if (!msg.message) return
        if (msg.key?.fromMe) return

        if (
            msg.key?.remoteJid ===
            'status@broadcast'
        ) return

        const from =
            msg.key?.remoteJid

        if (!from) return

        const timestamp = Number(
            msg.messageTimestamp || 0
        )

        const now = Math.floor(
            Date.now() / 1000
        )

        if (
            timestamp &&
            now - timestamp > 15
        ) return

        const messageId =
            msg.key?.id

        if (!messageId) return

        if (processedMessages.has(messageId)) return

        processedMessages.add(messageId)

        setTimeout(() => {
            processedMessages.delete(messageId)
        }, 30000)

        const text =
            getText(msg)?.trim()

        if (!text) return

        const sender =
            msg.key.participant ||
            msg.participant ||
            msg.key.remoteJid

        logger.event(
            `${sender?.split('@')[0]} -> ${text}`
        )

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

        await messageStatsHandler(sock, msg, from)

        await antiLinkHandler(sock, msg, from, text)

        await levelHandler(sock, msg, from)

        await economyHandler(sock, msg, from)

        await badgeHandler(sock, msg, from)

        const prefixes =
            settings.prefixes ||
            [settings.prefix || '/']

        const isCommand =
            prefixes.some(
                p => text.startsWith(p)
            )

        if (isCommand) {

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
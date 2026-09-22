const fs = require('fs')
const path = require('path')

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

const {
    ensureMember
} = require('../src/database/repositories/memberRepository')

const getText =
    require('../src/utils/getText')

const logger =
    require('../src/utils/logger')

const ui =
    require('../src/utils/ui')


const processedMessages = new Set()


setInterval(() => {
    try {
        processedMessages.clear()
    } catch {}
}, 1000 * 60 * 5)


const mutePath =
    path.join(
        __dirname,
        '../database/mute.json'
    )


const ensureMuteDb = () => {
    if (!fs.existsSync(mutePath)) {
        fs.writeFileSync(
            mutePath,
            JSON.stringify({}, null, 2)
        )
    }
}


const isUserMuted = (from, sender, senderAlt) => {
    ensureMuteDb()

    let data = {}

    try {
        data = JSON.parse(
            fs.readFileSync(mutePath)
        )

        if (
            typeof data !== 'object' ||
            Array.isArray(data)
        ) {
            data = {}
        }

    } catch {
        data = {}
    }

    const list =
        data[from] || []

    return (
        list.includes(sender) ||
        (senderAlt && list.includes(senderAlt))
    )
}


const isGroup = jid =>
    jid.endsWith('@g.us')


module.exports = async (sock, messages) => {

    try {

        const msg =
            messages?.[0]

        if (!msg) return
        if (!msg.message) return

        // Ignorar mensajes enviados por el propio bot
        if (msg.key?.fromMe) return

        // Ignorar estados de WhatsApp
        if (
            msg.key?.remoteJid ===
            'status@broadcast'
        ) return


        const from =
            msg.key?.remoteJid

        if (!from) return


        /*
         * En grupos:
         * participant = persona que escribió.
         *
         * En chats privados:
         * remoteJid = persona que escribió.
         */
        const sender =
            msg.key.participant ||
            msg.participant ||
            msg.key.remoteJid

        const senderAlt =
            msg.key.participantAlt


        if (!sender) return


        /*
         * Sistema de mute
         */
        if (
            isGroup(from) &&
            isUserMuted(
                from,
                sender,
                senderAlt
            )
        ) {

            try {

                await sock.sendMessage(
                    from,
                    {
                        delete: msg.key
                    }
                )

            } catch (err) {

                logger.error(
                    `Delete muted msg: ${err.message}`
                )

            }

            return
        }


        /*
         * Ignorar mensajes antiguos
         */
        const timestamp =
            Number(
                msg.messageTimestamp || 0
            )

        const now =
            Math.floor(
                Date.now() / 1000
            )

        if (
            timestamp &&
            now - timestamp > 15
        ) return


        /*
         * Protección contra procesamiento duplicado
         */
        const messageId =
            msg.key?.id

        if (!messageId) return

        if (
            processedMessages.has(messageId)
        ) return

        processedMessages.add(messageId)

        setTimeout(() => {

            processedMessages.delete(
                messageId
            )

        }, 30000)


        /*
         * Obtener texto del mensaje
         */
        const text =
            getText(msg)?.trim()

        if (!text) return


        logger.event(
            `${sender?.split('@')[0]} -> ${text}`
        )


        /*
         * Anti-spam
         */
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

            return
        }


        /*
         * =====================================================
         * NUEVO SISTEMA DE MIEMBROS - MYSQL
         * =====================================================
         *
         * Registra al usuario en kb_members si todavía
         * no existe y crea kb_member_stats automáticamente.
         *
         * Si ya existe, no crea duplicados.
         */
        let member = null

        try {

            member =
                await ensureMember(
                    sender,
                    msg.pushName || null
                )

        } catch (err) {

            /*
             * Un fallo de MySQL en este sistema no debe
             * detener los demás sistemas de KennyBot.
             */
            logger.error(
                `Member DB Error: ${err.message}`
            )

        }


        /*
         * Sistemas actuales de KennyBot
         */
        await messageStatsHandler(
            msg,
            from
        )

        await antiLinkHandler(
            sock,
            msg,
            from,
            text
        )

        await levelHandler(
            sock,
            msg,
            from
        )

        await economyHandler(
            sock,
            msg,
            from
        )

        await badgeHandler(
            sock,
            msg,
            from
        )


        /*
         * Detectar comandos
         */
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
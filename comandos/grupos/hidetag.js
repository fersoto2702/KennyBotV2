const {
    generateWAMessageFromContent
} = require('@whiskeysockets/baileys')

const isGroupAdmin =
    require('../../src/utils/isAdmin')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const MAX_MENTIONS = 1000

function normalizeJid(participant) {
    if (!participant) return null

    const value =
        typeof participant === 'object'
            ? (
                participant.phoneNumber ||
                participant.id ||
                participant.lid ||
                null
            )
            : participant

    if (!value) return null

    return String(value)
        .trim()
        .replace(/:\d+@/, '@')
}

function uniqueJids(jids = []) {
    return [
        ...new Set(
            jids.filter(Boolean)
        )
    ]
}

function getBotName(sock) {
    return String(
        sock?.botProfile?.name ||
        'KennyBot'
    ).trim()
}

async function sendMessage(sock, jid, content) {
    if (typeof sock.safeSendMessage === 'function') {
        return await sock.safeSendMessage(jid, content)
    }

    return await sock.sendMessage(jid, content)
}

function getContextInfo(message) {
    if (!message || typeof message !== 'object') {
        return null
    }

    const possibleMessages = [
        message.extendedTextMessage,
        message.imageMessage,
        message.videoMessage,
        message.audioMessage,
        message.documentMessage,
        message.stickerMessage,
        message.buttonsResponseMessage,
        message.listResponseMessage,
        message.templateButtonReplyMessage
    ]

    for (const item of possibleMessages) {
        if (item?.contextInfo) {
            return item.contextInfo
        }
    }

    return null
}

function deepClone(value) {
    if (value === null || value === undefined) {
        return value
    }

    if (Buffer.isBuffer(value)) {
        return Buffer.from(value)
    }

    if (value instanceof Uint8Array) {
        return new Uint8Array(value)
    }

    if (Array.isArray(value)) {
        return value.map(deepClone)
    }

    if (typeof value === 'object') {
        const copy = {}

        for (const [key, item] of Object.entries(value)) {
            copy[key] = deepClone(item)
        }

        return copy
    }

    return value
}

function removeForwardFlags(value) {
    if (!value || typeof value !== 'object') {
        return
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            removeForwardFlags(item)
        }
        return
    }

    if (
        Object.prototype.hasOwnProperty.call(
            value,
            'isForwarded'
        )
    ) {
        delete value.isForwarded
    }

    if (
        Object.prototype.hasOwnProperty.call(
            value,
            'forwardingScore'
        )
    ) {
        delete value.forwardingScore
    }

    for (const item of Object.values(value)) {
        removeForwardFlags(item)
    }
}

function mergeMentions(contextInfo, mentions) {
    const previous =
        Array.isArray(contextInfo?.mentionedJid)
            ? contextInfo.mentionedJid
            : []

    return {
        ...(contextInfo || {}),
        mentionedJid: uniqueJids([
            ...previous,
            ...mentions
        ])
    }
}

function addHiddenMentions(message, mentions) {
    if (!message || typeof message !== 'object') {
        return message
    }

    if (typeof message.conversation === 'string') {
        const text = message.conversation

        delete message.conversation

        message.extendedTextMessage = {
            text,
            contextInfo: mergeMentions(
                null,
                mentions
            )
        }

        return message
    }

    const directKeys = [
        'extendedTextMessage',
        'imageMessage',
        'videoMessage',
        'audioMessage',
        'documentMessage',
        'stickerMessage',
        'pollCreationMessage',
        'pollCreationMessageV2',
        'pollCreationMessageV3',
        'pollResultSnapshotMessage',
        'newsletterAdminInviteMessage',
        'groupInviteMessage',
        'interactiveMessage',
        'productMessage'
    ]

    for (const key of directKeys) {
        const node = message[key]

        if (node && typeof node === 'object') {
            node.contextInfo = mergeMentions(
                node.contextInfo,
                mentions
            )

            return message
        }
    }

    const wrapperKeys = [
        'ephemeralMessage',
        'viewOnceMessage',
        'viewOnceMessageV2',
        'viewOnceMessageV2Extension',
        'documentWithCaptionMessage'
    ]

    for (const key of wrapperKeys) {
        const nested = message[key]?.message

        if (nested && typeof nested === 'object') {
            addHiddenMentions(
                nested,
                mentions
            )

            return message
        }
    }

    message.messageContextInfo = {
        ...(message.messageContextInfo || {}),
        mentionedJid: mentions
    }

    return message
}

function getQuotedType(quoted) {
    if (!quoted || typeof quoted !== 'object') {
        return 'mensaje'
    }

    if (
        quoted.pollCreationMessage ||
        quoted.pollCreationMessageV2 ||
        quoted.pollCreationMessageV3
    ) {
        return 'encuesta'
    }

    if (quoted.pollResultSnapshotMessage) {
        return 'resultado de encuesta'
    }

    if (quoted.imageMessage) return 'imagen'
    if (quoted.videoMessage) return 'video'
    if (quoted.audioMessage) return 'audio'
    if (quoted.documentMessage) return 'documento'
    if (quoted.stickerMessage) return 'sticker'
    if (quoted.newsletterAdminInviteMessage) return 'canal'
    if (quoted.groupInviteMessage) return 'invitación de grupo'
    if (quoted.interactiveMessage) return 'mensaje interactivo'
    if (quoted.productMessage) return 'producto'

    if (
        quoted.extendedTextMessage
            ?.contextInfo
            ?.forwardedNewsletterMessageInfo
    ) {
        return 'publicación de canal'
    }

    if (
        quoted.extendedTextMessage?.canonicalUrl ||
        quoted.extendedTextMessage?.matchedText ||
        quoted.extendedTextMessage?.jpegThumbnail
    ) {
        return 'enlace con vista previa'
    }

    if (
        quoted.conversation ||
        quoted.extendedTextMessage
    ) {
        return 'texto'
    }

    return 'mensaje'
}

async function resendAsNewMessage({
    sock,
    from,
    quoted,
    mentions
}) {
    const freshContent = deepClone(quoted)

    removeForwardFlags(freshContent)
    addHiddenMentions(freshContent, mentions)

    const generated =
        generateWAMessageFromContent(
            from,
            freshContent,
            {
                userJid:
                    normalizeJid(sock?.user?.id) ||
                    sock?.user?.id
            }
        )

    await sock.relayMessage(
        from,
        generated.message,
        {
            messageId: generated.key.id
        }
    )

    return true
}

module.exports = {
    name: 'hidetag',

    aliases: [
        'htag',
        'ghosttag',
        'tag'
    ],

    description:
        'Publica un mensaje mencionando a todos de forma oculta',

    category: 'grupos',

    adminOnly: true,
    groupOnly: true,

    async execute({
        sock,
        from,
        args,
        msg
    }) {
        try {
            if (
                !from ||
                !from.endsWith('@g.us')
            ) {
                return await sendMessage(
                    sock,
                    from,
                    {
                        text: ui.error(
                            'SOLO GRUPOS',
                            'Este comando solo funciona en grupos.'
                        )
                    }
                )
            }

            try {
                await sock.sendPresenceUpdate(
                    'composing',
                    from
                )
            } catch {}

            const sender =
                normalizeJid(
                    msg?.key?.fromMe
                        ? (
                            sock?.user?.lid ||
                            sock?.user?.id
                        )
                        : (
                            msg?.key?.participant ||
                            msg?.participant ||
                            msg?.key?.remoteJid
                        )
                )

            if (!sender) {
                return await sendMessage(
                    sock,
                    from,
                    {
                        text: ui.error(
                            'ERROR DE USUARIO',
                            'No se pudo identificar al usuario que ejecutó el comando.'
                        )
                    }
                )
            }

            const admin =
                await isGroupAdmin(
                    sock,
                    from,
                    sender
                )

            if (!admin) {
                return await sendMessage(
                    sock,
                    from,
                    {
                        text: ui.error(
                            'ACCESO DENEGADO',
                            'Solo administradores pueden usar este comando.'
                        )
                    }
                )
            }

            const metadata =
                await sock.groupMetadata(from)

            const participants =
                Array.isArray(metadata?.participants)
                    ? metadata.participants
                    : []

            if (participants.length === 0) {
                return await sendMessage(
                    sock,
                    from,
                    {
                        text: ui.warn(
                            'GRUPO VACÍO',
                            'No hay participantes para mencionar.'
                        )
                    }
                )
            }

            const mentions =
                uniqueJids(
                    participants
                        .slice(0, MAX_MENTIONS)
                        .map(
                            participant =>
                                normalizeJid(participant)
                        )
                )

            if (mentions.length === 0) {
                return await sendMessage(
                    sock,
                    from,
                    {
                        text: ui.error(
                            'SIN MENCIONES',
                            'No se pudieron obtener identificadores válidos de los participantes.'
                        )
                    }
                )
            }

            const contextInfo =
                getContextInfo(msg?.message)

            const quoted =
                contextInfo?.quotedMessage

            if (quoted) {
                const quotedType =
                    getQuotedType(quoted)

                await resendAsNewMessage({
                    sock,
                    from,
                    quoted,
                    mentions
                })

                logger.event(
                    `Hidetag publicado en ${from.split('@')[0]} por ${sender.split('@')[0]} | ${mentions.length} menciones | ${quotedType}`
                )

                return true
            }

            const text =
                Array.isArray(args)
                    ? args.join(' ').trim()
                    : ''

            if (!text) {
                return await sendMessage(
                    sock,
                    from,
                    {
                        text: ui.warn(
                            'MENSAJE REQUERIDO',
                            [
                                'Escribe un mensaje o responde al contenido que quieras publicar.',
                                '',
                                'Ejemplos:',
                                '/hidetag Aviso importante',
                                '/hidetag respondiendo a texto, imagen, video, audio, sticker, documento, encuesta o publicación.'
                            ].join('\n')
                        )
                    }
                )
            }

            await sendMessage(
                sock,
                from,
                {
                    text,
                    mentions
                }
            )

            logger.event(
                `Hidetag usado en ${from.split('@')[0]} por ${sender.split('@')[0]} | ${mentions.length} menciones | texto`
            )

            return true

        } catch (err) {
            logger.error(
                `${getBotName(sock)} | Error hidetag: ${err.stack || err.message}`
            )

            try {
                await sendMessage(
                    sock,
                    from,
                    {
                        text: ui.error(
                            'ERROR HIDETAG',
                            'No se pudo publicar el mensaje con menciones ocultas.'
                        )
                    }
                )
            } catch {}

            return false
        }
    }
}
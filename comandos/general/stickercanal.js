const core = require('../../src/system/soundStickerCore')
const settings = require('../../src/config/settings')

const COOLDOWN_MS = 15000
const lastUse = new Map()
const CHANNEL_LINK = /^https:\/\/(?:www\.)?whatsapp\.com\/channel\/([A-Za-z0-9_-]{15,40})\/?(?:\?[^\s]*)?$/i

function unwrap(message) {
    let current = message || {}

    for (let i = 0; i < 8; i++) {
        const next =
            current.ephemeralMessage?.message ||
            current.viewOnceMessage?.message ||
            current.viewOnceMessageV2?.message ||
            current.viewOnceMessageV2Extension?.message ||
            current.documentWithCaptionMessage?.message

        if (!next) break
        current = next
    }

    return current
}

function mediaFrom(message) {
    const content = unwrap(message)

    if (content.videoMessage) {
        return { type: 'video', data: content.videoMessage }
    }

    if (content.stickerMessage) {
        return { type: 'sticker', data: content.stickerMessage }
    }

    return null
}

function resolveMedia(msg) {
    const content = unwrap(msg?.message)

    for (const type of [
        'extendedTextMessage',
        'imageMessage',
        'videoMessage',
        'stickerMessage',
        'documentMessage'
    ]) {
        const quoted = content[type]?.contextInfo?.quotedMessage
        const media = quoted ? mediaFrom(quoted) : null

        if (media) return media
    }

    return mediaFrom(msg?.message)
}

function channelCode(value) {
    const match = CHANNEL_LINK.exec(String(value || '').trim())
    return match ? match[1] : null
}

function viewerRole(metadata) {
    const raw =
        metadata?.viewer_metadata?.role ||
        metadata?.viewerMetadata?.role ||
        metadata?.result?.viewer_metadata?.role ||
        metadata?.result?.viewerMetadata?.role ||
        ''

    return String(raw).trim().toUpperCase()
}

function isOwner(msg) {
    if (msg?.key?.fromMe) return true

    const sender = String(
        msg?.key?.participant ||
        msg?.key?.participantAlt ||
        msg?.participant ||
        msg?.key?.remoteJid ||
        ''
    ).split('@')[0].split(':')[0].replace(/\D/g, '')

    const owners = [settings.ownerNumber]
        .flat(Infinity)
        .map(value => String(value || '').replace(/\D/g, ''))
        .filter(Boolean)

    return Boolean(sender && owners.includes(sender))
}

function senderId(msg) {
    return String(
        msg?.key?.participant ||
        msg?.key?.participantAlt ||
        msg?.key?.remoteJid ||
        ''
    )
}

function remainingCooldown(id) {
    const last = lastUse.get(id) || 0
    return Math.max(0, COOLDOWN_MS - (Date.now() - last))
}

function mapError(error) {
    const reason = String(error?.data || error?.message || error || '')
    const lower = reason.toLowerCase()

    if (lower.includes('429') || lower.includes('rate')) {
        return 'WhatsApp limitó temporalmente los envíos. Inténtalo más tarde.'
    }

    if (lower.includes('403') || lower.includes('forbidden') || lower.includes('not-authorized')) {
        return 'WhatsApp rechazó la publicación. Comprueba los permisos de administrador de la sesión conectada.'
    }

    if (lower.includes('404') || lower.includes('item-not-found')) {
        return 'No se encontró el canal o su enlace dejó de ser válido.'
    }

    return reason.slice(0, 300)
}

function instructions() {
    return [
        '🔊 *KENNYBOT V2 · STICKER A CANAL*',
        '',
        'Responde a un video con sonido o a un sticker sonoro usando:',
        '',
        '*.stickercanal https://whatsapp.com/channel/CODIGO*',
        '',
        'Solo se aceptan enlaces completos HTTPS de canales.',
        'El número conectado a KennyBot debe tener permiso para publicar.',
        'El sonido de stickers en canales es una función experimental.'
    ].join('\n')
}

async function reply(sock, chat, msg, text) {
    return sock.sendMessage(chat, { text }, { quoted: msg })
}

async function updateStatus(sock, chat, key, text) {
    if (!key) return

    try {
        await sock.sendMessage(chat, { text, edit: key })
    } catch (error) {
        console.error('[stickercanal] No se pudo editar el estado:', error.message)
        await sock.sendMessage(chat, { text }).catch(() => {})
    }
}

async function resolveChannel(sock, code) {
    const metadata = await sock.newsletterMetadata('invite', code)
    const jid = String(metadata?.id || metadata?.result?.id || '')

    if (!jid.endsWith('@newsletter')) {
        throw new Error('WhatsApp no devolvió un identificador válido del canal.')
    }

    let role = viewerRole(metadata)
    let name = metadata?.name || metadata?.result?.name || jid

    if (!role) {
        try {
            const byJid = await sock.newsletterMetadata('jid', jid)
            role = viewerRole(byJid)
            name = byJid?.name || byJid?.result?.name || name
        } catch (error) {
            console.warn('[stickercanal] La consulta del canal por JID no devolvió el rol:', error.message)
        }
    }

    return { jid, role, name }
}

async function execute({ sock, msg, from, args = [] }) {
    const chat = from || msg?.key?.remoteJid

    if (!isOwner(msg)) {
        return reply(sock, chat, msg, '🔒 Este comando es exclusivo del propietario de KennyBot.')
    }

    const code = channelCode(args[0])

    if (!code || args.length !== 1) {
        return reply(sock, chat, msg, instructions())
    }

    const chosen = resolveMedia(msg)

    if (!chosen) {
        return reply(sock, chat, msg, '❌ Responde a un video con sonido o a un sticker sonoro y escribe el comando con el enlace del canal.')
    }

    const id = senderId(msg)
    const waitMs = remainingCooldown(id)

    if (waitMs) {
        return reply(sock, chat, msg, `⏳ Espera ${Math.ceil(waitMs / 1000)} segundos antes de volver a publicar.`)
    }

    if (typeof sock.newsletterMetadata !== 'function') {
        return reply(sock, chat, msg, '❌ Esta versión de Baileys no dispone de newsletterMetadata().')
    }

    const status = await reply(sock, chat, msg, '⏳ Consultando el canal y sus permisos…')
    let channel

    try {
        channel = await resolveChannel(sock, code)
    } catch (error) {
        console.error('[stickercanal] Consulta:', error)
        return updateStatus(sock, chat, status?.key, `❌ ${mapError(error)}`)
    }

    if (channel.role && !['ADMIN', 'OWNER'].includes(channel.role)) {
        return updateStatus(
            sock,
            chat,
            status?.key,
            `🔒 La cuenta conectada figura como *${channel.role}* en este canal y no puede publicar.`
        )
    }

    if (!channel.role) {
        console.warn(`[stickercanal] Rol no disponible para ${channel.jid}. WhatsApp validará el permiso al publicar.`)
    }

    await updateStatus(sock, chat, status?.key, '⏳ Preparando el sticker y solicitando su publicación…')
    lastUse.set(id, Date.now())

    try {
        if (chosen.type === 'video') {
            if (typeof core.makeAndSend !== 'function') {
                throw new Error('soundStickerCore no exporta makeAndSend().')
            }

            await core.makeAndSend(
                sock,
                channel.jid,
                chosen,
                null,
                msg,
                { soundMode: 'original', fit: 'cuadrado' }
            )
        } else {
            if (typeof core.relayExistingSoundSticker !== 'function') {
                throw new Error('soundStickerCore no exporta relayExistingSoundSticker().')
            }

            await core.relayExistingSoundSticker(sock, channel.jid, chosen.data)
        }

        console.log(`[stickercanal] Envío solicitado: ${channel.name} (${channel.jid})`)

        return updateStatus(
            sock,
            chat,
            status?.key,
            `✅ Envío solicitado al canal *${channel.name}*.\nℹ️ Comprueba que WhatsApp haya publicado el sticker con sonido.`
        )
    } catch (error) {
        lastUse.delete(id)
        console.error('[stickercanal] Error de envío:', error)
        return updateStatus(sock, chat, status?.key, `❌ No se pudo publicar el sticker.\n${mapError(error)}`)
    }
}

module.exports = {
    name: 'stickercanal',
    aliases: ['stcanal'],
    category: 'general',
    description: 'Publicar stickers con sonido mediante enlaces de canales de WhatsApp',
    execute
}
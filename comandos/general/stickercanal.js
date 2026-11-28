'use strict'

const core = require('../../src/system/soundStickerCore')
const settings = require('../../src/config/settings')

const COOLDOWN_MS = 15000
const lastUse = new Map()

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

function directMedia(msg) {
    const content = unwrap(msg?.message)

    if (content.videoMessage) {
        return { type: 'video', data: content.videoMessage }
    }

    if (content.stickerMessage) {
        return { type: 'sticker', data: content.stickerMessage }
    }

    return null
}

function quotedMedia(msg) {
    const content = unwrap(msg?.message)

    for (const type of [
        'extendedTextMessage',
        'imageMessage',
        'videoMessage',
        'stickerMessage',
        'documentMessage'
    ]) {
        const quoted = content[type]?.contextInfo?.quotedMessage
        if (!quoted) continue

        const message = unwrap(quoted)

        if (message.videoMessage) {
            return { type: 'video', data: message.videoMessage }
        }

        if (message.stickerMessage) {
            return { type: 'sticker', data: message.stickerMessage }
        }
    }

    return null
}

function resolveMedia(msg) {
    return quotedMedia(msg) || directMedia(msg)
}

function channelCode(value) {
    const input = String(value || '').trim()
    const link = /^(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/channel\/([A-Za-z0-9_-]+)\/?(?:\?.*)?$/i.exec(input)

    return link ? link[1] : null
}

function extractRole(metadata) {
    const candidates = [
        metadata?.viewer_metadata?.role,
        metadata?.viewerMetadata?.role,
        metadata?.result?.viewer_metadata?.role,
        metadata?.result?.viewerMetadata?.role,
        metadata?.role
    ]

    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
            return candidate.trim().toUpperCase()
        }
    }

    return null
}

function extractJid(metadata) {
    const jid = String(metadata?.id || metadata?.result?.id || '')
    return jid.endsWith('@newsletter') ? jid : null
}

function channelName(metadata) {
    const name = metadata?.name || metadata?.thread_metadata?.name?.text || metadata?.result?.name
    return typeof name === 'string' && name.trim() ? name.trim() : null
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
    return String(msg?.key?.participant || msg?.key?.remoteJid || '')
}

function onCooldown(id) {
    const remaining = COOLDOWN_MS - (Date.now() - (lastUse.get(id) || 0))
    return remaining > 0 ? remaining : 0
}

function mapError(error) {
    const raw = String(error?.data || error?.message || error || '')
    const message = raw.toLowerCase()

    if (message.includes('rate') || message.includes('429')) {
        return 'WhatsApp limitó temporalmente los envíos. Intenta más tarde.'
    }

    if (message.includes('not-authorized') || message.includes('403') || message.includes('forbidden') || message.includes('unauthorized')) {
        return 'WhatsApp rechazó la publicación por permisos. Confirma que el número de esta sesión de KennyBot figura como administrador.'
    }

    if (message.includes('item-not-found') || message.includes('404')) {
        return 'No se encontró el canal o el enlace ya no es válido.'
    }

    return raw.slice(0, 300)
}

async function reply(sock, chat, msg, text) {
    return sock.sendMessage(chat, { text }, { quoted: msg })
}

async function edit(sock, chat, key, text) {
    if (!key) return

    try {
        await sock.sendMessage(chat, { text, edit: key })
    } catch (error) {
        console.error('[stickercanal] No se pudo editar el estado:', error.message)
        await sock.sendMessage(chat, { text }).catch(() => {})
    }
}

function instructions() {
    return [
        '🔊 *KENNYBOT V2 · STICKER A CANAL*',
        '',
        'Responde a un video con audio o a un sticker sonoro y escribe:',
        '*.stickercanal https://whatsapp.com/channel/CODIGO*',
        '',
        'También puedes enviar un video con el comando en su descripción.',
        'Solo se acepta el enlace completo del canal (no el código suelto).',
        'La cuenta de KennyBot debe ser administradora del canal.',
        'Los stickers con audio en canales siguen siendo experimentales.'
    ].join('\n')
}

async function readChannel(sock, code) {
    const byInvite = await sock.newsletterMetadata('invite', code)
    const channelJid = extractJid(byInvite)

    if (!channelJid) {
        throw new Error('WhatsApp no devolvió un identificador válido de canal.')
    }

    let metadata = byInvite
    let role = extractRole(byInvite)

    if (!['ADMIN', 'OWNER'].includes(role)) {
        try {
            const byJid = await sock.newsletterMetadata('jid', channelJid)
            const secondRole = extractRole(byJid)

            if (secondRole) role = secondRole
            if (byJid) metadata = byJid
        } catch (error) {
            console.warn('[stickercanal] Consulta por JID:', error.message)
        }
    }

    console.log('[stickercanal] Metadata:', {
        channelJid,
        role: role || 'NO_DISPONIBLE',
        hasViewerMetadata: Boolean(metadata?.viewer_metadata || metadata?.viewerMetadata),
        profile: String(sock?.botProfileId || 'main')
    })

    return {
        channelJid,
        role,
        name: channelName(metadata) || channelName(byInvite) || channelJid
    }
}

async function execute({ sock, msg, from, args = [] }) {
    const chat = from || msg?.key?.remoteJid

    if (!isOwner(msg)) {
        return reply(sock, chat, msg, '🔒 Solo el propietario de KennyBot puede utilizar este comando.')
    }

    const code = channelCode(args[0])

    if (!code) {
        return reply(sock, chat, msg, instructions())
    }

    const chosen = resolveMedia(msg)

    if (!chosen) {
        return reply(sock, chat, msg, '❌ Responde a un video con sonido o a un sticker con audio.')
    }

    const id = senderId(msg)
    const waitMs = onCooldown(id)

    if (waitMs > 0) {
        return reply(sock, chat, msg, `⏳ Espera ${Math.ceil(waitMs / 1000)} s antes de volver a publicar.`)
    }

    if (typeof sock.newsletterMetadata !== 'function') {
        return reply(sock, chat, msg, '❌ Esta versión de Baileys no ofrece newsletterMetadata().')
    }

    const status = await reply(sock, chat, msg, '⏳ Consultando el canal y los permisos de publicación…')

    let channel

    try {
        channel = await readChannel(sock, code)
    } catch (error) {
        console.error('[stickercanal] Consulta:', error)
        return edit(sock, chat, status?.key, `❌ No pude consultar el canal. ${mapError(error)}`)
    }

    if (channel.role && !['ADMIN', 'OWNER'].includes(channel.role)) {
        return edit(sock, chat, status?.key, `🔒 WhatsApp informa el rol *${channel.role}* para esta sesión. El número conectado debe ser administrador.`)
    }

    const roleConfirmed = Boolean(channel.role)

    if (!roleConfirmed) {
        await edit(sock, chat, status?.key, '⚠️ Baileys no informó el rol de esta cuenta. Se intentará publicar bajo autorización de WhatsApp; si la cuenta no es administradora, el servidor rechazará el envío.')
    } else {
        await edit(sock, chat, status?.key, '⏳ Administrador confirmado. Generando y enviando el sticker…')
    }

    lastUse.set(id, Date.now())

    try {
        if (chosen.type === 'video') {
            if (typeof core.makeAndSend !== 'function') {
                throw new Error('soundStickerCore.js no exporta makeAndSend(). Revisa la versión instalada.')
            }

            await core.makeAndSend(sock, channel.channelJid, chosen, null, msg, {
                soundMode: 'original',
                fit: 'cuadrado'
            })
        } else {
            if (typeof core.relayExistingSoundSticker !== 'function') {
                throw new Error('soundStickerCore.js no exporta relayExistingSoundSticker(). Revisa la versión instalada.')
            }

            await core.relayExistingSoundSticker(sock, channel.channelJid, chosen.data)
        }

        console.log(`[stickercanal] Envío solicitado por ${id} a ${channel.channelJid}`)

        return edit(
            sock,
            chat,
            status?.key,
            roleConfirmed
                ? `✅ Envío solicitado al canal *${channel.name}*.\n` +
                  'Comprueba que WhatsApp haya publicado el sticker y que el sonido se reproduzca.'
                : `⚠️ Se envió la solicitud al canal *${channel.name}*, pero el rol de administrador no pudo confirmarse antes.\n` +
                  'Revisa el canal: si no eres admin, WhatsApp pudo haberlo descartado en silencio.'
        )
    } catch (error) {
        lastUse.delete(id)
        console.error('[stickercanal] Publicación:', error)
        return edit(sock, chat, status?.key, `❌ No se pudo publicar el sticker.\n${mapError(error)}`)
    }
}

module.exports = {
    name: 'stickercanal',
    aliases: ['stcanal'],
    category: 'general',
    description: 'Publicar stickers con audio en canales administrados por KennyBot',
    execute
}
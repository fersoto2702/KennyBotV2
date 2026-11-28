const core = require('../../src/system/soundStickerCore')
const settings = require('../../src/config/settings')
const { downloadContentFromMessage } = require('@whiskeysockets/baileys')

const COOLDOWN_MS = 15000
const lastUse = new Map()
const MAX_TEST_STICKER_BYTES = 1024 * 1024
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
    if (content.videoMessage) return { type: 'video', data: content.videoMessage }
    if (content.stickerMessage) return { type: 'sticker', data: content.stickerMessage }
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
        '*Publicar sticker con sonido:*',
        'Responde a un video con sonido o a un sticker sonoro y escribe:',
        '*.stickercanal https://whatsapp.com/channel/CODIGO*',
        '',
        '*Diagnosticar el envío al canal (sin sticker):*',
        '*.stickercanal https://whatsapp.com/channel/CODIGO prueba*',
        '',
        'La prueba envía únicamente un texto al canal.',
        '',
        '*Diagnosticar envío de sticker normal:*',
        'Responde a un sticker y escribe:',
        '*.stickercanal https://whatsapp.com/channel/CODIGO pruebasticker*',
        'Se publicará como sticker normal, sin adjuntar audio.',
        'Solo se aceptan enlaces completos HTTPS de canales.',
        'La sesión conectada debe tener permisos para publicar.',
        'Los stickers con sonido en canales son experimentales.'
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
            console.warn('[stickercanal] La consulta por JID no devolvió el rol:', error.message)
        }
    }

    return { jid, role, name }
}

async function downloadStickerForTest(payload) {
    if (!payload?.mediaKey || (!payload?.directPath && !payload?.url)) {
        throw new Error('El sticker citado no tiene datos suficientes para descargarse.')
    }

    const parts = []
    let total = 0
    const stream = await downloadContentFromMessage(payload, 'sticker')

    for await (const part of stream) {
        const buffer = Buffer.from(part)
        total += buffer.length
        if (total > MAX_TEST_STICKER_BYTES) {
            throw new Error('El sticker supera el límite de 1 MB para la prueba.')
        }
        parts.push(buffer)
    }

    const file = Buffer.concat(parts)
    if (!file.length || file.toString('ascii', 0, 4) !== 'RIFF' ||
        file.toString('ascii', 8, 12) !== 'WEBP') {
        throw new Error('El contenido descargado no es un sticker WebP válido.')
    }
    return file
}

async function execute({ sock, msg, from, args = [] }) {
    const chat = from || msg?.key?.remoteJid

    if (!isOwner(msg)) {
        return reply(sock, chat, msg, '🔒 Este comando es exclusivo del propietario de KennyBot.')
    }

    const code = channelCode(args[0])
    const diagnostic = args.length === 2 && String(args[1]).toLowerCase() === 'prueba'
    const stickerTest = args.length === 2 && String(args[1]).toLowerCase() === 'pruebasticker'

    if (!code || (args.length !== 1 && !diagnostic && !stickerTest)) {
        return reply(sock, chat, msg, instructions())
    }

    // El modo de diagnóstico no exige responder a un video ni a un sticker.
    const chosen = diagnostic ? null : resolveMedia(msg)
    if (!diagnostic && !chosen) {
        return reply(sock, chat, msg, '❌ Responde a un video con sonido o a un sticker sonoro y escribe el comando con el enlace del canal.')
    }

    if (stickerTest && chosen?.type !== 'sticker') {
        return reply(sock, chat, msg, '❌ Para pruebasticker responde a un sticker (normal o sonoro), no a un video.')
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
            sock, chat, status?.key,
            `🔒 La cuenta conectada figura como *${channel.role}* en este canal y no puede publicar.`
        )
    }

    if (!channel.role) {
        console.warn(`[stickercanal] Rol no disponible para ${channel.jid}. WhatsApp validará el permiso al publicar.`)
    }

    if (diagnostic) {
        await updateStatus(sock, chat, status?.key, '⏳ Enviando un texto de diagnóstico al canal…')
        lastUse.set(id, Date.now())

        try {
            const result = await sock.sendMessage(channel.jid, {
                text: '🧪 Prueba de publicación KennyBot V2'
            })

            console.log('[stickercanal] Prueba de texto solicitada:', {
                canal: channel.jid,
                nombre: channel.name,
                rol: channel.role || 'NO_DISPONIBLE',
                messageId: result?.key?.id || 'NO_DISPONIBLE'
            })

            return updateStatus(
                sock, chat, status?.key,
                `🧪 Texto de prueba enviado a Baileys para *${channel.name}*.\n` +
                'ℹ️ Comprueba manualmente si aparece en el canal. Que Baileys no devuelva un error no confirma la publicación.'
            )
        } catch (error) {
            lastUse.delete(id)
            console.error('[stickercanal] Error de prueba de texto:', error)
            return updateStatus(sock, chat, status?.key, `❌ Falló la prueba de publicación.\n${mapError(error)}`)
        }
    }

    if (stickerTest) {
        await updateStatus(sock, chat, status?.key, '⏳ Descargando el sticker y probando el envío sin audio…')
        lastUse.set(id, Date.now())
        try {
            const stickerBuffer = await downloadStickerForTest(chosen.data)
            // Se genera un nuevo mensaje multimedia normal. No se utiliza
            // relayExistingSoundSticker ni el audio adjunto al sticker citado.
            const result = await sock.sendMessage(channel.jid, { sticker: stickerBuffer })

            console.log('[stickercanal] Prueba de sticker normal solicitada:', {
                canal: channel.jid,
                nombre: channel.name,
                rol: channel.role || 'NO_DISPONIBLE',
                bytes: stickerBuffer.length,
                messageId: result?.key?.id || 'NO_DISPONIBLE'
            })

            return updateStatus(sock, chat, status?.key,
                `🧪 Envío de sticker normal solicitado para *${channel.name}*.\n` +
                'ℹ️ Comprueba manualmente si aparece en el canal. Esto no confirma su publicación.')
        } catch (error) {
            lastUse.delete(id)
            console.error('[stickercanal] Error de prueba de sticker normal:', error)
            return updateStatus(sock, chat, status?.key,
                `❌ Falló la prueba del sticker normal.\n${mapError(error)}`)
        }
    }

    await updateStatus(sock, chat, status?.key, '⏳ Preparando el sticker y solicitando su publicación…')
    lastUse.set(id, Date.now())

    try {
        if (chosen.type === 'video') {
            if (typeof core.makeAndSend !== 'function') {
                throw new Error('soundStickerCore no exporta makeAndSend().')
            }
            await core.makeAndSend(sock, channel.jid, chosen, null, msg, {
                soundMode: 'original', fit: 'cuadrado'
            })
        } else {
            if (typeof core.relayExistingSoundSticker !== 'function') {
                throw new Error('soundStickerCore no exporta relayExistingSoundSticker().')
            }
            await core.relayExistingSoundSticker(sock, channel.jid, chosen.data)
        }

        console.log(`[stickercanal] Envío solicitado: ${channel.name} (${channel.jid})`)
        return updateStatus(
            sock, chat, status?.key,
            `✅ Envío solicitado al canal *${channel.name}*.\n` +
            'ℹ️ Comprueba que WhatsApp haya publicado el sticker con sonido.'
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
    description: 'Publicar stickers con sonido por enlace y probar texto o stickers normales en canales',
    execute
}
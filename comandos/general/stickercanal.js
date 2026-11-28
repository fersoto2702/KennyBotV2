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
        return {
            type: 'video',
            data: content.videoMessage
        }
    }

    if (content.stickerMessage) {
        return {
            type: 'sticker',
            data: content.stickerMessage
        }
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
            return {
                type: 'video',
                data: message.videoMessage
            }
        }

        if (message.stickerMessage) {
            return {
                type: 'sticker',
                data: message.stickerMessage
            }
        }
    }

    return null
}

function resolveMedia(msg) {
    return quotedMedia(msg) || directMedia(msg)
}

function channelCode(value) {
    const input = String(value || '').trim()

    const linkMatch = /^(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/channel\/([A-Za-z0-9_-]+)\/?(?:\?.*)?$/i.exec(input)

    if (linkMatch) return linkMatch[1]

    const bareMatch = /^[A-Za-z0-9_-]{15,30}$/.exec(input)

    return bareMatch ? bareMatch[0] : null
}

function viewerRole(metadata) {
    return String(
        metadata?.viewer_metadata?.role ||
        metadata?.viewerMetadata?.role ||
        ''
    ).toUpperCase()
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
        msg?.key?.remoteJid ||
        ''
    )
}

function onCooldown(id) {
    const last = lastUse.get(id)

    if (!last) return 0

    const remaining = COOLDOWN_MS - (Date.now() - last)

    return remaining > 0 ? remaining : 0
}

function mapError(error) {
    const text = String(error?.data || error?.message || error || '').toLowerCase()

    if (text.includes('rate') || text.includes('429')) {
        return 'Alcanzaste el límite de envíos de WhatsApp. Espera unos minutos y vuelve a intentarlo.'
    }

    if (text.includes('not-authorized') || text.includes('403') || text.includes('forbidden')) {
        return 'WhatsApp rechazó la publicación. Puede que ya no seas administrador del canal.'
    }

    if (text.includes('item-not-found') || text.includes('404')) {
        return 'El canal no existe o el enlace ya no es válido.'
    }

    return String(error?.message || error).slice(0, 300)
}

async function reply(sock, chat, msg, text) {
    return sock.sendMessage(chat, { text }, { quoted: msg })
}

async function edit(sock, chat, key, text) {
    if (!key) return

    try {
        await sock.sendMessage(chat, { text, edit: key })
    } catch (error) {
        console.error('[stickercanal] Edición:', error)
    }
}

function instructions() {
    return [
        '🔊 *KENNYBOT V2 · STICKER A CANAL*',
        '',
        'Responde a un *video con audio* (o mándalo con el comando en el texto) y escribe:',
        '*.stickercanal https://whatsapp.com/channel/CODIGO*',
        '',
        'También acepta solo el código del canal, y stickers que conserven su pista de audio.',
        '',
        'La cuenta conectada debe ser ADMIN u OWNER del canal.',
        'El envío de stickers con sonido a canales es experimental.'
    ].join('\n')
}

async function execute({ sock, msg, from, args = [] }) {
    const chat = from || msg?.key?.remoteJid

    if (!isOwner(msg)) {
        return reply(sock, chat, msg, '🔒 Solo el propietario de KennyBot puede publicar en canales con este comando.')
    }

    const code = channelCode(args[0])

    if (!code) {
        return reply(sock, chat, msg, instructions())
    }

    const chosen = resolveMedia(msg)

    if (!chosen) {
        return reply(sock, chat, msg, '❌ Responde a un video con sonido, mándalo con el comando en el texto, o cita un sticker con audio que Baileys pueda reconocer.')
    }

    const id = senderId(msg)
    const waitMs = onCooldown(id)

    if (waitMs > 0) {
        return reply(sock, chat, msg, `⏳ Espera ${Math.ceil(waitMs / 1000)} s antes de publicar otro sticker en un canal.`)
    }

    if (typeof sock.newsletterMetadata !== 'function') {
        return reply(sock, chat, msg, '❌ Tu versión de Baileys no ofrece newsletterMetadata().')
    }

    const status = await reply(sock, chat, msg, '⏳ Verificando permisos del canal…')

    let metadata

    try {
        metadata = await sock.newsletterMetadata('invite', code)
    } catch (error) {
        console.error('[stickercanal] Metadata:', error)
        return edit(sock, chat, status?.key, `❌ No pude consultar el canal. ${mapError(error)}`)
    }

    const channelJid = String(metadata?.id || '')
    const role = viewerRole(metadata)

    if (!channelJid.endsWith('@newsletter')) {
        return edit(sock, chat, status?.key, '❌ WhatsApp no devolvió un identificador válido de canal.')
    }

    if (!['ADMIN', 'OWNER'].includes(role)) {
        return edit(
            sock,
            chat,
            status?.key,
            role
                ? `🔒 La cuenta conectada tiene el rol *${role}*; debe ser administradora del canal.`
                : '🔒 No se pudo confirmar el rol de administrador. Por seguridad no se intentará publicar.'
        )
    }

    await edit(sock, chat, status?.key, '⏳ Permisos confirmados. Generando y enviando el sticker…')

    lastUse.set(id, Date.now())

    try {
        if (chosen.type === 'video') {
            await core.makeAndSend(
                sock,
                channelJid,
                chosen,
                null,
                msg,
                {
                    soundMode: 'original',
                    fit: 'cuadrado'
                }
            )
        } else {
            await core.relayExistingSoundSticker(
                sock,
                channelJid,
                chosen.data
            )
        }

        console.log(`[stickercanal] ${id} publicó en ${metadata?.name || channelJid} (${channelJid})`)

        return edit(
            sock,
            chat,
            status?.key,
            `✅ Envío solicitado al canal *${metadata?.name || channelJid}*.\n` +
            'ℹ️ Comprueba en WhatsApp que la publicación y su sonido sean visibles; el formato sigue siendo experimental.'
        )
    } catch (error) {
        lastUse.delete(id)
        console.error('[stickercanal] Envío:', error)

        return edit(sock, chat, status?.key, `❌ No se pudo publicar el sticker con audio.\n${mapError(error)}`)
    }
}

module.exports = {
    name: 'stickercanal',
    aliases: ['stcanal'],
    category: 'general',
    description: 'Publicar stickers con audio en canales administrados por KennyBot',
    execute
}
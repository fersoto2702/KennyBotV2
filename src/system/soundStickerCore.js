const fs =
    require('node:fs')

const fsp =
    require('node:fs/promises')

const os =
    require('node:os')

const path =
    require('node:path')

const crypto =
    require('node:crypto')

const {
    spawn
} = require('node:child_process')

const {
    proto,
    downloadContentFromMessage,
    prepareWAMessageMedia,
    generateWAMessageFromContent
} = require('@whiskeysockets/baileys')

const MAX_SECONDS =
    Math.min(
        15,
        Math.max(
            2,
            Number(process.env.SOUND_STICKER_MAX_SECONDS) || 10
        )
    )

const MAX_CONCURRENT =
    Math.max(
        1,
        Number(process.env.SOUND_STICKER_MAX_CONCURRENT) || 2
    )

const MAX_INPUT =
    20 * 1024 * 1024

const MAX_OUTPUT =
    490 * 1024

const WAIT_MS =
    5 * 60 * 1000

const pending =
    new Map()

const active =
    new Set()

const attachment =
    new Map()

// Solo guarda la referencia cifrada subida a WhatsApp, no el archivo de audio.
// Permite reutilizar stickers generados por KennyBot aunque reinicie el proceso.
const SOUND_CACHE_DIR =
    process.env.SOUND_STICKER_CACHE_DIR ||
    path.join(process.cwd(), 'data', 'sound-sticker-cache')

const SOUND_CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000

function soundCacheFile(sticker) {
    if (!sticker?.fileSha256) return null

    const hash = Buffer.from(sticker.fileSha256).toString('hex')
    if (!/^[a-f0-9]{64}$/.test(hash)) return null

    return path.join(SOUND_CACHE_DIR, `${hash}.json`)
}

async function cacheStickerAudio(sticker, audio) {
    const file = soundCacheFile(sticker)
    if (!file || !audio) return

    const encoded = proto.Message.AudioMessage.encode(audio).finish()
    await fsp.mkdir(SOUND_CACHE_DIR, { recursive: true, mode: 0o700 })

    const temporary = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`
    try {
        await fsp.writeFile(temporary, JSON.stringify({
            savedAt: Date.now(),
            audio: Buffer.from(encoded).toString('base64')
        }), { mode: 0o600 })
        await fsp.rename(temporary, file)
    } finally {
        await fsp.rm(temporary, { force: true }).catch(() => {})
    }
}

async function cachedStickerAudio(sticker) {
    const file = soundCacheFile(sticker)
    if (!file) return null

    try {
        const item = JSON.parse(await fsp.readFile(file, 'utf8'))
        if (!Number.isFinite(item.savedAt) ||
            Date.now() - item.savedAt > SOUND_CACHE_MAX_AGE ||
            item.savedAt > Date.now() + 60000) {
            await fsp.rm(file, { force: true }).catch(() => {})
            return null
        }
        const audio = proto.Message.AudioMessage.decode(Buffer.from(item.audio, 'base64'))
        return audio?.mediaKey && audio?.fileSha256 ? audio : null
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.warn('[stickercanal] No se pudo recuperar audio en caché:', error.message)
        }
        return null
    }
}

const PATCH_FLAG =
    Symbol.for('kennybot.soundSticker.v1')

const FFMPEG =
    process.env.FFMPEG_PATH || 'ffmpeg'

const FFPROBE =
    process.env.FFPROBE_PATH || 'ffprobe'

function unwrap(message) {

    let m = message

    for (
        let i = 0;
        i < 8 && m;
        i++
    ) {

        const next =
            m.ephemeralMessage?.message ||
            m.viewOnceMessage?.message ||
            m.viewOnceMessageV2?.message ||
            m.viewOnceMessageV2Extension?.message ||
            m.documentWithCaptionMessage?.message

        if (!next) {

            break

        }

        m = next

    }

    return m || {}

}

function mediaOf(message) {

    const m =
        unwrap(message)

    if (m.videoMessage) {

        return {
            type: 'video',
            data: m.videoMessage
        }

    }

    if (m.stickerMessage) {

        return {
            type: 'sticker',
            data: m.stickerMessage
        }

    }

    if (m.audioMessage) {

        return {
            type: 'audio',
            data: m.audioMessage
        }

    }

    return null

}

function quotedOf(message) {

    const m =
        unwrap(message)

    const info =
        m.extendedTextMessage?.contextInfo ||
        m.videoMessage?.contextInfo ||
        m.imageMessage?.contextInfo ||
        m.documentMessage?.contextInfo ||
        m.stickerMessage?.contextInfo

    return info?.quotedMessage || null

}

function senderKey(sock, msg, chat) {

    let who =
        msg.key?.fromMe
            ? (
                sock.user?.lid ||
                sock.user?.id ||
                'me'
            )
            : (
                msg.key?.participant ||
                msg.key?.participantAlt ||
                msg.participant ||
                chat
            )

    who = String(who)
        .replace(/:\d+@/, '@')

    const profile =
        String(
            sock?.botProfileId ||
            sock?.botProfile?.id ||
            'main'
        )

    return `${profile}|${chat}|${who}`

}

function isTooLarge(payload) {

    const n =
        payload?.fileLength

    if (
        n != null &&
        Number(n) > MAX_INPUT
    ) {

        return true

    }

    return false

}

function cleanExpired() {

    for (const [key, value] of pending) {

        if (value.expiry <= Date.now()) {

            pending.delete(key)

        }

    }

}

setInterval(cleanExpired, 60000).unref()

function attachmentKey(message) {

    if (!message?.fileSha256) {

        return null

    }

    const sha =
        Buffer.from(message.fileSha256)
            .toString('base64')

    const stamp =
        message.mediaKeyTimestamp != null
            ? String(message.mediaKeyTimestamp)
            : ''

    return `${sha}|${stamp}`

}

// Baileys puede omitir el campo experimental 26 al decodificar el mensaje.
// Recuperamos la referencia del audio directamente desde el protobuf recibido.
// Este parche debe instalarse ANTES de que Baileys decodifique los mensajes.
function embeddedAudioFromWire(bytes) {
    if (!bytes?.length) return null

    const buffer = Buffer.from(bytes)
    let offset = 0

    function varint() {
        let n = 0
        let shift = 0
        for (let i = 0; i < 10; i++) {
            if (offset >= buffer.length) throw new Error('Protobuf incompleto')
            const byte = buffer[offset++]
            if (shift < 53) n += (byte & 0x7f) * (2 ** shift)
            if (!(byte & 0x80)) {
                if (!Number.isSafeInteger(n)) throw new Error('Varint inválido')
                return n
            }
            shift += 7
        }
        throw new Error('Varint demasiado largo')
    }

    try {
        while (offset < buffer.length) {
            const tag = varint()
            const field = Math.floor(tag / 8)
            const wire = tag & 7
            if (!field) return null

            if (wire === 0) {
                varint()
            } else if (wire === 1) {
                offset += 8
            } else if (wire === 5) {
                offset += 4
            } else if (wire === 2) {
                const length = varint()
                if (length < 0 || offset + length > buffer.length) return null
                if (field === 26 && length > 0 && length < 65536) {
                    try {
                        const audio = proto.Message.AudioMessage.decode(
                            buffer.subarray(offset, offset + length)
                        )
                        if (audio?.mediaKey && audio?.fileSha256) return audio
                    } catch (_) {
                        // El campo 26 no contiene un AudioMessage reconocible.
                    }
                }
                offset += length
            } else {
                return null
            }
            if (offset > buffer.length) return null
        }
    } catch (_) {
        return null
    }
    return null
}

// Extrae un campo de tipo bytes de un mensaje protobuf sin alterar el esquema
// de Baileys. Se utiliza para leer el envoltorio 134 que Baileys puede ignorar.
function protobufBytesField(data, wanted) {
    const bytes = Buffer.from(data || [])
    let pos = 0

    function readVarint() {
        let value = 0
        let multiplier = 1
        for (let i = 0; i < 10; i++) {
            if (pos >= bytes.length) throw new Error('Protobuf truncado')
            const part = bytes[pos++]
            if (i < 8) value += (part & 127) * multiplier
            if ((part & 128) === 0) {
                if (!Number.isSafeInteger(value)) throw new Error('Varint inválido')
                return value
            }
            multiplier *= 128
        }
        throw new Error('Varint demasiado largo')
    }

    try {
        while (pos < bytes.length) {
            const tag = readVarint()
            const field = Math.floor(tag / 8)
            const wire = tag & 7
            if (!field) return null
            if (wire === 0) readVarint()
            else if (wire === 1) pos += 8
            else if (wire === 5) pos += 4
            else if (wire === 2) {
                const size = readVarint()
                if (!Number.isSafeInteger(size) || size < 0 || pos + size > bytes.length) return null
                if (field === wanted) return bytes.subarray(pos, pos + size)
                pos += size
            } else return null
            if (pos > bytes.length) return null
        }
    } catch (_) { return null }
    return null
}

// IMPORTANTE: el sonido usa DOS campos nuevos:
// Message.134 > Message.1 > Message.26 (sticker) > StickerMessage.26 (audio).
// Una modificación a StickerMessage.decode por sí sola no permite leer
// un sticker que llega dentro de Message.134.
function soundStickerEncoderPatch() {
    const stickerClass = proto?.Message?.StickerMessage
    const messageClass = proto?.Message

    if (!stickerClass || !messageClass ||
        typeof stickerClass.encode !== 'function' ||
        typeof stickerClass.decode !== 'function' ||
        typeof messageClass.encode !== 'function' ||
        typeof messageClass.decode !== 'function') {
        throw new Error('La versión de Baileys no expone los codecs protobuf necesarios.')
    }

    if (!stickerClass.encode[PATCH_FLAG]) {
        const originalStickerEncode = stickerClass.encode
        function patchedStickerEncode(message, writer) {
            const output = originalStickerEncode.call(this, message, writer)
            const key = attachmentKey(message)
            const audioBytes = key ? attachment.get(key) : null
            if (audioBytes) {
                output.uint32((24 << 3) | 0).uint32(0)
                output.uint32((26 << 3) | 2).bytes(audioBytes)
            }
            return output
        }
        patchedStickerEncode[PATCH_FLAG] = true
        stickerClass.encode = patchedStickerEncode
    }

    if (!stickerClass.decode[PATCH_FLAG]) {
        const originalStickerDecode = stickerClass.decode
        function patchedStickerDecode(reader, length) {
            const directBytes = reader && !reader.buf && (Buffer.isBuffer(reader) || reader instanceof Uint8Array)
                ? Buffer.from(reader) : null
            const start = reader?.pos ?? 0
            const result = originalStickerDecode.call(this, reader, length)
            const end = directBytes ? directBytes.length : (reader?.pos ?? 0)
            const raw = directBytes || reader?.buf
            if (raw && end > start && end <= raw.length) {
                const audio = embeddedAudioFromWire(raw.subarray(start, end))
                if (audio) {
                    result.audioMessage = audio
                    cacheStickerAudio(result, audio).catch(error => {
                        console.warn('[stickercanal] No se guardó audio entrante:', error.message)
                    })
                    console.log('[stickercanal] Audio integrado detectado en sticker entrante')
                }
            }
            return result
        }
        patchedStickerDecode[PATCH_FLAG] = true
        stickerClass.decode = patchedStickerDecode
    }

    if (!messageClass.decode[PATCH_FLAG]) {
        const originalMessageDecode = messageClass.decode
        function patchedMessageDecode(reader, length) {
            // Guardar la porción exacta antes de que el decoder descarte 134.
            const directBytes = reader && !reader.buf && (Buffer.isBuffer(reader) || reader instanceof Uint8Array)
                ? Buffer.from(reader) : null
            const start = reader?.pos ?? 0
            const result = originalMessageDecode.call(this, reader, length)
            const end = directBytes ? directBytes.length : (reader?.pos ?? 0)
            const raw = directBytes || reader?.buf
            if (raw && end > start && end <= raw.length) {
                const outer = protobufBytesField(raw.subarray(start, end), 134)
                const inner = outer && protobufBytesField(outer, 1)
                if (inner) {
                    try {
                        const nested = messageClass.decode(inner)
                        if (nested?.stickerMessage) {
                            // La capa normalizada permite que .stickercanal y
                            // la detección de mensajes citados lean el sticker.
                            result.stickerMessage = nested.stickerMessage
                        }
                    } catch (error) {
                        console.warn('[stickercanal] Envoltorio 134 ilegible:', error.message)
                    }
                }
            }
            return result
        }
        patchedMessageDecode[PATCH_FLAG] = true
        messageClass.decode = patchedMessageDecode
    }

    if (!messageClass.encode[PATCH_FLAG]) {
        const originalMessageEncode = messageClass.encode
        function patchedMessageEncode(message, writer) {
            const sticker = message?.stickerMessage
            const key = sticker && attachmentKey(sticker)
            const hasAudio = Boolean(key && attachment.has(key))
            if (!hasAudio) return originalMessageEncode.call(this, message, writer)

            // No enviamos el sticker como campo 26 del mensaje principal.
            // El cliente WhatsApp espera Message.134 que envuelve el sticker.
            const withoutSticker = { ...message }
            delete withoutSticker.stickerMessage
            const output = originalMessageEncode.call(this, withoutSticker, writer)

            // Llamar al codec original evita envolver la misma estructura otra vez.
            // El encoder de StickerMessage sí agrega aquí el audio en el campo 26.
            const nested = originalMessageEncode.call(this, { stickerMessage: sticker }).finish()
            const wrapped = Buffer.concat([
                Buffer.from([0x0a]),
                encodeVarint(nested.length),
                Buffer.from(nested)
            ])
            output.uint32((134 << 3) | 2).bytes(wrapped)
            return output
        }
        patchedMessageEncode[PATCH_FLAG] = true
        messageClass.encode = patchedMessageEncode
    }
}

function encodeVarint(num) {
    const out = []
    let n = num >>> 0
    do {
        let byte = n & 127
        n >>>= 7
        if (n) byte |= 128
        out.push(byte)
    } while (n)
    return Buffer.from(out)
}

function friendlyMissingBinary(exe, error) {

    if (error?.code === 'ENOENT') {

        return new Error(
            `No se encontró el ejecutable "${exe}" en el servidor.`
        )

    }

    return error

}

function callProgram(exe, args, timeoutMs = 55000) {

    return new Promise((resolve, reject) => {

        let done = false
        let err = ''
        let killTimer = null

        const proc =
            spawn(exe, args, {
                stdio: ['ignore', 'ignore', 'pipe'],
                windowsHide: true
            })

        const timeout =
            setTimeout(() => {

                proc.kill('SIGTERM')

                killTimer =
                    setTimeout(() => {

                        proc.kill('SIGKILL')

                    }, 3000)

                if (!done) {

                    done = true

                    reject(
                        new Error(
                            `${exe}: tiempo de espera agotado`
                        )
                    )

                }

            }, timeoutMs)

        proc.stderr.on('data', chunk => {

            if (err.length < 3500) {

                err += String(chunk)

            }

        })

        proc.on('error', error => {

            clearTimeout(timeout)
            clearTimeout(killTimer)

            if (!done) {

                done = true
                reject(friendlyMissingBinary(exe, error))

            }

        })

        proc.on('close', code => {

            clearTimeout(timeout)
            clearTimeout(killTimer)

            if (!done) {

                done = true

                if (code === 0) {

                    resolve()

                } else {

                    reject(
                        new Error(
                            `${exe} falló (${code}): ${err.slice(-600)}`
                        )
                    )

                }

            }

        })

    })

}

function readProbe(file) {

    return new Promise((resolve, reject) => {

        const proc =
            spawn(
                FFPROBE,
                [
                    '-v', 'error',
                    '-show_entries', 'format=duration:stream=codec_type,duration',
                    '-of', 'json',
                    file
                ],
                {
                    windowsHide: true
                }
            )

        const chunks = []

        proc.stdout.on('data', buffer => {

            chunks.push(buffer)

        })

        proc.on('error', reject)

        proc.on('close', code => {

            if (code !== 0) {

                return reject(
                    new Error('FFprobe no pudo leer el archivo')
                )

            }

            try {

                resolve(
                    JSON.parse(
                        Buffer.concat(chunks)
                            .toString('utf8')
                    )
                )

            } catch (error) {

                reject(error)

            }

        })

    })

}

function durationOf(probe) {

    const n =
        Number(
            probe.format?.duration ||
            probe.streams?.find(
                stream => stream.codec_type === 'video'
            )?.duration ||
            0
        )

    return Number.isFinite(n) && n > 0
        ? n
        : 0

}

async function saveMedia(payload, type, file) {

    if (isTooLarge(payload)) {

        throw new Error(
            'Archivo demasiado grande (máximo 20 MB).'
        )

    }

    const stream =
        await downloadContentFromMessage(payload, type)

    const handle =
        await fsp.open(file, 'w')

    let size = 0

    try {

        for await (const part of stream) {

            const chunk =
                Buffer.from(part)

            size += chunk.length

            if (size > MAX_INPUT) {

                throw new Error(
                    'Archivo demasiado grande (máximo 20 MB).'
                )

            }

            await handle.write(chunk)

        }

    } finally {

        await handle.close()

    }

    if (!size) {

        throw new Error(
            'No se pudo descargar el archivo.'
        )

    }

}

function parsePublicVideoUrl(value) {

    let url

    try {
        url = new URL(String(value || ''))
    } catch {
        return null
    }

    if (url.protocol !== 'https:') {
        return null
    }

    const host = url.hostname.toLowerCase()

    const tiktok = host === 'tiktok.com' ||
        host.endsWith('.tiktok.com')

    const instagram = host === 'instagram.com' ||
        host === 'www.instagram.com' ||
        host === 'instagr.am' ||
        host === 'www.instagr.am'

    if (!tiktok && !instagram) {
        return null
    }

    if (url.username || url.password) {
        return null
    }

    return url.href

}

function parseStart(value) {

    if (!value) return 0

    const input = String(value).trim()

    if (/^\d+(?:\.\d+)?$/.test(input)) {
        return Number(input)
    }

    const parts = input.split(':')

    if (parts.length === 2 && parts.every(p => /^\d+$/.test(p))) {
        return Number(parts[0]) * 60 + Number(parts[1])
    }

    if (parts.length === 3 && parts.every(p => /^\d+$/.test(p))) {
        return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2])
    }

    return NaN

}

async function downloadPublicVideo(url, dir) {

    const executable =
        process.env.YTDLP_PATH || 'yt-dlp'

    const template =
        path.join(dir, 'online.%(ext)s')

    await callProgram(
        executable,
        [
            '--no-playlist',
            '--no-progress',
            '--no-warnings',
            '--no-config',
            '--max-filesize', '20M',
            '--socket-timeout', '20',
            '--retries', '2',
            '--format', 'b[ext=mp4]/b',
            '--output', template,
            '--', url
        ],
        110000
    )

    const files =
        (await fsp.readdir(dir))
            .filter(file => /^online\.[a-z0-9]+$/i.test(file))

    if (files.length !== 1) {
        throw new Error('No se pudo obtener un video público del enlace.')
    }

    const downloaded = path.join(dir, files[0])

    if ((await fsp.stat(downloaded)).size > MAX_INPUT) {
        throw new Error('El video supera el máximo permitido de 20 MB.')
    }

    return downloaded

}

async function downloadPublicAudio(url, dir) {

    const executable =
        process.env.YTDLP_PATH || 'yt-dlp'

    const template =
        path.join(dir, 'chosen-audio.%(ext)s')

    await callProgram(
        executable,
        [
            '--no-playlist',
            '--no-progress',
            '--no-warnings',
            '--no-config',
            '--max-filesize', '20M',
            '--socket-timeout', '20',
            '--retries', '2',
            '--format', 'bestaudio/best',
            '--output', template,
            '--', url
        ],
        110000
    )

    const files =
        (await fsp.readdir(dir))
            .filter(file => /^chosen-audio\.[a-z0-9]+$/i.test(file))

    if (files.length !== 1) {
        throw new Error('No se pudo descargar el sonido del enlace.')
    }

    const downloaded = path.join(dir, files[0])

    if ((await fsp.stat(downloaded)).size > MAX_INPUT) {
        throw new Error('El archivo de sonido supera 20 MB.')
    }

    return downloaded

}

function normalizeSoundMode(value) {

    const mode = String(value || '').trim().toLowerCase()

    if (['sinsonido', 'sin-sonido', 'silencio', 'mute', 'mudo'].includes(mode)) {
        return 'none'
    }

    if (['original', 'oficial', 'sonido', 'consonido'].includes(mode)) {
        return 'original'
    }

    if (['personal', 'personalizado', 'elegir', 'custom'].includes(mode)) {
        return 'custom'
    }

    return null

}

function videoFilter(preset, fit, framing = {}) {
    const prefix = `fps=${preset.fps},`
    if (fit === 'manual' || fit === 'recorte') {
        const zoom = Math.min(3, Math.max(1, Number(framing.zoom) || 1))
        const x = Math.min(1, Math.max(0, Number(framing.x) || 0.5))
        const y = Math.min(1, Math.max(0, Number(framing.y) || 0.5))
        const width = Math.ceil(512 * zoom / 2) * 2
        return prefix +
            `scale=${width}:${width}:force_original_aspect_ratio=increase:flags=lanczos,` +
            `crop=512:512:(iw-512)*${x.toFixed(4)}:(ih-512)*${y.toFixed(4)},` +
            'setsar=1,format=yuva420p'
    }
    if (fit === 'completo' || fit === 'margenes') {
        return prefix +
            'scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,' +
            'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black,' +
            'setsar=1,format=yuva420p'
    }
    return prefix + 'scale=512:512:flags=lanczos,setsar=1,format=yuva420p'
}

async function makeWebp(video, out, seconds, startAt = 0, fit = 'cuadrado', framing = {}) {

    const presets = [
        { fps: 12, q: 60 },
        { fps: 10, q: 48 },
        { fps: 8, q: 35 },
        { fps: 6, q: 25 },
        { fps: 4, q: 15 }
    ]

    for (const preset of presets) {

        const filter =
            videoFilter(preset, fit, framing)

        await callProgram(
            FFMPEG,
            [
                '-hide_banner',
                '-loglevel', 'error',
                '-y',
                '-ss', startAt.toFixed(3),
                '-i', video,
                '-t', seconds.toFixed(3),
                '-an',
                '-map', '0:v:0',
                '-vf',
                filter,
                '-c:v', 'libwebp_anim',
                '-q:v', String(preset.q),
                '-compression_level', '4',
                '-loop', '0',
                out
            ],
            60000
        )

        const stats =
            await fsp.stat(out)

        if (
            stats.size > 0 &&
            stats.size <= MAX_OUTPUT
        ) {

            return

        }

    }

    throw new Error(
        'El video no se pudo comprimir por debajo de 500 KB. Prueba uno más corto o con menos movimiento.'
    )

}

async function makeOgg(source, out, seconds, startAt = 0) {

    await callProgram(
        FFMPEG,
        [
            '-hide_banner',
            '-loglevel', 'error',
            '-y',
            '-ss', startAt.toFixed(3),
            '-i', source,
            '-map', '0:a:0',
            '-vn',
            '-af',
            `aresample=48000:first_pts=0,apad=whole_dur=${seconds.toFixed(3)}`,
            '-t', seconds.toFixed(3),
            '-ac', '1',
            '-c:a', 'libopus',
            '-b:a', '32k',
            '-map_metadata', '-1',
            '-f', 'ogg',
            out
        ],
        60000
    )

    if ((await fsp.stat(out)).size < 50) {

        throw new Error(
            'No se pudo generar el audio Opus.'
        )

    }

}

function getWebpDimensions(file) {

    const bytes =
        fs.readFileSync(file)

    if (
        bytes.toString('ascii', 0, 4) !== 'RIFF' ||
        bytes.toString('ascii', 8, 12) !== 'WEBP'
    ) {

        throw new Error('El archivo no es un WebP válido.')

    }

    let offset = 12

    while (offset + 8 <= bytes.length) {

        const type =
            bytes.toString('ascii', offset, offset + 4)

        const length =
            bytes.readUInt32LE(offset + 4)

        const start = offset + 8
        const end = start + length

        if (end > bytes.length) {

            break

        }

        if (type === 'VP8X' && length >= 10) {

            return {
                width: bytes.readUIntLE(start + 4, 3) + 1,
                height: bytes.readUIntLE(start + 7, 3) + 1
            }

        }

        if (type === 'VP8 ' && length >= 10) {

            return {
                width: bytes.readUInt16LE(start + 6) & 0x3fff,
                height: bytes.readUInt16LE(start + 8) & 0x3fff
            }

        }

        if (type === 'VP8L' && length >= 5 && bytes[start] === 0x2f) {

            const b1 = bytes[start + 1]
            const b2 = bytes[start + 2]
            const b3 = bytes[start + 3]
            const b4 = bytes[start + 4]

            return {
                width: 1 + (b1 | ((b2 & 0x3f) << 8)),
                height: 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10))
            }

        }

        offset = end + (length % 2)

    }

    throw new Error('No se pudieron identificar las dimensiones del WebP.')

}

async function sendSticker(
    sock,
    chat,
    webp,
    ogg,
    seconds,
    quoted,
    isAnimated,
    dimensions
) {

    soundStickerEncoderPatch()

    if (typeof sock?.waUploadToServer !== 'function') {

        throw new Error(
            'El socket no ofrece waUploadToServer: revisa la versión de Baileys.'
        )

    }

    const options = {
        upload: sock.waUploadToServer
    }

    const preparedAudio = ogg
        ? await prepareWAMessageMedia(
            {
                audio: fs.readFileSync(ogg),
                mimetype: 'audio/ogg; codecs=opus',
                seconds: Math.max(1, Math.round(seconds))
            },
            options
        )
        : null

    const preparedSticker =
        await prepareWAMessageMedia(
            {
                sticker: fs.readFileSync(webp),
                isAnimated
            },
            options
        )

    const a =
        preparedAudio?.audioMessage

    const s =
        preparedSticker.stickerMessage

    if (
        (ogg && !a?.mediaKey) ||
        !s?.fileSha256
    ) {

        throw new Error(
            'No se pudo subir el contenido a WhatsApp.'
        )

    }

    const audio = ogg
        ? proto.Message.AudioMessage.create({
            url: a.url,
            mimetype: 'audio/ogg; codecs=opus',
            fileSha256: a.fileSha256,
            fileLength: a.fileLength,
            seconds: Math.max(1, Math.round(seconds)),
            ptt: true,
            mediaKey: a.mediaKey,
            fileEncSha256: a.fileEncSha256,
            directPath: a.directPath,
            mediaKeyTimestamp:
                a.mediaKeyTimestamp || Math.floor(Date.now() / 1000),
            waveform:
                Uint8Array.from(new Array(64).fill(24))
        })
        : null

    s.isAnimated =
        Boolean(isAnimated)

    s.width = dimensions.width
    s.height = dimensions.height

    const k =
        attachmentKey(s)

    if (audio) {

        attachment.set(
            k,
            proto.Message.AudioMessage.encode(audio).finish()
        )

    }

    try {

        const who =
            chat.endsWith('@lid') && sock.user?.lid
                ? sock.user.lid
                : sock.user?.id

        const built =
            generateWAMessageFromContent(
                chat,
                {
                    stickerMessage: s
                },
                {
                    userJid: who
                }
            )

        await sock.relayMessage(
            chat,
            built.message,
            {
                messageId: built.key.id
            }
        )

        if (audio) {
            await cacheStickerAudio(s, audio).catch(error => {
                console.warn('[stickeraudio] Sticker enviado, pero no se guardó el audio para reutilizarlo:', error.message)
            })
        }

    } finally {

        attachment.delete(k)

    }

}

async function resolveSourceAudio(soundMode, voice, dir, visual) {

    if (soundMode === 'none') {

        return null

    }

    if (voice?.type === 'url') {

        return downloadPublicAudio(voice.url, dir)

    }

    if (voice?.type === 'localAudio') {

        return voice.filePath

    }

    if (voice) {

        return path.join(dir, 'selected-audio')

    }

    return visual

}

async function makeAndSend(
    sock,
    from,
    requested,
    voice,
    sourceMsg,
    options = {}
) {

    if (active.size >= MAX_CONCURRENT) {

        throw new Error(
            `Hay ${MAX_CONCURRENT} stickers procesándose. Inténtalo de nuevo en unos segundos.`
        )

    }

    const jid =
        senderKey(sock, sourceMsg, from)

    if (active.has(jid)) {

        throw new Error(
            'Ya estás creando un sticker con audio.'
        )

    }

    active.add(jid)

    const dir =
        await fsp.mkdtemp(
            path.join(os.tmpdir(), 'kennybot-sound-')
        )

    try {

        const visual =
            requested.type === 'url'
                ? await downloadPublicVideo(requested.url, dir)
                : requested.type === 'local'
                    ? requested.filePath
                : path.join(
                    dir,
                    requested.type === 'video'
                        ? 'source.mp4'
                        : 'source.webp'
                )

        const soundMode =
            options.soundMode || 'original'

        const sourceAudio =
            await resolveSourceAudio(soundMode, voice, dir, visual)

        const webp =
            path.join(dir, 'sticker.webp')

        const ogg =
            path.join(dir, 'audio.ogg')

        if (requested.type !== 'url' && requested.type !== 'local') {

            await saveMedia(
                requested.data,
                requested.type,
                visual
            )

        }

        if (voice && voice.type === 'audio') {

            await saveMedia(
                voice.data,
                'audio',
                sourceAudio
            )

        }

        const visualProbe =
            await readProbe(visual).catch(() => ({}))

        const startAt =
            Number(options.startAt) || 0

        const audioStart =
            soundMode === 'original' ? startAt : Number(options.audioStart) || 0

        const visualDuration =
            durationOf(visualProbe) ||
            Number(requested.data?.seconds) ||
            0

        if (visualDuration && startAt >= visualDuration) {
            throw new Error('El inicio supera la duración del video.')
        }

        const soundProbe = sourceAudio
            ? await readProbe(sourceAudio)
            : null

        if (sourceAudio && !soundProbe.streams?.some(
            stream => stream.codec_type === 'audio'
        )) {
            throw new Error('El archivo seleccionado no contiene sonido.')
        }

        const soundDuration = soundProbe
            ? durationOf(soundProbe)
            : 0

        const seconds = Math.min(
            MAX_SECONDS,
            soundDuration ? soundDuration - audioStart : MAX_SECONDS,
            visualDuration ? visualDuration - startAt : MAX_SECONDS
        )

        if (!Number.isFinite(seconds) || seconds < 0.5) {
            throw new Error('No queda suficiente video o sonido desde el segundo elegido.')
        }

        if (requested.type === 'video' || requested.type === 'url' || requested.type === 'local') {

            await makeWebp(
                visual,
                webp,
                seconds,
                startAt,
                options.fit || 'cuadrado',
                options.framing || {}
            )

        } else {

            const blob =
                await fsp.readFile(visual)

            if (blob.length > MAX_OUTPUT) {

                throw new Error(
                    'Ese sticker supera 490 KB. Elige otro más pequeño.'
                )

            }

            if (
                blob.toString('ascii', 0, 4) !== 'RIFF' ||
                blob.toString('ascii', 8, 12) !== 'WEBP'
            ) {

                throw new Error(
                    'El archivo no es un sticker WebP válido.'
                )

            }

            await fsp.copyFile(visual, webp)

        }

        if (sourceAudio) {

            await makeOgg(
                sourceAudio,
                ogg,
                seconds,
                audioStart
            )

        }

        const {
            width,
            height
        } = getWebpDimensions(webp)

        if (
            !Number.isInteger(width) ||
            !Number.isInteger(height) ||
            width < 1 ||
            height < 1 ||
            width > 512 ||
            height > 512
        ) {

            throw new Error(
                'El tamaño del sticker está fuera del rango permitido.'
            )

        }

        await sendSticker(
            sock,
            from,
            webp,
            sourceAudio ? ogg : null,
            seconds,
            null,
            requested.type === 'video' ||
                requested.type === 'url' ||
                requested.type === 'local' ||
                Boolean(requested.data?.isAnimated),
            { width, height }
        )

    } finally {

        active.delete(jid)

        await fsp.rm(dir, {
            recursive: true,
            force: true
        })

    }

}

async function reply(sock, from, text, msg) {

    return sock.sendMessage(
        from,
        {
            text
        },
        {
            quoted: msg
        }
    )

}

function infoText() {

    return [
        '🎬 *KENNYBOT V2 · STICKERAUDIO*',
        '',
        '*Modos de sonido:*',
        '🔇 sinsonido — sticker animado sin audio',
        '🔊 original — audio incluido en el video',
        '🎵 personal — elige un audio, nota de voz o enlace',
        '',
        '*Ejemplos:*',
        '.stickeraudio <enlace> — abre el editor visual',
        '.stickeraudio rapido <enlace> original — conversión automática',
        '.stickeraudio <enlace> sinsonido',
        '.stickeraudio <enlace> personal',
        '.stickeraudio <enlace> 00:05 original margenes',
        '',
        'También puedes responder a un video con .stickeraudio original,',
        '.stickeraudio sinsonido o .stickeraudio personal.',
        '',
        'Encuadre: cuadrado, recorte o margenes.',
        'cuadrado muestra todo, pero deforma si no es 1:1;',
        'recorte conserva las proporciones, pero corta bordes;',
        'margenes conserva todo sin deformar y agrega relleno.',
        '',
        'Para elegir otro audio, envía el archivo o un enlace público',
        'de Instagram/TikTok como siguiente mensaje.',
        'Para cancelar: .stickeraudio cancelar.',
        `Duración máxima: ${MAX_SECONDS} segundos.`
    ].join('\n')

}

function commandOptions(args, hasLink) {

    let startAt = 0
    let soundMode = null
    let fit = 'cuadrado'

    for (const raw of args) {

        const item = String(raw || '').trim().toLowerCase()
        const mode = normalizeSoundMode(item)

        if (mode) {
            soundMode = mode
            continue
        }

        if (['cuadrado', 'recorte', 'margenes'].includes(item)) {
            fit = item
            continue
        }

        if (/^\d+(?::\d{1,2}){0,2}(?:\.\d+)?$/.test(item)) {
            startAt = parseStart(item)
            continue
        }

        return null

    }

    if (!Number.isFinite(startAt) || startAt < 0 || startAt > 3600) {
        return null
    }

    return {
        startAt,
        soundMode: soundMode || (hasLink ? 'original' : 'original'),
        fit
    }

}

async function command({
    sock,
    msg,
    from,
    args = []
}) {

    cleanExpired()

    const key = senderKey(sock, msg, from)
    const action = String(args[0] || '').toLowerCase()
    const quickMode = ['rapido', 'rápido', 'quick'].includes(action)
    if (quickMode) args = args.slice(1)

    if (['cancelar', 'cancel', 'stop'].includes(action)) {

        const found = pending.delete(key)

        return reply(
            sock,
            from,
            found ? '✅ Operación cancelada.' : 'No tienes ninguna operación pendiente.',
            msg
        )

    }

    const link = parsePublicVideoUrl(args[0])
    const chosen = link
        ? { type: 'url', url: link }
        : mediaOf(quotedOf(msg.message)) || mediaOf(msg.message)

    const opts = commandOptions(link ? args.slice(1) : args, !!link)

    if (!opts) {
        return reply(sock, from, infoText(), msg)
    }

    if (!link && /^https?:\/\//i.test(String(args[0] || ''))) {
        return reply(
            sock, from,
            'Solo se admiten enlaces públicos HTTPS de TikTok e Instagram.',
            msg
        )
    }

    if (!chosen || !['sticker', 'video', 'url'].includes(chosen.type)) {
        return reply(sock, from, infoText(), msg)
    }

    if (isTooLarge(chosen.data)) {
        return reply(sock, from, 'El archivo supera el máximo de 20 MB.', msg)
    }

    if (!quickMode) {
        return require('./soundStickerEditor').launch({
            sock, msg, from, chosen
        })
    }



    if (chosen.type === 'sticker' && opts.soundMode === 'original') {
        return reply(
            sock,
            from,
            'Para un sticker existente, usa .stickeraudio personal y envía un audio, o .stickeraudio sinsonido.',
            msg
        )
    }

    if (opts.soundMode === 'custom') {

        pending.set(key, {
            requested: chosen,
            options: opts,
            expiry: Date.now() + WAIT_MS
        })

        return reply(
            sock,
            from,
            '🎵 Envía ahora una nota de voz, un archivo de audio o un enlace público de TikTok/Instagram con el sonido que quieres. Tienes 5 minutos. Usa .stickeraudio cancelar para salir.',
            msg
        )

    }

    try {

        await makeAndSend(sock, from, chosen, null, msg, opts)

    } catch (error) {

        console.error('[stickeraudio]', error.message)

        return reply(sock, from, `❌ ${error.message}`, msg)

    }

    return true

}

function textOf(message) {

    const m = unwrap(message)

    return m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        ''

}

async function consumeAudio(sock, msg, from) {

    const key = senderKey(sock, msg, from)
    const task = pending.get(key)

    if (task && task.expiry <= Date.now()) {

        pending.delete(key)

        await reply(
            sock,
            from,
            '⌛ Se agotó el tiempo para enviar el audio. Usa .stickeraudio de nuevo.',
            msg
        )

        return true

    }

    cleanExpired()

    if (!task) {
        return false
    }

    const file = mediaOf(msg.message)
    const url = parsePublicVideoUrl(textOf(msg.message).trim())

    if (file?.type !== 'audio' && !url) {
        return false
    }

    pending.delete(key)

    try {

        await makeAndSend(
            sock,
            from,
            task.requested,
            file?.type === 'audio' ? file : { type: 'url', url },
            msg,
            task.options
        )

    } catch (error) {

        console.error('[stickeraudio]', error.message)

        await reply(sock, from, `❌ ${error.message}`, msg)

    }

    return true

}


async function relayExistingSoundSticker(sock, chat, sticker) {

    soundStickerEncoderPatch()

    if (!String(chat).endsWith('@newsletter')) {
        throw new Error('El destino no es un canal de WhatsApp.')
    }

    if (!sticker?.fileSha256 || !sticker?.mediaKey) {
        throw new Error('Baileys no pudo leer los datos del sticker citado.')
    }

    // El campo de audio experimental (número 26) puede perderse cuando
    // Baileys decodifica el sticker citado. Recuperamos la referencia
    // almacenada al crear el sticker, si no vino en el mensaje.
    const embeddedAudio =
        sticker.audioMessage ||
        sticker.audio ||
        await cachedStickerAudio(sticker)

    if (!embeddedAudio?.mediaKey || !embeddedAudio?.fileSha256) {
        console.warn('[stickercanal] Sin audio recuperable:', {
            stickerSha: Buffer.from(sticker.fileSha256).toString('hex').slice(0, 12),
            audioEnMensaje: Boolean(sticker.audioMessage || sticker.audio),
            cache: Boolean(await cachedStickerAudio(sticker))
        })
        throw new Error(
            'No se encontró el audio original de este sticker. ' +
            'Los stickers generados con la versión anterior o por otros bots ' +
            'pueden no conservar el audio accesible al responderlos. ' +
            'Prueba con un sticker recibido después de iniciar el bot con el parche activo. ' +
            'Si el audio no llega desde WhatsApp, no es posible reconstruirlo desde el WebP.'
        )
    }

    const payload = proto.Message.StickerMessage.create({ ...sticker })
    const hash = attachmentKey(payload)
    if (!hash) throw new Error('No se pudo identificar el sticker.')

    attachment.set(
        hash,
        proto.Message.AudioMessage.encode(embeddedAudio).finish()
    )

    try {
        const who =
            chat.endsWith('@lid') && sock.user?.lid
                ? sock.user.lid
                : sock.user?.id

        const built = generateWAMessageFromContent(
            chat,
            { stickerMessage: payload },
            { userJid: who }
        )

        await sock.relayMessage(
            chat,
            built.message,
            { messageId: built.key.id }
        )
    } finally {
        attachment.delete(hash)
    }
}

module.exports = {

    command,

    consumeAudio,

    infoText,

    soundStickerEncoderPatch,

    makeAndSend,
    relayExistingSoundSticker,
    saveMedia,
    downloadPublicVideo,
    downloadPublicAudio,
    readProbe,
    durationOf,
    parsePublicVideoUrl,
    _test: {
        unwrap,
        mediaOf,
        quotedOf,
        senderKey,
        cleanExpired,
        parsePublicVideoUrl,
        parseStart,
        videoFilter,
        normalizeSoundMode,
        commandOptions
    }
}

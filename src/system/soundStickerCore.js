'use strict'

const fs =
    require('node:fs')

const fsp =
    require('node:fs/promises')

const os =
    require('node:os')

const path =
    require('node:path')

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

function soundStickerEncoderPatch() {

    const cls =
        proto?.Message?.StickerMessage

    if (
        !cls ||
        typeof cls.encode !== 'function'
    ) {

        throw new Error(
            'Baileys no expone StickerMessage.encode'
        )

    }

    if (cls.encode[PATCH_FLAG]) {

        return

    }

    const original =
        cls.encode

    function patched(message, writer) {

        const output =
            original.call(
                this,
                message,
                writer
            )

        if (message?.fileSha256) {

            const key =
                Buffer.from(message.fileSha256)
                    .toString('base64')

            const bytes =
                attachment.get(key)

            if (bytes) {

                output
                    .uint32((26 << 3) | 2)
                    .bytes(bytes)

            }

        }

        return output

    }

    patched[PATCH_FLAG] = true

    cls.encode = patched

}

function callProgram(exe, args, timeoutMs = 55000) {

    return new Promise((resolve, reject) => {

        let done = false
        let err = ''

        const proc =
            spawn(exe, args, {
                stdio: ['ignore', 'ignore', 'pipe'],
                windowsHide: true
            })

        const timeout =
            setTimeout(() => {

                proc.kill()

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

            if (!done) {

                done = true
                reject(error)

            }

        })

        proc.on('close', code => {

            clearTimeout(timeout)

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

async function makeWebp(video, out, seconds) {

    const presets = [
        { fps: 12, q: 60 },
        { fps: 10, q: 48 },
        { fps: 8, q: 35 },
        { fps: 6, q: 25 },
        { fps: 4, q: 15 }
    ]

    for (const preset of presets) {

        const filter =
            `fps=${preset.fps},scale=512:512:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,setsar=1,format=yuva420p`

        await callProgram(
            FFMPEG,
            [
                '-hide_banner',
                '-loglevel', 'error',
                '-y',
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

async function makeOgg(source, out, seconds) {

    await callProgram(
        FFMPEG,
        [
            '-hide_banner',
            '-loglevel', 'error',
            '-y',
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

    const preparedAudio =
        await prepareWAMessageMedia(
            {
                audio: fs.readFileSync(ogg),
                mimetype: 'audio/ogg; codecs=opus',
                seconds: Math.max(1, Math.round(seconds))
            },
            options
        )

    const preparedSticker =
        await prepareWAMessageMedia(
            {
                sticker: fs.readFileSync(webp),
                isAnimated
            },
            options
        )

    const a =
        preparedAudio.audioMessage

    const s =
        preparedSticker.stickerMessage

    if (
        !a?.mediaKey ||
        !s?.fileSha256
    ) {

        throw new Error(
            'No se pudo subir el contenido a WhatsApp.'
        )

    }

    const audio =
        proto.Message.AudioMessage.create({
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

    s.isAnimated =
        Boolean(isAnimated)

    s.width = dimensions.width
    s.height = dimensions.height

    const k =
        Buffer.from(s.fileSha256)
            .toString('base64')

    attachment.set(
        k,
        proto.Message.AudioMessage.encode(audio).finish()
    )

    try {

        // Inyecta AudioMessage al codificar StickerMessage.

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
                    quoted,
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

    } finally {

        attachment.delete(k)

    }

}

async function makeAndSend(
    sock,
    from,
    requested,
    voice,
    sourceMsg
) {

    if (active.size >= 2) {

        throw new Error(
            'Hay dos stickers procesándose. Inténtalo de nuevo en unos segundos.'
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
            path.join(
                dir,
                requested.type === 'video'
                    ? 'source.mp4'
                    : 'source.webp'
            )

        const sourceAudio =
            voice
                ? path.join(dir, 'selected-audio')
                : visual

        const webp =
            path.join(dir, 'sticker.webp')

        const ogg =
            path.join(dir, 'audio.ogg')

        await saveMedia(
            requested.data,
            requested.type,
            visual
        )

        if (voice) {

            await saveMedia(
                voice.data,
                'audio',
                sourceAudio
            )

        }

        const visualProbe =
            await readProbe(visual).catch(() => ({}))

        const soundProbe =
            await readProbe(sourceAudio)

        const audioAvailable =
            soundProbe.streams?.some(
                stream => stream.codec_type === 'audio'
            )

        if (!audioAvailable) {

            throw new Error(
                'El archivo no contiene una pista de audio.'
            )

        }

        let seconds =
            Math.min(
                MAX_SECONDS,
                durationOf(soundProbe) || MAX_SECONDS
            )

        if (requested.type === 'video') {

            seconds =
                Math.min(
                    seconds,
                    durationOf(visualProbe) ||
                    Number(requested.data.seconds) ||
                    MAX_SECONDS
                )

        }

        seconds =
            Math.max(0.5, seconds)

        if (requested.type === 'video') {

            await makeWebp(
                visual,
                webp,
                seconds
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

        await makeOgg(
            sourceAudio,
            ogg,
            seconds
        )

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
            ogg,
            seconds,
            sourceMsg,
            requested.type === 'video' ||
                Boolean(requested.data.isAnimated),
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

    return (
        '🔊 *KENNYBOT V2 · STICKERS CON AUDIO*\n\n' +
        '1️⃣ Video con sonido: responde al video con *.stickeraudio* (o envía el video con esa descripción).\n\n' +
        '2️⃣ Sticker + audio elegido: responde al sticker con *.stickeraudio*; después envía el audio o nota de voz en este mismo chat (máximo 5 minutos).\n\n' +
        '3️⃣ Video + audio diferente: responde al video con *.stickeraudio personal*; después envía el audio.\n\n' +
        'Para cancelar: *.stickeraudio cancelar*.\n' +
        `Máximo ${MAX_SECONDS} segundos por sticker. Función experimental.`
    )

}

async function command({
    sock,
    msg,
    from,
    args = []
}) {

    cleanExpired()

    const key =
        senderKey(sock, msg, from)

    const action =
        String(args[0] || '').toLowerCase()

    if (['cancelar', 'cancel', 'stop'].includes(action)) {

        const found =
            pending.delete(key)

        return reply(
            sock,
            from,
            found
                ? '✅ Operación cancelada.'
                : 'No tienes ninguna operación pendiente.',
            msg
        )

    }

    const chosen =
        mediaOf(quotedOf(msg.message)) ||
        mediaOf(msg.message)

    if (
        !chosen ||
        !['sticker', 'video'].includes(chosen.type)
    ) {

        return reply(
            sock,
            from,
            infoText(),
            msg
        )

    }

    if (isTooLarge(chosen.data)) {

        return reply(
            sock,
            from,
            'El archivo supera el máximo permitido (20 MB).',
            msg
        )

    }

    if (
        chosen.type === 'sticker' ||
        action === 'personal'
    ) {

        pending.set(key, {
            requested: chosen,
            expiry: Date.now() + WAIT_MS,
            msg
        })

        return reply(
            sock,
            from,
            '🎵 Imagen recibida. Envía ahora el *audio o nota de voz* que quieres utilizar en este chat. Tienes 5 minutos.\nPara cancelar: *.stickeraudio cancelar*',
            msg
        )

    }

    try {

        await makeAndSend(
            sock,
            from,
            chosen,
            null,
            msg
        )

    } catch (error) {

        console.error('[stickeraudio]', error.message)

        return reply(
            sock,
            from,
            `❌ ${error.message}`,
            msg
        )

    }

}

async function consumeAudio(sock, msg, from) {

    cleanExpired()

    const key =
        senderKey(sock, msg, from)

    const task =
        pending.get(key)

    if (!task) {

        return false

    }

    const file =
        mediaOf(msg.message)

    if (file?.type !== 'audio') {

        return false

    }

    pending.delete(key)

    try {

        await makeAndSend(
            sock,
            from,
            task.requested,
            file,
            msg
        )

    } catch (error) {

        console.error('[stickeraudio]', error.message)

        await reply(
            sock,
            from,
            `❌ ${error.message}`,
            msg
        )

    }

    return true

}

module.exports = {

    command,

    consumeAudio,

    infoText,

    soundStickerEncoderPatch,

    _test: {
        unwrap,
        mediaOf,
        quotedOf,
        senderKey,
        cleanExpired
    }

}

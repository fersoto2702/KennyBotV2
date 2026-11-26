'use strict'

const fs = require('node:fs')
const fsp = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const crypto = require('node:crypto')
const { spawn } = require('node:child_process')

const core = require('./soundStickerCore')

const sessions = new Map()

const EXPIRY = 20 * 60 * 1000
const PORT = Number(process.env.STICKER_EDITOR_PORT || 3197)
const HOST = process.env.STICKER_EDITOR_HOST || '127.0.0.1'
const PUBLIC_URL = (process.env.STICKER_EDITOR_PUBLIC_URL || '').replace(/\/$/, '')
const MAX_UPLOAD = 20 * 1024 * 1024
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg'

let server

function run(exe, args, timeout = 90000) {
    return new Promise((resolve, reject) => {
        const child = spawn(exe, args, {
            windowsHide: true,
            stdio: ['ignore', 'ignore', 'pipe']
        })

        let error = ''

        const timer = setTimeout(() => child.kill(), timeout)

        child.stderr.on('data', chunk => {
            error += String(chunk).slice(-1000)
        })

        child.on('error', err => {
            clearTimeout(timer)
            reject(err)
        })

        child.on('close', code => {
            clearTimeout(timer)

            if (code === 0) {
                resolve()
            } else {
                reject(new Error(
                    `FFmpeg: ${error.slice(-500) || 'no terminó correctamente'}`
                ))
            }
        })
    })
}

function json(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
    })

    res.end(JSON.stringify(data))
}

function content(req, max = 32000) {
    return new Promise((resolve, reject) => {
        const chunks = []
        let size = 0

        req.on('data', chunk => {
            size += chunk.length

            if (size > max) {
                reject(new Error('Archivo o petición demasiado grande.'))
                req.destroy()
            } else {
                chunks.push(chunk)
            }
        })

        req.on('end', () => resolve(Buffer.concat(chunks)))
        req.on('error', reject)
    })
}

async function purge(session) {
    sessions.delete(session.token)

    await fsp.rm(session.dir, {
        recursive: true,
        force: true
    }).catch(() => {})
}

async function serveFile(req, res, file, type) {
    const stat = await fsp.stat(file)
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '')

    const headers = {
        'Content-Type': type,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff'
    }

    if (range) {
        const from = Number(range[1])
        const to = range[2] ? Number(range[2]) : stat.size - 1

        if (from >= stat.size || to < from) {
            res.writeHead(416, {
                'Content-Range': `bytes */${stat.size}`
            })

            return res.end()
        }

        headers['Content-Range'] =
            `bytes ${from}-${Math.min(to, stat.size - 1)}/${stat.size}`
        headers['Content-Length'] =
            Math.min(to, stat.size - 1) - from + 1

        res.writeHead(206, headers)

        return fs.createReadStream(file, {
            start: from,
            end: Math.min(to, stat.size - 1)
        }).pipe(res)
    }

    headers['Content-Length'] = stat.size
    res.writeHead(200, headers)

    fs.createReadStream(file).pipe(res)
}

async function handler(req, res) {
    try {
        if (req.method !== 'GET' && req.method !== 'POST') {
            return json(res, 405, {
                error: 'Método no permitido'
            })
        }

        const parts = new URL(req.url, 'http://localhost')
            .pathname.split('/').filter(Boolean)

        if (
            parts[0] !== 'sticker-editor' ||
            !/^[a-f0-9]{48}$/.test(parts[1] || '')
        ) {
            return json(res, 404, {
                error: 'No encontrado'
            })
        }

        const session = sessions.get(parts[1])

        if (!session || session.expires <= Date.now()) {
            if (session) {
                await purge(session)
            }

            return json(res, 410, {
                error: 'El editor ha caducado. Ejecuta .stickeraudio otra vez.'
            })
        }

        const action = parts[2] || ''

        if (req.method === 'GET' && action === '') {
            const html = await fsp.readFile(
                path.join(__dirname, '../../public/sticker-editor.html')
            )

            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store',
                'X-Frame-Options': 'DENY',
                'Content-Security-Policy':
                    "default-src 'self'; style-src 'self' 'unsafe-inline'; " +
                    "script-src 'self' 'unsafe-inline'; media-src 'self' blob:; " +
                    "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"
            })

            return res.end(html)
        }

        if (req.method === 'GET' && action === 'video') {
            return serveFile(req, res, session.preview, 'video/mp4')
        }

        if (req.method === 'GET' && action === 'info') {
            return json(res, 200, {
                duration: session.duration,
                hasAudio: session.hasAudio,
                maxSeconds: Math.min(
                    15,
                    Math.max(2, Number(process.env.SOUND_STICKER_MAX_SECONDS) || 10)
                )
            })
        }

        if (req.method === 'POST' && action === 'audio') {
            if (session.busy) {
                return json(res, 409, {
                    error: 'Ya se está creando el sticker.'
                })
            }

            const body = await content(req, MAX_UPLOAD)

            if (!body.length) {
                return json(res, 400, {
                    error: 'Selecciona un archivo de audio.'
                })
            }

            session.custom = path.join(session.dir, 'custom-audio.bin')
            await fsp.writeFile(session.custom, body)

            return json(res, 200, { ok: true })
        }

        if (req.method === 'POST' && action === 'audio-url') {
            if (session.busy) {
                return json(res, 409, {
                    error: 'Ya se está creando el sticker.'
                })
            }

            const payload = JSON.parse((await content(req, 3000)).toString('utf8'))
            const url = core.parsePublicVideoUrl(payload.url)

            if (!url) {
                return json(res, 400, {
                    error: 'Introduce un enlace público HTTPS de TikTok o Instagram.'
                })
            }

            session.custom = await core.downloadPublicAudio(url, session.dir)

            return json(res, 200, { ok: true })
        }

        if (req.method === 'POST' && action === 'create') {
            if (session.busy) {
                return json(res, 409, {
                    error: 'Ya se está creando el sticker.'
                })
            }

            const settings = JSON.parse((await content(req)).toString('utf8'))
            const mode = ['none', 'original', 'custom'].includes(settings.sound)
                ? settings.sound
                : 'original'
            const fit = ['completo', 'recorte', 'manual', 'cuadrado'].includes(settings.fit)
                ? settings.fit
                : 'manual'

            const startAt = Number(settings.startAt)
            const zoom = Number(settings.zoom)
            const x = Number(settings.x)
            const y = Number(settings.y)

            if (
                ![startAt, zoom, x, y].every(Number.isFinite) ||
                startAt < 0 ||
                startAt >= session.duration ||
                zoom < 1 || zoom > 3 ||
                x < 0 || x > 1 ||
                y < 0 || y > 1
            ) {
                return json(res, 400, {
                    error: 'Parámetros fuera de rango.'
                })
            }

            if (mode === 'original' && !session.hasAudio) {
                return json(res, 400, {
                    error: 'El video original no tiene audio.'
                })
            }

            if (mode === 'custom' && !session.custom) {
                return json(res, 400, {
                    error: 'Primero selecciona un audio personalizado.'
                })
            }

            session.busy = true

            json(res, 202, {
                ok: true,
                message: 'Procesando. KennyBot enviará el sticker al chat.'
            })

            try {
                await core.makeAndSend(
                    session.sock,
                    session.from,
                    {
                        type: 'local',
                        filePath: session.source
                    },
                    mode === 'custom'
                        ? { type: 'localAudio', filePath: session.custom }
                        : null,
                    session.msg,
                    {
                        soundMode: mode,
                        fit,
                        startAt,
                        framing: { zoom, x, y }
                    }
                )

                await session.sock.sendMessage(session.from, {
                    text: '✅ Sticker creado y enviado.'
                })
            } catch (error) {
                console.error('[StickerEditor]', error)

                await session.sock.sendMessage(session.from, {
                    text: `❌ No pude crear el sticker: ${error.message}`
                }).catch(() => {})
            } finally {
                await purge(session)
            }

            return
        }

        return json(res, 404, {
            error: 'No encontrado'
        })
    } catch (error) {
        if (!res.headersSent) {
            json(res, 500, {
                error: error.message
            })
        }
    }
}

function start() {
    if (server) {
        return
    }

    server = http.createServer((req, res) => handler(req, res))

    server.listen(PORT, HOST, () => {
        console.log(`[StickerEditor] Escuchando en ${HOST}:${PORT}`)
    })

    server.on('error', error => {
        console.error('[StickerEditor] Error del servidor:', error.message)
    })

    const timer = setInterval(() => {
        for (const session of sessions.values()) {
            if (!session.busy && session.expires <= Date.now()) {
                purge(session)
            }
        }
    }, 60000)

    timer.unref()
}

async function launch({ sock, msg, from, chosen }) {
    if (!PUBLIC_URL || !/^https:\/\//i.test(PUBLIC_URL)) {
        return sock.sendMessage(from, {
            text:
                '⚠️ Configura STICKER_EDITOR_PUBLIC_URL con la URL HTTPS pública ' +
                'de tu editor. Mientras tanto puedes usar .stickeraudio rapido ' +
                'para el modo automático.'
        }, { quoted: msg })
    }

    start()

    const dir = await fsp.mkdtemp(
        path.join(os.tmpdir(), 'kenny-sticker-editor-')
    )

    try {
        const source = chosen.type === 'url'
            ? await core.downloadPublicVideo(chosen.url, dir)
            : path.join(
                dir,
                chosen.type === 'sticker' ? 'source.webp' : 'source.mp4'
            )

        if (chosen.type !== 'url') {
            await core.saveMedia(chosen.data, chosen.type, source)
        }

        const preview = path.join(dir, 'preview.mp4')

        await run(FFMPEG, [
            '-hide_banner',
            '-loglevel', 'error',
            '-y',
            '-i', source,
            '-map', '0:v:0',
            '-map', '0:a:0?',
            '-t', '120',
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            '-c:a', 'aac',
            '-b:a', '80k',
            preview
        ])

        const probe = await core.readProbe(source)
        const duration = Math.min(
            120,
            core.durationOf(probe) || core.durationOf(await core.readProbe(preview))
        )

        if (!duration || duration < 0.5) {
            throw new Error('No se detectó duración válida en el video.')
        }

        const token = crypto.randomBytes(24).toString('hex')

        const session = {
            token,
            sock,
            msg,
            from,
            dir,
            source,
            preview,
            duration,
            hasAudio: probe.streams?.some(x => x.codec_type === 'audio') || false,
            expires: Date.now() + EXPIRY,
            busy: false,
            custom: null
        }

        sessions.set(token, session)

        const url = `${PUBLIC_URL}/sticker-editor/${token}`

        await sock.sendMessage(from, {
            text:
                '🎬 *Editor visual de StickerAudio*\n\n' +
                'Abre este enlace privado para seleccionar encuadre, zoom, ' +
                `fragmento y sonido:\n${url}\n\n` +
                '⏱️ Caduca en 20 minutos. No compartas el enlace.'
        }, { quoted: msg })

        return true
    } catch (error) {
        await fsp.rm(dir, {
            recursive: true,
            force: true
        }).catch(() => {})

        return sock.sendMessage(from, {
            text: `❌ Editor: ${error.message}`
        }, { quoted: msg })
    }
}

module.exports = {
    launch,
    start,
    _test: {
        sessions,
        handler
    }
}
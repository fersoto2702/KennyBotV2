const fs = require('fs')

const axios = require('axios')

const https = require('https')

const yts = require('yt-search')

const youtubedl = require('youtube-dl-exec')

const { addToQueue, getQueueLength } = require('../../src/utils/downloadQueue')

const { isMediaTooLarge, getFileSizeMB } = require('../../src/utils/antiCrash')

const generateTempFile = require('../../src/utils/generateTempFile')

const logger = require('../../src/utils/logger')

const ui = require('../../src/utils/ui')

const SPOTIFY_API = 'https://api.vreden.my.id/api/spotify'

const MAX_AUDIO_MB = 25

const http = axios.create({
    timeout: 20000,
    httpsAgent: new https.Agent({
        keepAlive: true,
        maxSockets: 10
    }),
    headers: {
        'User-Agent': 'Mozilla/5.0'
    }
})

async function sendSpotifyMessage(sock, from, text) {
    if (typeof sock.safeSendMessage === 'function') {
        return await sock.safeSendMessage(from, { text })
    }
    return await sock.sendMessage(from, { text })
}

async function sendSpotifyContent(sock, from, content) {
    if (typeof sock.safeSendMessage === 'function') {
        return await sock.safeSendMessage(from, content)
    }
    return await sock.sendMessage(from, content)
}

function normalizeJid(jid) {
    if (!jid) return null
    return String(jid).trim().replace(/:\d+@/, '@')
}

function getBotName(sock) {
    return String(sock?.botProfile?.name || 'KennyBot').trim()
}

function isSpotifyUrl(value = '') {
    try {
        const parsed = new URL(value)
        const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
        return (
            host === 'open.spotify.com' ||
            host === 'spotify.com' ||
            host.endsWith('.spotify.com')
        )
    } catch {
        return false
    }
}

async function removeTemp(filePath) {
    if (!filePath) return
    try {
        await fs.promises.unlink(filePath)
        logger.info(`Temp eliminado: ${filePath}`)
    } catch (err) {
        if (err?.code !== 'ENOENT') {
            logger.warn(`Error borrando temp: ${err.message}`)
        }
    }
}

module.exports = {
    name: 'spotify',
    aliases: ['sp'],
    description: 'Descarga canciones de Spotify en MP3',
    category: 'descargas',

    async execute({
        sock,
        from,
        args = [],
        msg,
        prefix = '/'
    }) {
        let finalPath = null

        try {
            const sender = normalizeJid(
                msg?.key?.participant ||
                msg?.participant ||
                msg?.key?.remoteJid
            )

            if (!sender) {
                return await sendSpotifyMessage(
                    sock,
                    from,
                    ui.error(
                        'ERROR DE USUARIO',
                        'No se pudo identificar al usuario.'
                    )
                )
            }

            const botName = getBotName(sock)
            const url = String(args?.[0] || '').trim()

            if (!url || !isSpotifyUrl(url)) {
                return await sendSpotifyMessage(
                    sock,
                    from,
                    ui.warn(
                        'ENLACE REQUERIDO',
                        `Envía un enlace válido de Spotify.\n\nUso: ${prefix}spotify link`
                    )
                )
            }

            const spotifyPromise = http.get(
                SPOTIFY_API,
                {
                    params: { url }
                }
            )

            const spotifyStatusPromise = sendSpotifyMessage(
                sock,
                from,
                ui.info(
                    '🎧 SPOTIFY',
                    [
                        ['Fuente', 'Spotify'],
                        ['Estado', 'OBTENIENDO INFORMACIÓN']
                    ],
                    'Analizando la canción...'
                )
            ).catch(() => null)

            const response = await spotifyPromise
            await spotifyStatusPromise

            const data = response?.data

            if (!data?.result) {
                return await sendSpotifyMessage(
                    sock,
                    from,
                    ui.error(
                        'SIN INFORMACIÓN',
                        'No se pudieron obtener los datos de la canción.'
                    )
                )
            }

            const trackTitle = String(
                data.result.title || ''
            ).trim()

            const artist = String(
                data.result.artist || ''
            ).trim()

            if (!trackTitle) {
                return await sendSpotifyMessage(
                    sock,
                    from,
                    ui.error(
                        'DATOS INCOMPLETOS',
                        'Spotify no devolvió el título de la canción.'
                    )
                )
            }

            const searchQuery = artist
                ? `${trackTitle} ${artist}`
                : trackTitle

            const searchPromise = yts(searchQuery)

            const searchStatusPromise = sendSpotifyMessage(
                sock,
                from,
                ui.info(
                    '🎵 BUSCANDO AUDIO',
                    [
                        ['Título', trackTitle],
                        ['Artista', artist || 'Desconocido']
                    ],
                    'Buscando la mejor coincidencia...'
                )
            ).catch(() => null)

            const search = await searchPromise
            await searchStatusPromise

            const videos = Array.isArray(search?.videos)
                ? search.videos
                : []

            const video =
                videos.find(item =>
                    item.author?.name
                        ?.toLowerCase()
                        .includes('topic')
                ) ||
                videos.find(item =>
                    item.title
                        ?.toLowerCase()
                        .includes('lyrics')
                ) ||
                videos[0]

            if (!video) {
                return await sendSpotifyMessage(
                    sock,
                    from,
                    ui.error(
                        'SIN RESULTADOS',
                        'No se encontró una coincidencia para esa canción.'
                    )
                )
            }

            const position = getQueueLength() + 1
            const filePath = generateTempFile('temp', 'audio')
            finalPath = `${filePath}.mp3`

            const downloadPromise = addToQueue(async () => {
                await youtubedl(
                    video.url,
                    {
                        format: 'bestaudio/best',
                        extractAudio: true,
                        audioFormat: 'mp3',
                        audioQuality: 0,
                        output: finalPath,
                        noCheckCertificates: true,
                        noPlaylist: true,
                        noWarnings: true
                    }
                )
            })

            const queueStatusPromise = sendSpotifyMessage(
                sock,
                from,
                ui.info(
                    '🎶 COLA DE DESCARGA',
                    [
                        ['Canción', trackTitle],
                        ['Artista', artist || 'Desconocido'],
                        ['Posición', `#${position}`]
                    ],
                    'La canción fue añadida a la cola.'
                )
            ).catch(() => null)

            await downloadPromise
            await queueStatusPromise

            await fs.promises.access(
                finalPath,
                fs.constants.F_OK
            )

            const stats = await fs.promises.stat(finalPath)

            if (isMediaTooLarge(stats.size, MAX_AUDIO_MB)) {
                const size = getFileSizeMB(stats.size)

                await removeTemp(finalPath)
                finalPath = null

                return await sendSpotifyMessage(
                    sock,
                    from,
                    ui.error(
                        'ARCHIVO MUY PESADO',
                        `La canción pesa ${size} MB y supera el límite de ${MAX_AUDIO_MB} MB.`
                    )
                )
            }

            await sendSpotifyContent(
                sock,
                from,
                {
                    audio: {
                        url: finalPath
                    },
                    mimetype: 'audio/mpeg',
                    ptt: false
                }
            )

            await sendSpotifyMessage(
                sock,
                from,
                ui.success(
                    '🎧 SPOTIFY DOWNLOAD',
                    [
                        ['Título', trackTitle],
                        ['Artista', artist || 'Desconocido'],
                        ['Duración', video.timestamp || 'Desconocida'],
                        ['Formato', 'MP3'],
                        ['Fuente', 'Spotify']
                    ],
                    'Canción descargada correctamente.'
                )
            )

            logger.event(
                `${botName} | Spotify: "${trackTitle}" - ${artist || 'Desconocido'} | MP3 | ${sender.split('@')[0]}`
            )

            const pathToDelete = finalPath

            setTimeout(() => {
                removeTemp(pathToDelete).catch(() => {})
            }, 5000)

            finalPath = null

            return {
                success: true
            }
        } catch (err) {
            logger.error(
                `Error spotify: ${err.stack || err.message}`
            )

            if (finalPath) {
                await removeTemp(finalPath)
            }

            let detail =
                'No se pudo descargar la canción.'

            if (
                String(err.message)
                    .toLowerCase()
                    .includes('ffmpeg')
            ) {
                detail =
                    'No se pudo convertir el audio a MP3. Verifica que FFmpeg esté instalado.'
            } else if (
                err.code === 'ECONNABORTED' ||
                err.code === 'ETIMEDOUT'
            ) {
                detail =
                    'Spotify tardó demasiado en responder. Inténtalo nuevamente.'
            }

            try {
                await sendSpotifyMessage(
                    sock,
                    from,
                    ui.error(
                        'ERROR DE SPOTIFY',
                        detail
                    )
                )
            } catch {}

            return {
                success: false
            }
        }
    }
}
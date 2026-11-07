const fs = require('fs')
const path = require('path')
const yts = require('yt-search')
const youtubedl = require('youtube-dl-exec')
const { isMediaTooLarge, getFileSizeMB } = require('../../src/utils/antiCrash')
const { addToQueue, getQueueLength } = require('../../src/utils/downloadQueue')
const generateTempFile = require('../../src/utils/generateTempFile')
const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')

const MAX_AUDIO_MB = 25

async function sendMessage(sock, jid, content, options = {}) {
    if (typeof sock.safeSendMessage === 'function') {
        return await sock.safeSendMessage(jid, content, options)
    }
    return await sock.sendMessage(jid, content, options)
}

async function removeTempFile(filePath) {
    if (!filePath) return
    try {
        await fs.promises.unlink(filePath)
        logger.info(`Temp eliminado: ${path.basename(filePath)}`)
    } catch (err) {
        if (err?.code !== 'ENOENT') {
            logger.warn(`No se pudo borrar temp: ${err.message}`)
        }
    }
}

module.exports = {
    name: 'play',
    aliases: ['music'],
    description: 'Busca y descarga música de YouTube en MP3',
    category: 'descargas',

    async execute({ sock, from, args }) {
        let finalPath = null

        try {
            const query = Array.isArray(args) ? args.join(' ').trim() : ''

            if (!query) {
                return await sendMessage(sock, from, {
                    text: ui.warn(
                        'BÚSQUEDA REQUERIDA',
                        'Uso: /play canción'
                    )
                })
            }

            const searchPromise = yts(query)

            const statusPromise = sendMessage(sock, from, {
                text: ui.info(
                    'BUSCANDO',
                    [['Canción', query]]
                )
            }).catch(() => null)

            const search = await searchPromise
            await statusPromise

            const videos = Array.isArray(search?.videos) ? search.videos : []

            const video =
                videos.find(item =>
                    item.author?.name?.toLowerCase().includes('topic')
                ) ||
                videos.find(item =>
                    item.title?.toLowerCase().includes('lyrics')
                ) ||
                videos[0]

            if (!video) {
                return await sendMessage(sock, from, {
                    text: ui.error(
                        'SIN RESULTADOS',
                        'No se encontró ninguna canción.'
                    )
                })
            }

            const position = getQueueLength() + 1
            const filePath = generateTempFile('temp', 'audio')
            finalPath = `${filePath}.mp3`

            const downloadPromise = addToQueue(async () => {
                await youtubedl(video.url, {
                    format: 'bestaudio/best',
                    extractAudio: true,
                    audioFormat: 'mp3',
                    audioQuality: 0,
                    output: finalPath,
                    noCheckCertificates: true,
                    noPlaylist: true,
                    noWarnings: true
                })
            })

            const queuePromise = sendMessage(sock, from, {
                text: ui.info(
                    'COLA DE DESCARGA',
                    [
                        ['Canción', video.title],
                        ['Posición', `#${position}`],
                        ['Formato', 'MP3']
                    ]
                )
            }).catch(() => null)

            await downloadPromise
            await queuePromise

            await fs.promises.access(finalPath, fs.constants.F_OK)
            const stats = await fs.promises.stat(finalPath)

            if (isMediaTooLarge(stats.size, MAX_AUDIO_MB)) {
                const size = getFileSizeMB(stats.size)

                await removeTempFile(finalPath)
                finalPath = null

                return await sendMessage(sock, from, {
                    text: ui.error(
                        'ARCHIVO MUY PESADO',
                        `Peso: ${size} MB`
                    )
                })
            }

            const safeName = String(video.title || 'audio')
                .replace(/[\\/:*?"<>|]/g, '')
                .slice(0, 80)

            const audioBuffer = await fs.promises.readFile(finalPath)

            if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
                throw new Error('El MP3 generado está vacío o no es válido')
            }

            await sendMessage(sock, from, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                ptt: false,
                fileName: `${safeName}.mp3`
            })

            await sendMessage(sock, from, {
                text: ui.success(
                    'DESCARGA COMPLETADA',
                    [
                        ['Título', video.title],
                        ['Duración', video.timestamp || 'Desconocida'],
                        ['Formato', 'MP3'],
                        ['Peso', `${getFileSizeMB(stats.size)} MB`],
                        ['Vistas', Number(video.views || 0).toLocaleString()]
                    ]
                )
            })

            const pathToDelete = finalPath

            setTimeout(() => {
                removeTempFile(pathToDelete).catch(() => {})
            }, 5000)

            finalPath = null
            return true
        } catch (err) {
            logger.error(`Error play: ${err.stack || err.message}`)

            if (finalPath) {
                await removeTempFile(finalPath)
            }

            let detail = 'No se pudo descargar el audio.'
            const errorText = String(err.message || '').toLowerCase()

            if (errorText.includes('ffmpeg')) {
                detail =
                    'No se pudo convertir el audio a MP3. Verifica que FFmpeg esté instalado.'
            } else if (
                errorText.includes('vacío') ||
                errorText.includes('vacio')
            ) {
                detail =
                    'El archivo MP3 generado no contiene datos válidos.'
            }

            try {
                await sendMessage(sock, from, {
                    text: ui.error('ERROR PLAY', detail)
                })
            } catch {}

            return false
        }
    }
}
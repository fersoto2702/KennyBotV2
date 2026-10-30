const fs = require('fs')

const youtubedl = require('youtube-dl-exec')

const { addToQueue, getQueueLength } = require('../../src/utils/downloadQueue')

const { isMediaTooLarge, getFileSizeMB } = require('../../src/utils/antiCrash')

const generateTempFile = require('../../src/utils/generateTempFile')

const logger = require('../../src/utils/logger')

const ui = require('../../src/utils/ui')

const MAX_AUDIO_MB = 25

async function sendYtmp3Message(sock, from, text) {
    if (typeof sock.safeSendMessage === 'function') {
        return await sock.safeSendMessage(from, { text })
    }
    return await sock.sendMessage(from, { text })
}

async function sendYtmp3Content(sock, from, content) {
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

function isYouTubeUrl(value = '') {
    try {
        const parsed = new URL(value)
        const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
        return (
            host === 'youtube.com' ||
            host.endsWith('.youtube.com') ||
            host === 'youtu.be'
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
    name: 'ytmp3',
    aliases: ['yta'],
    description: 'Descarga audio de YouTube en MP3',
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
                return await sendYtmp3Message(
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

            if (!url || !isYouTubeUrl(url)) {
                return await sendYtmp3Message(
                    sock,
                    from,
                    ui.warn(
                        'ENLACE REQUERIDO',
                        `Envía un enlace válido de YouTube.\n\nUso: ${prefix}ytmp3 link`
                    )
                )
            }

            const position = getQueueLength() + 1
            const filePath = generateTempFile('temp', 'audio')
            finalPath = `${filePath}.mp3`

            const downloadPromise = addToQueue(async () => {
                await youtubedl(
                    url,
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

            const statusPromise = sendYtmp3Message(
                sock,
                from,
                ui.info(
                    '🎵 YOUTUBE MP3',
                    [
                        ['Formato', 'MP3'],
                        ['Posición', `#${position}`],
                        ['Estado', 'EN COLA']
                    ],
                    'El audio será procesado en la mejor calidad disponible.'
                )
            ).catch(() => null)

            await downloadPromise
            await statusPromise

            await fs.promises.access(
                finalPath,
                fs.constants.F_OK
            )

            const stats = await fs.promises.stat(finalPath)

            if (isMediaTooLarge(stats.size, MAX_AUDIO_MB)) {
                const size = getFileSizeMB(stats.size)

                await removeTemp(finalPath)
                finalPath = null

                return await sendYtmp3Message(
                    sock,
                    from,
                    ui.error(
                        'ARCHIVO MUY PESADO',
                        `El audio pesa ${size} MB y supera el límite de ${MAX_AUDIO_MB} MB.`
                    )
                )
            }

            await sendYtmp3Content(
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

            await sendYtmp3Message(
                sock,
                from,
                ui.success(
                    '🎧 YOUTUBE MP3',
                    [
                        ['Formato', 'MP3'],
                        ['Estado', 'COMPLETADO'],
                        ['Peso', `${getFileSizeMB(stats.size)} MB`]
                    ],
                    'Audio descargado correctamente.'
                )
            )

            logger.event(
                `${botName} | YTMP3 descargado por ${sender.split('@')[0]} | ${getFileSizeMB(stats.size)} MB`
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
                `Error ytmp3: ${err.stack || err.message}`
            )

            if (finalPath) {
                await removeTemp(finalPath)
            }

            let detail =
                'No se pudo descargar el audio.'

            if (
                String(err.message)
                    .toLowerCase()
                    .includes('ffmpeg')
            ) {
                detail =
                    'No se pudo convertir el audio a MP3. Verifica que FFmpeg esté instalado.'
            }

            try {
                await sendYtmp3Message(
                    sock,
                    from,
                    ui.error(
                        'ERROR YTMP3',
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
const fs = require('fs')
const youtubedl = require('youtube-dl-exec')
const { isMediaTooLarge, getFileSizeMB } = require('../../src/utils/antiCrash')
const { addToQueue, getQueueLength } = require('../../src/utils/downloadQueue')
const generateTempFile = require('../../src/utils/generateTempFile')
const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')

const MAX_VIDEO_MB = 80

async function sendYtmp4Message(sock, from, text) {
    if (typeof sock.safeSendMessage === 'function') {
        return await sock.safeSendMessage(from, { text })
    }
    return await sock.sendMessage(from, { text })
}

async function sendYtmp4Content(sock, from, content) {
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
    name: 'ytmp4',
    aliases: ['ytv'],
    description: 'Descarga videos de YouTube en MP4',
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
                return await sendYtmp4Message(
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
                return await sendYtmp4Message(
                    sock,
                    from,
                    ui.warn(
                        'ENLACE REQUERIDO',
                        `Envía un enlace válido de YouTube.\n\nUso: ${prefix}ytmp4 link`
                    )
                )
            }

            const position = getQueueLength() + 1
            const filePath = generateTempFile('temp', 'video')
            finalPath = `${filePath}.mp4`

            const downloadPromise = addToQueue(async () => {
                await youtubedl(
                    url,
                    {
                        format:
                            'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
                        mergeOutputFormat:
                            'mp4',
                        output:
                            finalPath,
                        noCheckCertificates:
                            true,
                        noPlaylist:
                            true,
                        noWarnings:
                            true
                    }
                )
            })

            const statusPromise = sendYtmp4Message(
                sock,
                from,
                ui.info(
                    '🎬 YOUTUBE VIDEO',
                    [
                        ['Formato', 'MP4'],
                        ['Posición', `#${position}`],
                        ['Estado', 'EN COLA']
                    ],
                    'El video será procesado en la mejor calidad compatible.'
                )
            ).catch(() => null)

            await downloadPromise
            await statusPromise

            await fs.promises.access(
                finalPath,
                fs.constants.F_OK
            )

            const stats = await fs.promises.stat(finalPath)

            if (isMediaTooLarge(stats.size, MAX_VIDEO_MB)) {
                const size = getFileSizeMB(stats.size)

                await removeTemp(finalPath)
                finalPath = null

                return await sendYtmp4Message(
                    sock,
                    from,
                    ui.error(
                        'ARCHIVO MUY PESADO',
                        `El video pesa ${size} MB y supera el límite de ${MAX_VIDEO_MB} MB.`
                    )
                )
            }

            await sendYtmp4Content(
                sock,
                from,
                {
                    video: {
                        url: finalPath
                    },
                    mimetype:
                        'video/mp4',
                    caption:
                        ui.success(
                            '🎬 YOUTUBE VIDEO',
                            [
                                ['Formato', 'MP4'],
                                ['Estado', 'COMPLETADO'],
                                ['Peso', `${getFileSizeMB(stats.size)} MB`]
                            ],
                            'Video descargado correctamente.'
                        )
                }
            )

            logger.event(
                `${botName} | YTMP4 descargado por ${sender.split('@')[0]} | ${getFileSizeMB(stats.size)} MB`
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
                `Error ytmp4: ${err.stack || err.message}`
            )

            if (finalPath) {
                await removeTemp(finalPath)
            }

            let detail =
                'No se pudo descargar el video.'

            if (
                String(err.message)
                    .toLowerCase()
                    .includes('ffmpeg')
            ) {
                detail =
                    'No se pudo combinar el video y el audio. Verifica que FFmpeg esté instalado.'
            }

            try {
                await sendYtmp4Message(
                    sock,
                    from,
                    ui.error(
                        'ERROR YTMP4',
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
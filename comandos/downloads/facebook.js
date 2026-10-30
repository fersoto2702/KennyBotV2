const axios = require('axios')
const https = require('https')
const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')

const VREDEN_API = 'https://api.vreden.my.id/api/fbdl'
const FALLBACK_API = process.env.FACEBOOK_DOWNLOADER_API || ''

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

async function sendFacebookMessage(sock, from, text) {
    if (typeof sock.safeSendMessage === 'function') {
        return await sock.safeSendMessage(from, { text })
    }

    return await sock.sendMessage(from, { text })
}

async function sendFacebookContent(sock, from, content) {
    if (typeof sock.safeSendMessage === 'function') {
        return await sock.safeSendMessage(from, content)
    }

    return await sock.sendMessage(from, content)
}

function normalizeJid(jid) {
    if (!jid) return null

    return String(jid)
        .trim()
        .replace(/:\d+@/, '@')
}

function getBotName(sock) {
    return String(
        sock?.botProfile?.name ||
        'KennyBot'
    ).trim()
}

function isFacebookUrl(value = '') {
    try {
        const url = new URL(value)

        const host = url.hostname
            .toLowerCase()
            .replace(/^www\./, '')

        return (
            host === 'facebook.com' ||
            host.endsWith('.facebook.com') ||
            host === 'fb.watch' ||
            host.endsWith('.fb.watch')
        )
    } catch {
        return false
    }
}

function extractFacebookResult(data) {
    if (!data) return null

    const result =
        data.result ||
        data.data ||
        data

    if (!result) return null

    const videoUrl =
        result.hd ||
        result.HD ||
        result.sd ||
        result.SD ||
        result.url ||
        result.downloadUrl ||
        result.download_url ||
        result.video

    if (!videoUrl) return null

    return {
        provider: 'Vreden',
        url: videoUrl,
        quality:
            result.hd || result.HD
                ? 'HD'
                : 'SD',
        title:
            result.title ||
            data.title ||
            null
    }
}

async function downloadWithVreden(url) {
    try {
        const response = await http.get(
            VREDEN_API,
            {
                params: { url }
            }
        )

        return extractFacebookResult(
            response?.data
        )
    } catch (err) {
        logger.warn(
            `Facebook Vreden falló: ${err.message}`
        )

        return null
    }
}

async function downloadWithFallback(url) {
    if (!FALLBACK_API) {
        return null
    }

    try {
        const response = await http.post(
            FALLBACK_API,
            {
                url,
                quality: 'best'
            },
            {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        )

        const data = response?.data

        if (!data) {
            return null
        }

        const videoUrl =
            data.download_url ||
            data.downloadUrl ||
            data.video_url ||
            data.url

        if (!videoUrl) {
            return null
        }

        return {
            provider: 'Fallback',
            url: videoUrl,
            quality:
                data.quality ||
                'Mejor disponible',
            title:
                data.video_info?.title ||
                data.title ||
                null
        }
    } catch (err) {
        logger.warn(
            `Facebook fallback falló: ${err.message}`
        )

        return null
    }
}

async function getFacebookVideo(url) {
    const primary =
        await downloadWithVreden(url)

    if (primary) {
        return primary
    }

    return await downloadWithFallback(url)
}

module.exports = {
    name: 'facebook',

    aliases: [
        'fb'
    ],

    description:
        'Descarga videos de Facebook',

    category:
        'descargas',

    async execute({
        sock,
        from,
        args = [],
        msg,
        prefix = '/'
    }) {
        try {
            const sender =
                normalizeJid(
                    msg?.key?.participant ||
                    msg?.participant ||
                    msg?.key?.remoteJid
                )

            if (!sender) {
                return await sendFacebookMessage(
                    sock,
                    from,
                    ui.error(
                        'ERROR DE USUARIO',
                        'No se pudo identificar al usuario.'
                    )
                )
            }

            const botName =
                getBotName(sock)

            const url =
                String(
                    args?.[0] ||
                    ''
                ).trim()

            if (
                !url ||
                !isFacebookUrl(url)
            ) {
                return await sendFacebookMessage(
                    sock,
                    from,
                    ui.warn(
                        'URL INVÁLIDA',
                        `Envía un enlace válido de Facebook.\n\nUso: ${prefix}facebook link`
                    )
                )
            }

            /*
             * Arrancamos la descarga inmediatamente.
             * El aviso se manda en paralelo y no retrasa la API.
             */
            const downloadPromise =
                getFacebookVideo(url)

            const statusPromise =
                sendFacebookMessage(
                    sock,
                    from,
                    ui.info(
                        '📘 FACEBOOK',
                        [
                            ['Fuente', 'Facebook'],
                            ['Estado', 'PROCESANDO']
                        ],
                        'Obteniendo el video...'
                    )
                ).catch(() => null)

            const result =
                await downloadPromise

            await statusPromise

            if (!result) {
                return await sendFacebookMessage(
                    sock,
                    from,
                    ui.error(
                        'DESCARGA FALLIDA',
                        'No se pudo obtener el video. La API puede estar temporalmente fuera de servicio o el contenido puede ser privado.'
                    )
                )
            }

            const fields = [
                ['Estado', 'DESCARGADO'],
                ['Calidad', result.quality]
            ]

            if (result.title) {
                fields.push(
                    ['Título', result.title]
                )
            }

            await sendFacebookContent(
                sock,
                from,
                {
                    video: {
                        url: result.url
                    },
                    mimetype: 'video/mp4',
                    caption: ui.success(
                        '📘 FACEBOOK',
                        fields,
                        'Video descargado correctamente.'
                    )
                }
            )

            logger.event(
                `${botName} | Facebook descargado por ${sender.split('@')[0]} | ${result.provider}`
            )

            return {
                success: true,
                provider: result.provider
            }
        } catch (err) {
            logger.error(
                `Error facebook: ${err.stack || err.message}`
            )

            try {
                await sendFacebookMessage(
                    sock,
                    from,
                    ui.error(
                        'ERROR INTERNO',
                        'No se pudo descargar el video de Facebook.'
                    )
                )
            } catch {}

            return {
                success: false
            }
        }
    }
}
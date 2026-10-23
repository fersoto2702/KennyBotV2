const axios =
    require('axios')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const VREDEN_API =
    'https://api.vreden.my.id/api/fbdl'

const FALLBACK_API =
    process.env.FACEBOOK_DOWNLOADER_API ||
    ''

async function sendFacebookMessage(
    sock,
    from,
    text
) {

    if (
        typeof sock.safeSendMessage ===
        'function'
    ) {

        return await sock.safeSendMessage(
            from,
            {
                text
            }
        )

    }

    return await sock.sendMessage(
        from,
        {
            text
        }
    )

}

function normalizeJid(
    jid
) {

    if (!jid) {

        return null

    }

    return String(
        jid
    )
        .trim()
        .replace(
            /:\d+@/,
            '@'
        )

}

function getBotName(
    sock
) {

    return String(
        sock?.botProfile?.name ||
        'KennyBot'
    )
        .trim()

}

function isFacebookUrl(
    value = ''
) {

    try {

        const url =
            new URL(
                value
            )

        const host =
            url.hostname
                .toLowerCase()
                .replace(
                    /^www\./,
                    ''
                )

        return (
            host ===
                'facebook.com'
            ||
            host.endsWith(
                '.facebook.com'
            )
            ||
            host ===
                'fb.watch'
            ||
            host.endsWith(
                '.fb.watch'
            )
        )

    } catch {

        return false

    }

}

async function downloadWithVreden(
    url
) {

    try {

        const response =
            await axios.get(
                VREDEN_API,
                {
                    params: {
                        url
                    },

                    timeout:
                        30000,

                    headers: {
                        'User-Agent':
                            'Mozilla/5.0'
                    }
                }
            )

        const data =
            response.data

        if (!data) {

            return null

        }

        const result =
            data.result ||
            data.data ||
            data

        if (!result) {

            return null

        }

        const videoUrl =

            result.hd ||

            result.HD ||

            result.sd ||

            result.SD ||

            result.url ||

            result.downloadUrl ||

            result.download_url ||

            result.video

        if (
            !videoUrl
        ) {

            return null

        }

        return {
            provider:
                'Vreden',

            url:
                videoUrl,

            quality:
                result.hd ||
                result.HD
                    ? 'HD'
                    : 'SD',

            title:
                result.title ||
                data.title ||
                null
        }

    } catch (err) {

        logger.warn(
            `Facebook Vreden falló: ${err.stack || err.message}`
        )

        return null

    }

}

async function downloadWithFallback(
    url
) {

    if (
        !FALLBACK_API
    ) {

        return null

    }

    try {

        const response =
            await axios.post(
                FALLBACK_API,
                {
                    url,

                    quality:
                        'best'
                },
                {
                    timeout:
                        45000,

                    headers: {
                        'Content-Type':
                            'application/json',

                        'User-Agent':
                            'Mozilla/5.0'
                    }
                }
            )

        const data =
            response.data

        if (!data) {

            return null

        }

        const videoUrl =

            data.download_url ||

            data.downloadUrl ||

            data.video_url ||

            data.url

        if (
            !videoUrl
        ) {

            return null

        }

        return {
            provider:
                'Fallback',

            url:
                videoUrl,

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
            `Facebook fallback falló: ${err.stack || err.message}`
        )

        return null

    }

}

async function getFacebookVideo(
    url
) {

    let result =
        await downloadWithVreden(
            url
        )

    if (
        result
    ) {

        return result

    }

    result =
        await downloadWithFallback(
            url
        )

    if (
        result
    ) {

        return result

    }

    return null

}

module.exports = {

    name:
        'facebook',

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

                    msg.key?.participant ||

                    msg.participant ||

                    msg.key?.remoteJid

                )

            if (
                !sender
            ) {

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
                getBotName(
                    sock
                )

            const url =
                String(
                    args?.[0] ||
                    ''
                )
                    .trim()

            if (
                !url ||
                !isFacebookUrl(
                    url
                )
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

            const result =
                await getFacebookVideo(
                    url
                )

            if (
                !result
            ) {

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
                [
                    'Estado',
                    'DESCARGADO'
                ],
                [
                    'Calidad',
                    result.quality
                ]
            ]

            if (
                result.title
            ) {

                fields.push(
                    [
                        'Título',
                        result.title
                    ]
                )

            }

            const content = {
                video: {
                    url:
                        result.url
                },

                mimetype:
                    'video/mp4',

                caption:
                    ui.success(
                        '📘 FACEBOOK',
                        fields,
                        'Video descargado correctamente.'
                    )
            }

            if (
                typeof sock.safeSendMessage ===
                'function'
            ) {

                await sock.safeSendMessage(
                    from,
                    content
                )

            } else {

                await sock.sendMessage(
                    from,
                    content
                )

            }

            logger.event(
                `${botName} | Facebook descargado por ${sender.split('@')[0]} | ${result.provider}`
            )

            return {
                success:
                    true,

                provider:
                    result.provider
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
                success:
                    false
            }

        }

    }

}
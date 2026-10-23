const axios =
    require('axios')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


const INSTAGRAM_API =
    'https://api.azbry.com/api/download/instagram'

const API_TIMEOUT =
    30000

const MAX_API_RETRIES =
    1

const MAX_MEDIA_ITEMS =
    10

const MEDIA_SEND_DELAY =
    1500


function sleep(
    ms
) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    )

}


async function sendInstagramMessage(
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


    return String(jid)
        .trim()
        .replace(
            /:\d+@/,
            '@'
        )

}


function isInstagramUrl(
    value
) {

    if (!value) {

        return false

    }


    try {

        const url =
            new URL(
                value
            )


        const hostname =
            url.hostname
                .toLowerCase()
                .replace(
                    /^www\./,
                    ''
                )


        return (

            hostname ===
            'instagram.com'

            ||

            hostname.endsWith(
                '.instagram.com'
            )

        )


    } catch {

        return false

    }

}


function getRetryAfterSeconds(
    error
) {

    const apiValue =
        Number(
            error.response
                ?.data
                ?.retry_after
        )


    if (
        Number.isFinite(apiValue) &&
        apiValue > 0
    ) {

        return Math.min(
            Math.floor(apiValue),
            120
        )

    }


    const headerValue =
        Number(
            error.response
                ?.headers
                ?.['retry-after']
        )


    if (
        Number.isFinite(headerValue) &&
        headerValue > 0
    ) {

        return Math.min(
            Math.floor(headerValue),
            120
        )

    }


    return 60

}


function isRetryableApiError(
    error
) {

    const status =
        Number(
            error.response?.status ||
            0
        )


    const retryable =
        error.response
            ?.data
            ?.retryable


    if (
        retryable === true
    ) {

        return true

    }


    return [
        429,
        500,
        502,
        503,
        504
    ].includes(
        status
    )

}


async function requestInstagramApi(
    url
) {

    let lastError =
        null


    for (
        let attempt = 0;
        attempt <= MAX_API_RETRIES;
        attempt++
    ) {

        try {

            const response =
                await axios.get(

                    INSTAGRAM_API,

                    {
                        params: {
                            url
                        },

                        timeout:
                            API_TIMEOUT,

                        headers: {
                            'User-Agent':
                                'Mozilla/5.0'
                        }
                    }

                )


            return response


        } catch (err) {

            lastError =
                err


            const status =
                Number(
                    err.response?.status ||
                    0
                )


            const canRetry =
                isRetryableApiError(
                    err
                )


            if (
                !canRetry ||
                attempt >= MAX_API_RETRIES
            ) {

                throw err

            }


            const retryAfter =
                getRetryAfterSeconds(
                    err
                )


            logger.warn(

                `Instagram API ${status || 'ERROR'} | ` +
                `Reintento ${attempt + 1}/${MAX_API_RETRIES} ` +
                `en ${retryAfter}s`

            )


            await sleep(
                retryAfter *
                1000
            )

        }

    }


    throw lastError ||
        new Error(
            'INSTAGRAM_API_FAILED'
        )

}


function extractMedia(
    data
) {

    const videos =
        Array.isArray(
            data?.videos
        )

            ? data.videos
                .filter(
                    item =>
                        typeof item === 'string' &&
                        item.trim()
                )

            : []


    const images =
        Array.isArray(
            data?.images
        )

            ? data.images
                .filter(
                    item =>
                        typeof item === 'string' &&
                        item.trim()
                )

            : []


    return [

        ...videos.map(
            url => ({
                type:
                    'video',

                url
            })
        ),

        ...images.map(
            url => ({
                type:
                    'image',

                url
            })
        )

    ]
        .slice(
            0,
            MAX_MEDIA_ITEMS
        )

}


module.exports = {

    name:
        'instagram',

    aliases: [
        'ig'
    ],

    description:
        'Descarga fotos y videos de Instagram',

    category:
        'descargas',


    async execute({

        sock,
        from,
        args = [],
        msg

    }) {

        try {

            /* ─────────────────────────────
               USUARIO
            ───────────────────────────── */

            const sender =
                normalizeJid(

                    msg.key?.participant ||

                    msg.participant ||

                    msg.key?.remoteJid

                )


            if (!sender) {

                return await sendInstagramMessage(

                    sock,

                    from,

                    ui.error(

                        'ERROR DE USUARIO',

                        'No se pudo identificar al usuario.'

                    )

                )

            }


            /* ─────────────────────────────
               URL
            ───────────────────────────── */

            const url =
                String(
                    args?.[0] || ''
                )
                    .trim()


            if (
                !isInstagramUrl(
                    url
                )
            ) {

                return await sendInstagramMessage(

                    sock,

                    from,

                    ui.warn(

                        'ENLACE REQUERIDO',

                        'Envía un enlace válido de Instagram.\n\nUso: /instagram link'

                    )

                )

            }


            /* ─────────────────────────────
               PROCESANDO
            ───────────────────────────── */

            await sendInstagramMessage(

                sock,

                from,

                ui.info(

                    '📸 INSTAGRAM',

                    [
                        [
                            'Estado',
                            'Procesando descarga'
                        ],
                        [
                            'Fuente',
                            'Instagram'
                        ]
                    ],

                    'Buscando el contenido disponible...'

                )

            )


            /* ─────────────────────────────
               API
            ───────────────────────────── */

            const response =
                await requestInstagramApi(
                    url
                )


            const data =
                response?.data


            logger.info(

                `Instagram API response: ${JSON.stringify(data)}`

            )


            /* ─────────────────────────────
               VALIDAR RESPUESTA
            ───────────────────────────── */

            if (
                !data ||
                data.status !== true
            ) {

                return await sendInstagramMessage(

                    sock,

                    from,

                    ui.error(

                        'DESCARGA FALLIDA',

                        'Instagram no devolvió contenido descargable.'

                    )

                )

            }


            /* ─────────────────────────────
               CONTENIDO
            ───────────────────────────── */

            const media =
                extractMedia(
                    data
                )


            if (
                media.length === 0
            ) {

                return await sendInstagramMessage(

                    sock,

                    from,

                    ui.error(

                        'SIN CONTENIDO',

                        'No se encontraron fotos o videos disponibles para descargar.'

                    )

                )

            }


            /* ─────────────────────────────
               ENVIAR MEDIA
            ───────────────────────────── */

            let enviados =
                0


            for (
                const item
                of media
            ) {

                try {

                    if (
                        item.type ===
                        'video'
                    ) {

                        await sock.sendMessage(

                            from,

                            {
                                video: {
                                    url:
                                        item.url
                                },

                                mimetype:
                                    'video/mp4',

                                caption:
                                    ui.success(

                                        '📸 INSTAGRAM DOWNLOAD',

                                        [
                                            [
                                                'Contenido',
                                                'VIDEO'
                                            ],
                                            [
                                                'Estado',
                                                'DESCARGADO'
                                            ]
                                        ],

                                        'Video listo para disfrutar.'

                                    )
                            }

                        )

                    }


                    else if (
                        item.type ===
                        'image'
                    ) {

                        await sock.sendMessage(

                            from,

                            {
                                image: {
                                    url:
                                        item.url
                                },

                                caption:
                                    ui.success(

                                        '📸 INSTAGRAM DOWNLOAD',

                                        [
                                            [
                                                'Contenido',
                                                'IMAGEN'
                                            ],
                                            [
                                                'Estado',
                                                'DESCARGADA'
                                            ]
                                        ],

                                        'Imagen descargada correctamente.'

                                    )
                            }

                        )

                    }


                    else {

                        continue

                    }


                    enviados++


                    await sleep(
                        MEDIA_SEND_DELAY
                    )


                } catch (mediaErr) {

                    logger.warn(

                        `Error enviando media Instagram: ${mediaErr.stack || mediaErr.message}`

                    )

                }

            }


            /* ─────────────────────────────
               VALIDAR ENVÍO
            ───────────────────────────── */

            if (
                enviados === 0
            ) {

                return await sendInstagramMessage(

                    sock,

                    from,

                    ui.error(

                        'ERROR DE ENVÍO',

                        'El contenido fue encontrado, pero WhatsApp no pudo recibirlo.'

                    )

                )

            }


            /* ─────────────────────────────
               FINAL
            ───────────────────────────── */

            await sendInstagramMessage(

                sock,

                from,

                ui.success(

                    'DESCARGA COMPLETADA',

                    [
                        [
                            'Archivos enviados',
                            `${enviados}`
                        ],
                        [
                            'Estado',
                            'COMPLETADO'
                        ]
                    ],

                    'Todo el contenido disponible fue enviado correctamente.'

                )

            )


            logger.event(

                `Instagram: ${sender.split('@')[0]} → ${enviados} archivo(s)`

            )


            return {
                success:
                    true,

                sent:
                    enviados
            }


        } catch (err) {

            const status =
                Number(
                    err.response?.status ||
                    0
                )


            const responseData =
                err.response?.data


            logger.error(

                `Error instagram: ${err.stack || err.message}`

            )


            if (
                err.response
            ) {

                logger.error(

                    `Instagram API status: ${status}`

                )


                logger.error(

                    `Instagram API response: ${JSON.stringify(responseData)}`

                )

            }


            if (
                err.code
            ) {

                logger.error(

                    `Instagram error code: ${err.code}`

                )

            }


            try {

                if (
                    status === 502
                ) {

                    const retryAfter =
                        getRetryAfterSeconds(
                            err
                        )


                    return await sendInstagramMessage(

                        sock,

                        from,

                        ui.warn(

                            'SERVIDOR DE INSTAGRAM NO DISPONIBLE',

                            `El servidor de descarga está teniendo problemas temporalmente.\n\nIntenta nuevamente en aproximadamente ${retryAfter} segundos.`

                        )

                    )

                }


                if (
                    status === 429
                ) {

                    const retryAfter =
                        getRetryAfterSeconds(
                            err
                        )


                    return await sendInstagramMessage(

                        sock,

                        from,

                        ui.warn(

                            'LÍMITE TEMPORAL',

                            `La API está recibiendo demasiadas solicitudes.\n\nIntenta nuevamente en aproximadamente ${retryAfter} segundos.`

                        )

                    )

                }


                if (
                    status === 503 ||
                    status === 504
                ) {

                    return await sendInstagramMessage(

                        sock,

                        from,

                        ui.warn(

                            'SERVICIO TEMPORALMENTE CAÍDO',

                            'El servidor externo de Instagram no está disponible en este momento. Intenta nuevamente más tarde.'

                        )

                    )

                }


                if (
                    err.code ===
                    'ECONNABORTED'
                ) {

                    return await sendInstagramMessage(

                        sock,

                        from,

                        ui.warn(

                            'TIEMPO DE ESPERA AGOTADO',

                            'El servidor de descarga tardó demasiado en responder. Intenta nuevamente.'

                        )

                    )

                }


                return await sendInstagramMessage(

                    sock,

                    from,

                    ui.error(

                        'ERROR DE INSTAGRAM',

                        'No se pudo completar la descarga del contenido.'

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
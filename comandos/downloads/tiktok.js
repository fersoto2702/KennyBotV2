const axios =
    require('axios')

const https =
    require('https')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


const TIKWM_API =
    'https://www.tikwm.com/api/'


/*
 * Reutilizamos conexiones HTTPS para evitar
 * abrir una conexión nueva en cada /tiktok.
 */
const http =
    axios.create(
        {
            timeout:
                20000,

            httpsAgent:
                new https.Agent(
                    {
                        keepAlive:
                            true,

                        maxSockets:
                            10
                    }
                ),

            headers: {
                'Content-Type':
                    'application/json',

                'User-Agent':
                    'Mozilla/5.0'
            }
        }
    )


async function sendTikTokMessage(
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


async function sendTikTokContent(
    sock,
    from,
    content
) {

    if (
        typeof sock.safeSendMessage ===
        'function'
    ) {

        return await sock.safeSendMessage(
            from,
            content
        )

    }

    return await sock.sendMessage(
        from,
        content
    )

}


function normalizeJid(
    jid
) {

    if (
        !jid
    ) {

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


function isTikTokUrl(
    value = ''
) {

    try {

        const parsed =
            new URL(
                value
            )

        const host =
            parsed.hostname
                .toLowerCase()
                .replace(
                    /^www\./,
                    ''
                )

        return (
            host ===
                'tiktok.com'
            ||
            host.endsWith(
                '.tiktok.com'
            )
        )

    } catch {

        return false

    }

}


function formatNumber(
    value
) {

    const number =
        Number(
            value ||
            0
        )

    if (
        Number.isNaN(
            number
        )
    ) {

        return '0'

    }

    return number.toLocaleString(
        'es-MX'
    )

}


function formatDuration(
    seconds
) {

    const total =
        Number(
            seconds ||
            0
        )

    if (
        !Number.isFinite(
            total
        ) ||
        total <=
            0
    ) {

        return 'Desconocida'

    }

    const minutes =
        Math.floor(
            total /
            60
        )

    const remaining =
        Math.floor(
            total %
            60
        )

    return `${minutes}:${String(remaining).padStart(2, '0')}`

}


module.exports = {

    name:
        'tiktok',

    aliases: [
        'tt'
    ],

    description:
        'Descarga videos de TikTok sin marca de agua',

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


            if (
                !sender
            ) {

                return await sendTikTokMessage(
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
                !isTikTokUrl(
                    url
                )
            ) {

                return await sendTikTokMessage(
                    sock,
                    from,
                    ui.warn(
                        'ENLACE REQUERIDO',
                        `Envía un enlace válido de TikTok.\n\nUso: ${prefix}tiktok link`
                    )
                )

            }


            /*
             * La petición empieza INMEDIATAMENTE.
             * No esperamos a que WhatsApp termine de enviar
             * el aviso de "PROCESANDO".
             */
            const apiPromise =
                http.post(
                    TIKWM_API,
                    {
                        url
                    }
                )


            const statusPromise =
                sendTikTokMessage(
                    sock,
                    from,
                    ui.info(
                        '🎵 TIKTOK',
                        [
                            [
                                'Fuente',
                                'TikTok'
                            ],
                            [
                                'Estado',
                                'PROCESANDO'
                            ]
                        ],
                        'Obteniendo información del video...'
                    )
                )
                    .catch(
                        () =>
                            null
                    )


            const response =
                await apiPromise


            /*
             * El aviso puede terminar mientras la API trabaja,
             * pero nunca retrasa el inicio de la petición.
             */
            await statusPromise


            const responseData =
                response?.data


            if (
                !responseData ||
                responseData.code !==
                    0 ||
                !responseData.data
            ) {

                return await sendTikTokMessage(
                    sock,
                    from,
                    ui.error(
                        'DESCARGA FALLIDA',
                        responseData?.msg ||
                        'No se pudo obtener información del video.'
                    )
                )

            }


            const data =
                responseData.data


            const videoUrl =
                data.hdplay ||
                data.play ||
                data.wmplay


            if (
                !videoUrl
            ) {

                return await sendTikTokMessage(
                    sock,
                    from,
                    ui.error(
                        'VIDEO NO DISPONIBLE',
                        'TikTok no devolvió un enlace descargable.'
                    )
                )

            }


            const title =
                data.title ||
                'Sin título'


            const nickname =
                data.author?.nickname ||
                'Desconocido'


            const username =
                data.author?.unique_id ||
                data.author?.uniqueId ||
                null


            const author =
                username
                    ? `${nickname} (@${username})`
                    : nickname


            const duration =
                formatDuration(
                    data.duration
                )


            const likes =
                formatNumber(
                    data.digg_count
                )


            const comments =
                formatNumber(
                    data.comment_count
                )


            const views =
                formatNumber(
                    data.play_count
                )


            const shares =
                formatNumber(
                    data.share_count
                )


            const caption = [

                'ㅤ۟∩　ׅ　★　ׅ　*🅣𝗂𝗄𝖳𝗈𝗄 🅓ownload*　ׄᰙ',

                '',

                `𖣣ֶㅤ֯⌗ ✎  ׄ ⬭ *Título:* ${title}`,

                `𖣣ֶㅤ֯⌗ ꕥ  ׄ ⬭ *Autor:* ${author}`,

                `𖣣ֶㅤ֯⌗ ⴵ  ׄ ⬭ *Duración:* ${duration}`,

                `𖣣ֶㅤ֯⌗ ❖  ׄ ⬭ *Likes:* ${likes}`,

                `𖣣ֶㅤ֯⌗ ❀  ׄ ⬭ *Comentarios:* ${comments}`,

                `𖣣ֶㅤ֯⌗ ✿  ׄ ⬭ *Vistas:* ${views}`,

                `𖣣ֶㅤ֯⌗ ☆  ׄ ⬭ *Compartidos:* ${shares}`,

                '',

                '╰─ 𓂃 Video descargado sin marca de agua.'

            ]
                .join(
                    '\n'
                )


            /*
             * Enviamos primero el video, que es el resultado
             * principal del comando.
             */
            await sendTikTokContent(
                sock,
                from,
                {
                    video: {
                        url:
                            videoUrl
                    },

                    mimetype:
                        'video/mp4',

                    caption
                }
            )


            /*
             * El audio es secundario. Si falla,
             * no invalida el video ya entregado.
             */
            if (
                data.music
            ) {

                sendTikTokContent(
                    sock,
                    from,
                    {
                        audio: {
                            url:
                                data.music
                        },

                        mimetype:
                            'audio/mpeg',

                        ptt:
                            false
                    }
                )
                    .catch(
                        audioErr => {

                            logger.warn(
                                `${botName} | Audio TikTok falló: ${audioErr.message}`
                            )

                        }
                    )

            }


            logger.event(
                `${botName} | TikTok descargado: ${username || nickname} | ${sender.split('@')[0]}`
            )


            return {
                success:
                    true
            }


        } catch (err) {

            logger.error(
                `Error tiktok: ${err.stack || err.message}`
            )


            if (
                err.response
            ) {

                logger.error(
                    `TikTok API status: ${err.response.status}`
                )

            }


            let detail =
                'El servicio de descarga de TikTok se encuentra temporalmente fuera de servicio.'


            if (
                err.code ===
                    'ECONNABORTED' ||
                err.code ===
                    'ETIMEDOUT'
            ) {

                detail =
                    'TikTok tardó demasiado en responder. Inténtalo nuevamente.'

            }


            try {

                await sendTikTokMessage(
                    sock,
                    from,
                    ui.error(
                        'ERROR DE TIKTOK',
                        detail
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
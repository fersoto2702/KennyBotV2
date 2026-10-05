const axios =
    require('axios')

const {
    checkCooldown
} = require('../../src/utils/cooldowns')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


const TIKWM_API =
    'https://www.tikwm.com/api/'


async function sendTikTokMessage(
    sock,
    from,
    text
) {

    return await sock.sendMessage(
        from,
        {
            text
        }
    )

}


function isTikTokUrl(value = '') {

    try {

        const parsed =
            new URL(value)

        const host =
            parsed.hostname
                .toLowerCase()
                .replace(/^www\./, '')


        return (
            host === 'tiktok.com' ||
            host.endsWith('.tiktok.com')
        )

    } catch {

        return false

    }

}


function formatNumber(value) {

    const number =
        Number(value || 0)


    if (
        Number.isNaN(number)
    ) {

        return '0'

    }


    return number.toLocaleString(
        'es-MX'
    )

}


function formatDuration(seconds) {

    const total =
        Number(seconds || 0)


    if (
        !Number.isFinite(total) ||
        total <= 0
    ) {

        return 'Desconocida'

    }


    const minutes =
        Math.floor(
            total / 60
        )


    const remaining =
        Math.floor(
            total % 60
        )


    return (
        `${minutes}:${String(remaining).padStart(2, '0')}`
    )

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

    cooldown:
        10,


    async execute({

        sock,
        from,
        args,
        msg

    }) {

        try {

            /* ─────────────────────────────
               USUARIO
            ───────────────────────────── */

            const sender =

                msg.key.participant ||

                msg.key.remoteJid


            /* ─────────────────────────────
               COOLDOWN
            ───────────────────────────── */

            const cooldown =
                checkCooldown(

                    sender,

                    'tiktok',

                    10

                )


            if (
                cooldown.active
            ) {

                return await sendTikTokMessage(

                    sock,

                    from,

                    ui.warn(

                        'COOLDOWN ACTIVO',

                        `Espera ${cooldown.left}s antes de volver a usar este comando.`

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
                !url ||
                !isTikTokUrl(url)
            ) {

                return await sendTikTokMessage(

                    sock,

                    from,

                    ui.warn(

                        'ENLACE REQUERIDO',

                        'Envía un enlace válido de TikTok.\n\nUso: /tiktok link'

                    )

                )

            }


            /* ─────────────────────────────
               PROCESANDO
            ───────────────────────────── */

            await sendTikTokMessage(

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


            /* ─────────────────────────────
               API
            ───────────────────────────── */

            const response =
                await axios.post(

                    TIKWM_API,

                    {
                        url
                    },

                    {

                        timeout:
                            30000,

                        headers: {

                            'Content-Type':
                                'application/json',

                            'User-Agent':
                                'Mozilla/5.0'

                        }

                    }

                )


            const responseData =
                response.data


            logger.info(

                `TikTok API response: ${
                    JSON.stringify(responseData)
                }`

            )


            /* ─────────────────────────────
               VALIDAR RESPUESTA
            ───────────────────────────── */

            if (
                !responseData ||
                responseData.code !== 0 ||
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


            /* ─────────────────────────────
               VIDEO
            ───────────────────────────── */

            const videoUrl =

                data.hdplay ||

                data.play ||

                data.wmplay


            if (!videoUrl) {

                return await sendTikTokMessage(

                    sock,

                    from,

                    ui.error(

                        'VIDEO NO DISPONIBLE',

                        'TikTok no devolvió un enlace descargable.'

                    )

                )

            }


            /* ─────────────────────────────
               DATOS
            ───────────────────────────── */

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


            /* ─────────────────────────────
               DECORACIÓN ESPECIAL TIKTOK
            ───────────────────────────── */

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

            ].join('\n')


            /* ─────────────────────────────
               ENVIAR VIDEO
            ───────────────────────────── */

            await sock.sendMessage(

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


            /* ─────────────────────────────
               AUDIO
            ───────────────────────────── */

            if (
                data.music
            ) {

                try {

                    await sock.sendMessage(

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

                } catch (audioErr) {

                    logger.warn(

                        `Audio TikTok falló: ${audioErr.message}`

                    )

                }

            }


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `TikTok descargado: ${username || nickname} | ${sender?.split('@')[0] || 'desconocido'}`

            )


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

                logger.error(

                    `TikTok API response: ${
                        JSON.stringify(
                            err.response.data
                        )
                    }`

                )

            }


            let detail =
                'El servicio de descarga de TikTok se encuentra temporalmente fuera de servicio.'


            if (
                err.code === 'ECONNABORTED'
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

        }

    }

}
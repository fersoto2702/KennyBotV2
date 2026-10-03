const axios =
    require('axios')

const {
    checkCooldown
} = require('../../src/utils/cooldowns')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


/* ─────────────────────────────
   CONFIGURACIÓN
───────────────────────────── */

/*
    API primaria.

    Se mantiene Vreden porque ya la
    estabas usando, pero ahora está
    encapsulada y si falla no tumba
    todo el comando.
*/

const VREDEN_API =
    'https://api.vreden.my.id/api/fbdl'


/*
    API alternativa opcional.

    Puedes montar una API propia de
    Facebook Downloader y colocar aquí:

    http://TU_SERVIDOR:8000/download

    Si la dejas vacía, simplemente
    se omite.
*/

const FALLBACK_API =
    process.env.FACEBOOK_DOWNLOADER_API ||
    ''


/* ─────────────────────────────
   MENSAJE SIMPLE
───────────────────────────── */

async function sendFacebookMessage(
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


/* ─────────────────────────────
   VALIDAR URL
───────────────────────────── */

function isFacebookUrl(value = '') {

    try {

        const url =
            new URL(value)

        const host =
            url.hostname
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


/* ─────────────────────────────
   VREDEN
───────────────────────────── */

async function downloadWithVreden(url) {

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


        if (!data)
            return null


        /*
            Algunos servicios cambian
            ligeramente la estructura,
            así que contemplamos varias.
        */

        const result =
            data.result ||
            data.data ||
            data


        if (!result)
            return null


        const videoUrl =

            result.hd ||

            result.HD ||

            result.sd ||

            result.SD ||

            result.url ||

            result.downloadUrl ||

            result.download_url ||

            result.video


        if (!videoUrl)
            return null


        return {

            provider:
                'Vreden',

            url:
                videoUrl,

            quality:
                result.hd || result.HD
                    ? 'HD'
                    : 'SD',

            title:
                result.title ||
                data.title ||
                null

        }


    } catch (err) {

        logger.warn(
            `Facebook Vreden falló: ${err.message}`
        )

        return null

    }

}


/* ─────────────────────────────
   API FALLBACK
───────────────────────────── */

async function downloadWithFallback(url) {

    if (!FALLBACK_API)
        return null


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


        if (!data)
            return null


        const videoUrl =

            data.download_url ||

            data.downloadUrl ||

            data.video_url ||

            data.url


        if (!videoUrl)
            return null


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
            `Facebook fallback falló: ${err.message}`
        )

        return null

    }

}


/* ─────────────────────────────
   DESCARGADOR GENERAL
───────────────────────────── */

async function getFacebookVideo(url) {

    /*
        1. Intentamos Vreden
    */

    let result =
        await downloadWithVreden(
            url
        )


    if (result)
        return result


    /*
        2. Intentamos servidor alternativo
    */

    result =
        await downloadWithFallback(
            url
        )


    if (result)
        return result


    return null

}


/* ─────────────────────────────
   COMANDO
───────────────────────────── */

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

                    'facebook',

                    10

                )


            if (
                cooldown.active
            ) {

                return await sendFacebookMessage(

                    sock,

                    from,

                    ui.warn(

                        'COOLDOWN ACTIVO',

                        `Espera ${cooldown.left}s antes de usar este comando.`

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
                !isFacebookUrl(url)
            ) {

                return await sendFacebookMessage(

                    sock,

                    from,

                    ui.warn(

                        'URL INVÁLIDA',

                        'Envía un enlace válido de Facebook.\n\nUso: /facebook link'

                    )

                )

            }


            /* ─────────────────────────────
               OBTENER VIDEO
            ───────────────────────────── */

            const result =
                await getFacebookVideo(
                    url
                )


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


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

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


            if (result.title) {

                fields.push(

                    [
                        'Título',
                        result.title
                    ]

                )

            }


            await sock.sendMessage(

                from,

                {

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

            )


            logger.event(

                `Facebook descargado por ${sender?.split('@')[0] || 'desconocido'} | ${result.provider}`

            )


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

        }

    }

}
const axios =
    require('axios')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


async function sendInstagramMessage(
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
        args,
        msg

    }) {

        try {

            /* ─────────────────────────────
               USUARIO
            ───────────────────────────── */

            const sender =

                msg.key.participant ||

                msg.participant ||

                msg.key.remoteJid


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
                await axios.get(

                    'https://api.azbry.com/api/download/instagram',

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

            const videos =
                Array.isArray(
                    data.videos
                )
                    ? data.videos
                        .filter(Boolean)
                    : []


            const images =
                Array.isArray(
                    data.images
                )
                    ? data.images
                        .filter(Boolean)
                    : []


            if (
                videos.length === 0 &&
                images.length === 0
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


            const media = [

                ...videos.map(

                    mediaUrl => ({

                        type:
                            'video',

                        url:
                            mediaUrl

                    })

                ),

                ...images.map(

                    mediaUrl => ({

                        type:
                            'image',

                        url:
                            mediaUrl

                    })

                )

            ]
                .slice(
                    0,
                    10
                )


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


                    enviados++


                    await new Promise(

                        resolve =>
                            setTimeout(
                                resolve,
                                1500
                            )

                    )


                } catch (mediaErr) {

                    logger.warn(

                        `Error enviando media Instagram: ${mediaErr.message}`

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


        } catch (err) {

            logger.error(

                `Error instagram: ${err.stack || err.message}`

            )


            if (
                err.response
            ) {

                logger.error(

                    `Instagram API status: ${err.response.status}`

                )


                logger.error(

                    `Instagram API response: ${
                        JSON.stringify(
                            err.response.data
                        )
                    }`

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

                await sendInstagramMessage(

                    sock,

                    from,

                    ui.error(

                        'ERROR DE INSTAGRAM',

                        'No se pudo completar la descarga del contenido.'

                    )

                )

            } catch {}

        }

    }

}
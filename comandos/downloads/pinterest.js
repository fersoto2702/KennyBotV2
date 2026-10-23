const axios =
    require('axios')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


const PINTEREST_API =
    'https://api.scrapeatlas.com/v1/pinterest/search'


async function sendPinterestMessage(
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


function getPinImage(pin) {

    if (!pin?.images)
        return null


    if (
        pin.images.orig?.url
    ) {

        return pin.images.orig.url

    }

    const candidates =
        Object.values(
            pin.images
        )


    for (
        const image of candidates
    ) {

        if (
            image &&
            typeof image === 'object' &&
            image.url
        ) {

            return image.url

        }

    }


    return null

}


function shuffle(array) {

    const result =
        [...array]


    for (
        let i = result.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            )


        ;[
            result[i],
            result[j]
        ] = [
            result[j],
            result[i]
        ]

    }


    return result

}


module.exports = {

    name:
        'pinterest',

    aliases: [
        'pin'
    ],

    description:
        'Busca imágenes de Pinterest',

    category:
        'descargas',


    async execute({

        sock,
        from,
        args

    }) {

        try {

            const query =
                args
                    .join(' ')
                    .trim()


            if (!query) {

                return await sendPinterestMessage(

                    sock,

                    from,

                    ui.warn(

                        'BÚSQUEDA REQUERIDA',

                        'Escribe lo que quieres buscar en Pinterest.\n\nUso: /pinterest búsqueda'

                    )

                )

            }

            const apiKey =
                process.env.SCRAPEATLAS_API_KEY


            if (!apiKey) {

                logger.error(
                    'SCRAPEATLAS_API_KEY no configurada.'
                )


                return await sendPinterestMessage(

                    sock,

                    from,

                    ui.error(

                        'PINTEREST NO CONFIGURADO',

                        'La API de Pinterest no está configurada en el bot.'

                    )

                )

            }

            await sendPinterestMessage(

                sock,

                from,

                ui.info(

                    '📌 PINTEREST',

                    [

                        [
                            'Búsqueda',
                            query
                        ],

                        [
                            'Estado',
                            'BUSCANDO'
                        ]

                    ],

                    'Buscando imágenes relacionadas...'

                )

            )

            const response =
                await axios.get(

                    PINTEREST_API,

                    {

                        params: {

                            query,

                            trim:
                                'true'

                        },

                        headers: {

                            'x-api-key':
                                apiKey,

                            'User-Agent':
                                'KennyBot/2.0'

                        },

                        timeout:
                            60000

                    }

                )


            const data =
                response.data


            logger.info(

                `Pinterest API status: ${data?.status || 'unknown'}`

            )

            if (
                !data ||
                data.success !== true ||
                (
                    data.status !== 'success' &&
                    data.status !== 'partial'
                )
            ) {

                const reason =

                    data?.failure?.message ||

                    'Pinterest no devolvió resultados válidos.'


                return await sendPinterestMessage(

                    sock,

                    from,

                    ui.error(

                        'BÚSQUEDA FALLIDA',

                        reason

                    )

                )

            }


            const pins =
                Array.isArray(
                    data.pins
                )
                    ? data.pins
                    : []

            const usablePins =

                pins
                    .map(pin => ({

                        pin,

                        image:
                            getPinImage(
                                pin
                            )

                    }))
                    .filter(
                        item =>
                            Boolean(
                                item.image
                            )
                    )


            if (
                usablePins.length === 0
            ) {

                return await sendPinterestMessage(

                    sock,

                    from,

                    ui.error(

                        'SIN RESULTADOS',

                        'No se encontraron imágenes disponibles para esa búsqueda.'

                    )

                )

            }

            const selected =
                shuffle(
                    usablePins
                )
                    .slice(
                        0,
                        5
                    )

            let enviados = 0


            for (
                let i = 0;
                i < selected.length;
                i++
            ) {

                const {
                    pin,
                    image
                } =
                    selected[i]


                try {

                    const fields = [

                        [
                            'Búsqueda',
                            query
                        ],

                        [
                            'Resultado',
                            `${i + 1}/${selected.length}`
                        ]

                    ]


                    if (
                        pin.title
                    ) {

                        fields.push(

                            [
                                'Título',
                                pin.title
                            ]

                        )

                    }


                    await sock.sendMessage(

                        from,

                        {

                            image: {

                                url:
                                    image

                            },

                            caption:
                                ui.success(

                                    '📌 PINTEREST',

                                    fields,

                                    'Imagen encontrada correctamente.'

                                )

                        }

                    )


                    enviados++

                    if (
                        i <
                        selected.length - 1
                    ) {

                        await new Promise(

                            resolve =>
                                setTimeout(
                                    resolve,
                                    1200
                                )

                        )

                    }


                } catch (imgErr) {

                    logger.warn(

                        `Error enviando imagen Pinterest: ${imgErr.message}`

                    )

                }

            }

            if (
                enviados === 0
            ) {

                return await sendPinterestMessage(

                    sock,

                    from,

                    ui.error(

                        'ERROR DE ENVÍO',

                        'Se encontraron imágenes, pero WhatsApp no pudo recibirlas.'

                    )

                )

            }

            await sendPinterestMessage(

                sock,

                from,

                ui.success(

                    'BÚSQUEDA COMPLETADA',

                    [

                        [
                            'Consulta',
                            query
                        ],

                        [
                            'Imágenes enviadas',
                            `${enviados}`
                        ],

                        [
                            'Estado',
                            'COMPLETADO'
                        ]

                    ],

                    'Pinterest terminó la búsqueda correctamente.'

                )

            )


            logger.event(

                `Pinterest: "${query}" | ${enviados} imágenes`

            )


        } catch (err) {

            logger.error(

                `Error pinterest: ${err.stack || err.message}`

            )


            if (
                err.response
            ) {

                logger.error(

                    `Pinterest API status: ${err.response.status}`

                )

                logger.error(

                    `Pinterest API response: ${
                        JSON.stringify(
                            err.response.data
                        )
                    }`

                )

            }


            let message =
                'No se pudieron obtener imágenes de Pinterest.'


            if (
                err.response?.status === 401
            ) {

                message =
                    'La API key de Pinterest no es válida.'

            }


            else if (
                err.response?.status === 429
            ) {

                message =
                    'Pinterest está limitando temporalmente las búsquedas. Inténtalo más tarde.'

            }


            else if (
                err.response?.status === 502 ||
                err.response?.status === 504
            ) {

                message =
                    'Pinterest no respondió correctamente. Inténtalo nuevamente.'

            }


            await sendPinterestMessage(

                sock,

                from,

                ui.error(

                    'ERROR DE PINTEREST',

                    message

                )

            )

        }

    }

}
const logger =
    require('../../src/utils/logger')

const fs =
    require('fs')

const path =
    require('path')

const ui =
    require('../../src/utils/ui')

const pinterest =
    require('pinterest-scraper')

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

module.exports = {

    name: 'pinterest',

    aliases: [

        'pin'

    ],

    description:
        'Busca imágenes reales de Pinterest',

    category:
        'descargas',

    async execute({

        sock,
        from,
        args

    }) {

        try {

            const query =
                args.join(' ')

            if (!query) {

                return await sendPinterestMessage(
    sock,
    from,
    ui.warn(
        'BÚSQUEDA REQUERIDA',
        'Uso: /pinterest búsqueda'
    )
)

            }

            await sendPinterestMessage(
    sock,
    from,
    ui.info(
        'BUSCANDO',
        [
            ['Pinterest', query]
        ]
    )
)

            const results =
                await pinterest(query)

            if (

                !results ||

                results.length === 0

            ) {

                return await sendPinterestMessage(
    sock,
    from,
    ui.error(
        'SIN RESULTADOS',
        'No se encontraron imágenes.'
    )
)

            }

            const images =
                results
                .sort(() => 0.5 - Math.random())
                .slice(0, 5)

            for (const img of images) {

                await sendPinterestMessage(
    sock,
    from,
    ui.success(
        'BÚSQUEDA COMPLETADA',
        [
            ['Imágenes', `${images.length}`],
            ['Consulta', query]
        ]
    )
)

                try {

                    await sock.sendMessage(

                        from,

                        {

                            image: {

                                url: img

                            },

                            caption:
                                ui.success(

                                    'PINTEREST',

                                    [

                                        ['Búsqueda', query]

                                    ]

                                )

                        }

                    )

                } catch (imgErr) {

                    logger.warn(
                        `Error enviando imagen: ${imgErr.message}`
                    )

                }

            }

        } catch (err) {

            logger.error(
                `Error pinterest: ${err.message}`
            )

            await sendPinterestMessage(
    sock,
    from,
    ui.error(
        'ERROR',
        'No se pudo obtener imágenes.'
    )
)
        }

    }

}
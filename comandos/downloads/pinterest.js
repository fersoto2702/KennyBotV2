const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const pinterest =
    require('pinterest-scraper')

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

            // =========================
            // QUERY
            // =========================

            const query =
                args.join(' ')

            if (!query) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(
                                'BÚSQUEDA REQUERIDA',
                                'Uso: /pinterest búsqueda'
                            )

                    }

                )

            }

            // =========================
            // LOADING
            // =========================

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.info(

                            'BUSCANDO',

                            [

                                ['Pinterest', query]

                            ]

                        )

                }

            )

            // =========================
            // SEARCH
            // =========================

            const results =
                await pinterest(query)

            // =========================
            // VALIDAR
            // =========================

            if (

                !results ||

                results.length === 0

            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(
                                'SIN RESULTADOS',
                                'No se encontraron imágenes.'
                            )

                    }

                )

            }

            // =========================
            // RANDOM
            // =========================

            const images =
                results
                .sort(() => 0.5 - Math.random())
                .slice(0, 5)

            // =========================
            // SEND
            // =========================

            for (const img of images) {

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

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.error(
                            'ERROR',
                            'No se pudo obtener imágenes.'
                        )

                }

            )

        }

    }

}
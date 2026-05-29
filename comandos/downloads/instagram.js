const axios =
    require('axios')

const {
    checkCooldown
} = require('../../src/utils/cooldowns')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

module.exports = {

    name: 'instagram',

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

            const sender =
                msg.key.participant ||
                msg.key.remoteJid

            const cooldown =
                checkCooldown(
                    sender,
                    'instagram',
                    10
                )

            if (cooldown.active) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(
                                'COOLDOWN ACTIVO',
                                `Espera ${cooldown.left}s antes de usar este comando.`
                            )

                    }

                )

            }

            const url =
                args[0]

            if (

                !url ||

                !url.includes('instagram.com')

            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(
                                'URL INVÁLIDA',
                                'Uso: /instagram link'
                            )

                    }

                )

            }

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.info(

                            'DESCARGANDO',

                            [

                                ['Fuente', 'Instagram']

                            ]

                        )

                }

            )

            const response =
                await axios.get(

                    `https://api.vreden.my.id/api/igdl?url=${encodeURIComponent(url)}`,

                    {

                        timeout: 30000,

                        headers: {

                            'User-Agent':
                                'Mozilla/5.0'

                        }

                    }

                )

            const data =
                response.data

            if (

                !data ||

                !data.result ||

                !data.result.media ||

                !data.result.media.length

            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(
                                'DESCARGA FALLIDA',
                                'No se pudo obtener el contenido.'
                            )

                    }

                )

            }

            const limitedMedia =
                data.result.media.slice(0, 10)

            for (const media of limitedMedia) {

                try {

                    if (
                        media.type === 'video'
                    ) {

                        await sock.sendMessage(

                            from,

                            {

                                video: {

                                    url:
                                        media.url

                                },

                                mimetype:
                                    'video/mp4',

                                caption:
                                    ui.success(

                                        'INSTAGRAM',

                                        [

                                            ['Tipo', 'Video']

                                        ]

                                    )

                            }

                        )

                    }

                    else {

                        await sock.sendMessage(

                            from,

                            {

                                image: {

                                    url:
                                        media.url

                                },

                                caption:
                                    ui.success(

                                        'INSTAGRAM',

                                        [

                                            ['Tipo', 'Imagen']

                                        ]

                                    )

                            }

                        )

                    }

                    await new Promise(resolve =>

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

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            'DESCARGA COMPLETADA',

                            [

                                ['Archivos', `${limitedMedia.length}`],

                                ['Estado', 'Enviado']

                            ]

                        )

                }

            )

        } catch (err) {

            logger.error(
                `Error instagram: ${err.message}`
            )

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.error(
                            'ERROR',
                            'No se pudo descargar el contenido de Instagram.'
                        )

                }

            )

        }

    }

}
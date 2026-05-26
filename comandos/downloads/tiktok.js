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

    name: 'tiktok',

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
        args,
        msg

    }) {

        try {

            const sender =
                msg.key.participant ||
                msg.key.remoteJid

            // =========================
            // COOLDOWN
            // =========================

            const cooldown =
                checkCooldown(
                    sender,
                    'tiktok',
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

            // =========================
            // URL
            // =========================

            const url =
                args[0]

            if (

                !url ||

                !url.includes('tiktok.com')

            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(
                                'URL INVÁLIDA',
                                'Uso: /tiktok link'
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

                            'DESCARGANDO',

                            [

                                ['Fuente', 'TikTok']

                            ]

                        )

                }

            )

            // =========================
            // API
            // =========================

            const response =
                await axios.get(

                    `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`,

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

            // =========================
            // VALIDAR
            // =========================

            if (

                !data ||

                !data.video ||

                !data.video.noWatermark

            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(
                                'DESCARGA FALLIDA',
                                'No se pudo obtener el video.'
                            )

                    }

                )

            }

            // =========================
            // INFO
            // =========================

            const author =
                data.author?.name ||
                'Desconocido'

            const title =
                data.title ||
                'Sin título'

            const likes =
                data.stats?.likeCount
                ?.toLocaleString() ||

                '0'

            // =========================
            // SEND VIDEO
            // =========================

            await sock.sendMessage(

                from,

                {

                    video: {

                        url:
                            data.video.noWatermark

                    },

                    mimetype:
                        'video/mp4',

                    caption:
                        ui.success(

                            'TIKTOK',

                            [

                                ['Autor', author],

                                ['Título', title],

                                ['Likes', likes]

                            ]

                        )

                }

            )

            // =========================
            // AUDIO
            // =========================

            if (data.music) {

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

                            ptt: false

                        }

                    )

                } catch (audioErr) {

                    logger.warn(
                        `Audio TikTok falló: ${audioErr.message}`
                    )

                }

            }

        } catch (err) {

            logger.error(
                `Error tiktok: ${err.message}`
            )

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.error(
                            'ERROR',
                            'No se pudo descargar el video de TikTok.'
                        )

                }

            )

        }

    }

}
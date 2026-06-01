const axios =
    require('axios')

const fs =
    require('fs')

const path =
    require('path')

const {
    checkCooldown
} = require('../../src/utils/cooldowns')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const iconPath =
    path.join(
        __dirname,
        '../../assets/icons/tiktok.jpeg'
    )

async function sendTikTokMessage(
    sock,
    from,
    caption
) {

    if (fs.existsSync(iconPath)) {

        return await sock.sendMessage(
            from,
            {
                image: {
                    url: iconPath
                },
                caption
            }
        )

    }

    return await sock.sendMessage(
        from,
        {
            text: caption
        }
    )

}

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

            const cooldown =
                checkCooldown(
                    sender,
                    'tiktok',
                    10
                )

            if (cooldown.active) {

                return await sendTikTokMessage(
    sock,
    from,
    ui.warn(
        'COOLDOWN ACTIVO',
        `Espera ${cooldown.left}s antes de usar este comando.`
    )
)

            }

            const url =
                args[0]

            if (

                !url ||

                !url.includes('tiktok.com')

            ) {

                return await sendTikTokMessage(
    sock,
    from,
    ui.warn(
        'URL INVÁLIDA',
        'Uso: /tiktok link'
    )
)

            }

            await sendTikTokMessage(
    sock,
    from,
    ui.info(
        'DESCARGANDO',
        [
            ['Fuente', 'TikTok']
        ]
    )
)

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

            if (

                !data ||

                !data.video ||

                !data.video.noWatermark

            ) {

                return await sendTikTokMessage(
    sock,
    from,
    ui.error(
        'DESCARGA FALLIDA',
        'No se pudo obtener el video.'
    )
)

            }

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

            await sendTikTokMessage(
    sock,
    from,
    ui.success(
        'DESCARGA COMPLETADA',
        [
            ['Autor', author],
            ['Título', title],
            ['Likes', likes]
        ]
    )
)

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

            await sendTikTokMessage(
    sock,
    from,
    ui.error(
        'ERROR',
        'No se pudo descargar el video de TikTok.'
    )
)

        }

    }

}
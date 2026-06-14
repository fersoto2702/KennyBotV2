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
    await axios.post(

        'https://www.tikwm.com/api/',

        {
            url
        },

        {

            timeout: 30000,

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

            if (

            !data ||

             data.code !== 0 ||

            !data.data?.play

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
    data.data.author?.nickname ||
    'Desconocido'

const title =
    data.data.title ||
    'Sin título'

const likes =
    Number(
        data.data.digg_count || 0
    ).toLocaleString()

            await sock.sendMessage(

                from,

                {

                    video: {

                        url:
                        data.data.play

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

            if (data.data.music) {

                try {

                    await sock.sendMessage(

                        from,

                        {

                            audio: {

                                url:
                                    data.data.music

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
        '❌ El servicio de descarga de TikTok se encuentra temporalmente fuera de servicio.',
    )
)

        }

    }

}
const fs =
    require('fs')

const path =
    require('path')

const axios =
    require('axios')

const {
    checkCooldown
} = require('../../src/utils/cooldowns')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

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

module.exports = {

    name: 'facebook',

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

            const sender =
                msg.key.participant ||
                msg.key.remoteJid

            const cooldown =
                checkCooldown(
                    sender,
                    'facebook',
                    10
                )

            if (cooldown.active) {

                return await sendFacebookMessage(
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

                (
                    !url.includes('facebook.com') &&
                    !url.includes('fb.watch')
                )

            ) {

                return await sendFacebookMessage(
    sock,
    from,
    ui.warn(
        'URL INVÁLIDA',
        'Uso: /facebook link'
    )
)

            }            const response =
                await axios.get(

                    `https://api.vreden.my.id/api/fbdl?url=${encodeURIComponent(url)}`,

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

                !data.result

            ) {

                return await sendFacebookMessage(
    sock,
    from,
    ui.error(
        'DESCARGA FALLIDA',
        'No se pudo obtener el video.'
    )
)

            }

            const videoUrl =

                data.result.hd ||

                data.result.sd ||

                data.result.url

            if (!videoUrl) {

                return await sendFacebookMessage(
    sock,
    from,
    ui.error(
        'VIDEO NO DISPONIBLE',
        'El video no está accesible.'
    )
)

            }

            await sock.sendMessage(

                from,

                {

                    video: {

                        url:
                            videoUrl

                    },

                    mimetype:
                        'video/mp4',

                    caption:
                        ui.success(

                            'FACEBOOK',

                            [

                                ['Estado', 'Descargado'],

                                ['Calidad', data.result.hd ? 'HD' : 'SD']

                            ]

                        )

                }

            )

        } catch (err) {

            logger.error(
                `Error facebook: ${err.message}`
            )

            await sendFacebookMessage(
    sock,
    from,
    ui.error(
        'ERROR',
        'No se pudo descargar el video de Facebook.'
    )
)

        }

    }

}
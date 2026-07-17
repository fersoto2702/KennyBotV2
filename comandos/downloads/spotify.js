const fs   = require('fs')
const path = require('path')

const {
    addToQueue,
    getQueueLength
} = require('../../src/utils/downloadQueue')

const {
    checkCooldown
} = require('../../src/utils/cooldowns')

const {
    isMediaTooLarge,
    getFileSizeMB
} = require('../../src/utils/antiCrash')

const generateTempFile =
    require('../../src/utils/generateTempFile')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const axios =
    require('axios')

const yts =
    require('yt-search')

const youtubedl =
    require('youtube-dl-exec')

async function sendSpotifyMessage(
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

    name: 'spotify',

    aliases: [

        'sp'

    ],

    description:
        'Descarga canciones de Spotify',

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
                    'spotify',
                    20
                )

            if (cooldown.active) {

                return await sendSpotifyMessage(
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

                !url.includes('spotify.com')

            ) {

                return await sendSpotifyMessage(
    sock,
    from,
    ui.warn(
        'URL INVÁLIDA',
        'Uso: /spotify link'
    )
)

            }

            await sendSpotifyMessage(
    sock,
    from,
    ui.info(
        'OBTENIENDO CANCIÓN',
        [
            ['Fuente', 'Spotify']
        ]
    )
)

            const response =
                await axios.get(

                    `https://api.vreden.my.id/api/spotify?url=${encodeURIComponent(url)}`,

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

            if (!data.result) {

                return await sendSpotifyMessage(
    sock,
    from,
    ui.error(
        'SIN INFORMACIÓN',
        'No se pudo obtener los datos de Spotify.'
    )
)

            }

            const title =
                `${data.result.title} ${data.result.artist}`

            await sendSpotifyMessage(
    sock,
    from,
    ui.info(
        'BUSCANDO AUDIO',
        [
            ['Canción', data.result.title]
        ]
    )
)

            const search =
                await yts(title)

            const video =

                search.videos.find(v =>

                    v.author?.name
                    ?.toLowerCase()
                    .includes('topic')

                )

                ||

                search.videos.find(v =>

                    v.title
                    .toLowerCase()
                    .includes('lyrics')

                )

                ||

                search.videos[0]

            if (!video) {

                return await sendSpotifyMessage(
    sock,
    from,
    ui.error(
        'SIN RESULTADOS',
        'No se encontró el audio.'
    )
)

            }

            const position =
                getQueueLength() + 1

            await sendSpotifyMessage(
    sock,
    from,
    ui.info(
        'COLA DE DESCARGA',
        [
            ['Canción', data.result.title],
            ['Artista', data.result.artist],
            ['Posición', `#${position}`]
        ]
    )
)

            const filePath =
                generateTempFile(
                    'temp',
                    'audio'
                )

            await addToQueue(

                async () => {

                    await youtubedl(

                        video.url,

                        {

                            format: 'bestaudio',

                            output:
                                `${filePath}.%(ext)s`,

                            noCheckCertificates: true,

                            noPlaylist: true

                        }

                    )

                }

            )

            await new Promise(resolve =>

                setTimeout(
                    resolve,
                    2000
                )

            )

            const files =
                fs.readdirSync(

                    path.join(
                        __dirname,
                        '../../temp'
                    )

                )

            const downloaded =
                files.find(f =>

                    f.startsWith(
                        path.basename(filePath)
                    )

                )

            if (!downloaded)
                throw new Error(
                    'Archivo no encontrado'
                )

            const finalPath =
                path.join(

                    __dirname,
                    '../../temp',
                    downloaded

                )

            const stats =
                fs.statSync(finalPath)

            if (

                isMediaTooLarge(
                    stats.size,
                    25
                )

            ) {

                fs.unlinkSync(finalPath)

                return await sendSpotifyMessage(
    sock,
    from,
    ui.error(
        'ARCHIVO MUY PESADO',
        `Peso: ${getFileSizeMB(stats.size)} MB`
    )
)

            }

            await sock.sendMessage(

                from,

                {

                    audio: {
                        url: finalPath
                    },

                    mimetype:
                        'audio/mp4',

                    ptt: false

                }

            )

            await sendSpotifyMessage(
    sock,
    from,
    ui.success(
        'SPOTIFY',
        [
            ['Título', data.result.title],
            ['Artista', data.result.artist]
        ]
    )
)
            setTimeout(() => {

                try {

                    if (
                        fs.existsSync(finalPath)
                    ) {

                        fs.unlinkSync(finalPath)

                        logger.info(
                            `Temp eliminado: ${downloaded}`
                        )

                    }

                } catch (e) {

                    logger.error(
                        `Error borrando temp: ${e.message}`
                    )

                }

            }, 15000)

        } catch (err) {

            logger.error(
                `Error spotify: ${err.message}`
            )

            await sendSpotifyMessage(
    sock,
    from,
    ui.error(
        'ERROR',
        'No se pudo descargar la canción.'
    )
)

        }

    }

}
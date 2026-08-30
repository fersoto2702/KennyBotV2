const fs   = require('fs')
const path = require('path')

const {
    isMediaTooLarge,
    getFileSizeMB
} = require('../../src/utils/antiCrash')

const {
    addToQueue,
    getQueueLength
} = require('../../src/utils/downloadQueue')

const {
    checkCooldown
} = require('../../src/utils/cooldowns')

const generateTempFile =
    require('../../src/utils/generateTempFile')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const yts =
    require('yt-search')

const youtubedl =
    require('youtube-dl-exec')

const iconPath =
    path.join(
        __dirname,
        '../../assets/icons/play.jpeg'
    )

async function sendPlayMessage(
    sock,
    from,
    text
) {
    return await sock.sendMessage(from, {
        text
    })
}

module.exports = {

    name: 'play',

    aliases: [

        'music'

    ],

    description:
        'Busca y descarga música de YouTube',

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
                    'play',
                    15
                )

            if (cooldown.active) {

                return await sendPlayMessage(
    sock,
    from,
    ui.warn(
        'COOLDOWN ACTIVO',
        `Espera ${cooldown.left}s antes de usar este comando.`
    )
)

            }

            const query =
                args.join(' ')

            if (!query) {

                return await sendPlayMessage(
    sock,
    from,
    ui.warn(
        'BÚSQUEDA REQUERIDA',
        'Uso: /play canción'
    )
)
            }

            await sendPlayMessage(
    sock,
    from,
    ui.info(
        'BUSCANDO',
        [
            ['Canción', query]
        ]
    )
)

            const search =
                await yts(query)

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

                return await sendPlayMessage(
    sock,
    from,
    ui.error(
        'SIN RESULTADOS',
        'No se encontró ninguna canción.'
    )
)

            }

            const position =
                getQueueLength() + 1

            await sendPlayMessage(
    sock,
    from,
    ui.info(
        'COLA DE DESCARGA',
        [
            ['Canción', video.title],
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

                            format: 'bestaudio/best',

                            output:
                                `${filePath}.%(ext)s`,

                            noCheckCertificates: true,

                            noPlaylist: true,

                            jsruntime: 'deno'

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

                return await sendPlayMessage(
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

            await sendPlayMessage(
    sock,
    from,
    ui.success(
        'DESCARGA COMPLETADA',
        [
            ['Título', video.title],
            ['Duración', video.timestamp],
            ['Vistas', Number(video.views).toLocaleString()],
            ['Link', video.url]
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
                `Error play: ${err.message}`
            )

            await sendPlayMessage(
    sock,
    from,
    ui.error(
        'ERROR',
        'No se pudo descargar la música.'
    )
)
        }

    }

}
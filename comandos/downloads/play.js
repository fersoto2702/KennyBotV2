const fs =
    require('fs')

const path =
    require('path')

const {
    spawn
} = require('child_process')

const {
    isMediaTooLarge,
    getFileSizeMB
} = require('../../src/utils/antiCrash')

const {
    addToQueue,
    getQueueLength
} = require('../../src/utils/downloadQueue')

const generateTempFile =
    require('../../src/utils/generateTempFile')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const yts =
    require('yt-search')


const ytDlpPath =
    path.join(
        __dirname,
        '../../node_modules/youtube-dl-exec/bin/yt-dlp.exe'
    )


async function sendPlayMessage(
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


function downloadWithYtDlp(
    url,
    output
) {

    return new Promise(
        (resolve, reject) => {

            if (
                !fs.existsSync(
                    ytDlpPath
                )
            ) {

                return reject(
                    new Error(
                        `No se encontró yt-dlp en: ${ytDlpPath}`
                    )
                )

            }


            const args = [

                '--js-runtimes',
                'deno',

                '--no-check-certificates',

                '--no-playlist',

                '-f',
                'bestaudio/best',

                '-x',

                '--audio-format',
                'mp3',

                '--audio-quality',
                '0',

                '-o',
                `${output}.mp3`,

                url

            ]


            logger.info(
                `yt-dlp iniciado: ${url}`
            )


            const process =
                spawn(
                    ytDlpPath,
                    args,
                    {
                        windowsHide: true
                    }
                )


            let stderr = ''

            let stdout = ''


            process.stdout.on(
                'data',
                data => {

                    const text =
                        data.toString()

                    stdout +=
                        text

                    logger.info(
                        text.trim()
                    )

                }
            )


            process.stderr.on(
                'data',
                data => {

                    const text =
                        data.toString()

                    stderr +=
                        text

                    logger.info(
                        text.trim()
                    )

                }
            )


            process.on(
                'error',
                err => {

                    reject(
                        err
                    )

                }
            )


            process.on(
                'close',
                code => {

                    if (
                        code !== 0
                    ) {

                        return reject(
                            new Error(
                                stderr ||
                                `yt-dlp terminó con código ${code}`
                            )
                        )

                    }


                    resolve({

                        stdout,

                        stderr

                    })

                }
            )

        }
    )

}


module.exports = {

    name:
        'play',

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


            const query =
                args.join(' ')


            if (
                !query
            ) {

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

                        [
                            'Canción',
                            query
                        ]

                    ]
                )

            )


            const search =
                await yts(
                    query
                )


            const video =

                search.videos.find(
                    v =>
                        v.author?.name
                            ?.toLowerCase()
                            .includes('topic')
                )

                ||

                search.videos.find(
                    v =>
                        v.title
                            ?.toLowerCase()
                            .includes('lyrics')
                )

                ||

                search.videos[0]


            if (
                !video
            ) {

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

                        [
                            'Canción',
                            video.title
                        ],

                        [
                            'Duración',
                            video.timestamp
                        ],

                        [
                            'Posición',
                            `#${position}`
                        ]

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

                    await downloadWithYtDlp(
                        video.url,
                        filePath
                    )

                }

            )


            const tempDirectory =
                path.join(
                    __dirname,
                    '../../temp'
                )


            const downloaded =
                `${path.basename(filePath)}.mp3`


            const finalPath =
                path.join(
                    tempDirectory,
                    downloaded
                )


            if (
                !fs.existsSync(
                    finalPath
                )
            ) {

                throw new Error(
                    'Archivo MP3 descargado no encontrado'
                )

            }


            const stats =
                fs.statSync(
                    finalPath
                )


            if (

                isMediaTooLarge(
                    stats.size,
                    25
                )

            ) {

                fs.unlinkSync(
                    finalPath
                )


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

                        url:
                            finalPath

                    },

                    mimetype:
                        'audio/mpeg',

                    ptt:
                        false

                }

            )


            await sendPlayMessage(

                sock,
                from,

                ui.success(
                    'DESCARGA COMPLETADA',
                    [

                        [
                            'Título',
                            video.title
                        ],

                        [
                            'Duración',
                            video.timestamp
                        ],

                        [
                            'Vistas',
                            Number(
                                video.views || 0
                            ).toLocaleString()
                        ],

                        [
                            'Formato',
                            'MP3'
                        ],

                        [
                            'Fuente',
                            'YouTube'
                        ]

                    ]
                )

            )


            setTimeout(

                () => {

                    try {

                        if (
                            fs.existsSync(
                                finalPath
                            )
                        ) {

                            fs.unlinkSync(
                                finalPath
                            )

                            logger.info(
                                `Temp eliminado: ${downloaded}`
                            )

                        }

                    } catch (e) {

                        logger.error(
                            `Error borrando temp: ${e.message}`
                        )

                    }

                },

                15000

            )


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
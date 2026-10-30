const fs =
    require('fs')

const path =
    require('path')

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

const youtubedl =
    require('youtube-dl-exec')


const TEMP_DIR =
    path.join(
        __dirname,
        '../../temp'
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


async function findDownloadedFile(
    filePath
) {

    const basename =
        path.basename(
            filePath
        )

    const files =
        await fs.promises.readdir(
            TEMP_DIR
        )

    const downloaded =
        files.find(
            file =>
                file.startsWith(
                    basename
                )
        )

    if (
        !downloaded
    ) {

        throw new Error(
            'Archivo no encontrado'
        )

    }

    return path.join(
        TEMP_DIR,
        downloaded
    )

}


async function removeTempFile(
    filePath
) {

    try {

        await fs.promises.unlink(
            filePath
        )

        logger.info(
            `Temp eliminado: ${path.basename(filePath)}`
        )

    } catch (err) {

        if (
            err?.code !==
            'ENOENT'
        ) {

            logger.warn(
                `No se pudo borrar temp: ${err.message}`
            )

        }

    }

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
        args

    }) {

        let finalPath =
            null

        try {

            const query =
                Array.isArray(
                    args
                )
                    ? args
                        .join(' ')
                        .trim()
                    : ''


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


            /*
             * La búsqueda comienza inmediatamente.
             * No esperamos a que WhatsApp termine de enviar
             * el mensaje "BUSCANDO" para iniciar yt-search.
             */
            const searchPromise =
                yts(
                    query
                )


            const searchingMessagePromise =
                sendPlayMessage(
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
                .catch(
                    () =>
                        null
                )


            const search =
                await searchPromise


            await searchingMessagePromise


            const videos =
                Array.isArray(
                    search?.videos
                )
                    ? search.videos
                    : []


            const video =
                videos.find(
                    item =>
                        item.author
                            ?.name
                            ?.toLowerCase()
                            .includes(
                                'topic'
                            )
                ) ||
                videos.find(
                    item =>
                        item.title
                            ?.toLowerCase()
                            .includes(
                                'lyrics'
                            )
                ) ||
                videos[0]


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
                getQueueLength() +
                1


            const filePath =
                generateTempFile(
                    'temp',
                    'audio'
                )


            /*
             * Entramos a la cola inmediatamente.
             * El mensaje informativo se manda en paralelo,
             * así la descarga puede comenzar sin esperar
             * otro round-trip de WhatsApp.
             */
            const downloadPromise =
                addToQueue(

                    async () => {

                        await youtubedl(
                            video.url,
                            {

                                format:
                                    'bestaudio',

                                output:
                                    `${filePath}.%(ext)s`,

                                noCheckCertificates:
                                    true,

                                noPlaylist:
                                    true,

                                noWarnings:
                                    true

                            }
                        )

                    }

                )


            const queueMessagePromise =
                sendPlayMessage(
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
                                'Posición',
                                `#${position}`
                            ]
                        ]
                    )
                )
                .catch(
                    () =>
                        null
                )


            await downloadPromise


            await queueMessagePromise


            /*
             * Ya no hay setTimeout de 2 segundos.
             * youtube-dl-exec resuelve cuando yt-dlp terminó,
             * así que buscamos el archivo inmediatamente.
             */
            finalPath =
                await findDownloadedFile(
                    filePath
                )


            const stats =
                await fs.promises.stat(
                    finalPath
                )


            if (
                isMediaTooLarge(
                    stats.size,
                    25
                )
            ) {

                const size =
                    getFileSizeMB(
                        stats.size
                    )


                await removeTempFile(
                    finalPath
                )


                finalPath =
                    null


                return await sendPlayMessage(
                    sock,
                    from,
                    ui.error(
                        'ARCHIVO MUY PESADO',
                        `Peso: ${size} MB`
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
                        'audio/mp4',

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
                            video.timestamp ||
                            'Desconocida'
                        ],
                        [
                            'Vistas',
                            Number(
                                video.views ||
                                0
                            )
                                .toLocaleString()
                        ],
                        [
                            'Link',
                            video.url
                        ]
                    ]
                )
            )


            /*
             * Limpieza sin bloquear la respuesta al usuario.
             */
            setTimeout(
                () => {

                    if (
                        finalPath
                    ) {

                        removeTempFile(
                            finalPath
                        )
                            .catch(
                                () => {}
                            )

                    }

                },
                5000
            )


            return true


        } catch (err) {

            logger.error(
                `Error play: ${err.stack || err.message}`
            )


            if (
                finalPath
            ) {

                removeTempFile(
                    finalPath
                )
                    .catch(
                        () => {}
                    )

            }


            try {

                await sendPlayMessage(
                    sock,
                    from,
                    ui.error(
                        'ERROR',
                        'No se pudo descargar la música.'
                    )
                )

            } catch {}


            return false

        }

    }

}
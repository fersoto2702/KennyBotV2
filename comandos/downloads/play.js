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


/* ─────────────────────────────
   CONFIGURACIÓN
───────────────────────────── */

const MAX_AUDIO_MB =
    25


function getYtDlpPath() {

    /*
        WINDOWS:
        usa el ejecutable incluido por
        youtube-dl-exec.

        LINUX / TERMUX:
        intenta usar yt-dlp instalado
        globalmente.
    */

    if (
        process.platform === 'win32'
    ) {

        return path.join(

            __dirname,

            '../../node_modules/youtube-dl-exec/bin/yt-dlp.exe'

        )

    }


    return 'yt-dlp'

}


/* ─────────────────────────────
   MENSAJES
───────────────────────────── */

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


/* ─────────────────────────────
   BORRAR ARCHIVO TEMPORAL
───────────────────────────── */

function removeTemp(filePath) {

    try {

        if (
            filePath &&
            fs.existsSync(filePath)
        ) {

            fs.unlinkSync(
                filePath
            )

            logger.info(

                `Temp eliminado: ${path.basename(filePath)}`

            )

        }

    } catch (err) {

        logger.warn(

            `No se pudo eliminar temp: ${err.message}`

        )

    }

}


/* ─────────────────────────────
   DESCARGAR CON YT-DLP
───────────────────────────── */

function downloadWithYtDlp(
    url,
    output
) {

    return new Promise(
        (resolve, reject) => {

            const ytDlpPath =
                getYtDlpPath()


            /*
                En Windows verificamos que
                realmente exista yt-dlp.exe.
            */

            if (
                process.platform === 'win32' &&
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


            const outputFile =
                `${output}.mp3`


            const args = [

                '--no-check-certificates',

                '--no-playlist',

                '--no-warnings',

                '-f',
                'bestaudio/best',

                '-x',

                '--audio-format',
                'mp3',

                '--audio-quality',
                '0',

                '-o',
                outputFile,

                url

            ]


            /*
                Deno solo se especifica si está
                disponible en tu instalación.

                Si ya te funcionaba correctamente,
                puedes volver a agregar:

                '--js-runtimes',
                'deno',
            */


            logger.info(

                `yt-dlp iniciado: ${url}`

            )


            const child =
                spawn(

                    ytDlpPath,

                    args,

                    {

                        windowsHide:
                            true

                    }

                )


            let stderr =
                ''

            let stdout =
                ''


            child.stdout.on(

                'data',

                data => {

                    const text =
                        data
                            .toString()
                            .trim()


                    stdout +=
                        text


                    if (text) {

                        logger.info(
                            text
                        )

                    }

                }

            )


            child.stderr.on(

                'data',

                data => {

                    const text =
                        data
                            .toString()
                            .trim()


                    stderr +=
                        text


                    if (text) {

                        logger.info(
                            text
                        )

                    }

                }

            )


            child.on(

                'error',

                err => {

                    reject(
                        err
                    )

                }

            )


            child.on(

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
                        stderr,
                        outputFile

                    })

                }

            )

        }
    )

}


/* ─────────────────────────────
   FORMATEAR VISTAS
───────────────────────────── */

function formatViews(value) {

    const number =
        Number(value || 0)


    if (
        Number.isNaN(number)
    ) {

        return '0'

    }


    return number.toLocaleString(
        'es-MX'
    )

}


/* ─────────────────────────────
   COMANDO
───────────────────────────── */

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

    cooldown:
        10,


    async execute({

        sock,
        from,
        args,
        msg

    }) {

        let finalPath =
            null


        try {

            /* ─────────────────────────────
               USUARIO
            ───────────────────────────── */

            const sender =

                msg.key.participant ||

                msg.key.remoteJid


            /* ─────────────────────────────
               BÚSQUEDA
            ───────────────────────────── */

            const query =
                args
                    .join(' ')
                    .trim()


            if (!query) {

                return await sendPlayMessage(

                    sock,

                    from,

                    ui.warn(

                        'BÚSQUEDA REQUERIDA',

                        'Escribe el nombre de una canción.\n\nUso: /play canción'

                    )

                )

            }


            await sendPlayMessage(

                sock,

                from,

                ui.info(

                    '🎵 MUSIC SEARCH',

                    [

                        [
                            'Canción',
                            query
                        ],

                        [
                            'Estado',
                            'BUSCANDO'
                        ]

                    ],

                    'Buscando la mejor coincidencia en YouTube...'

                )

            )


            /* ─────────────────────────────
               YOUTUBE SEARCH
            ───────────────────────────── */

            const search =
                await yts(
                    query
                )


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
                )

                ||

                videos.find(
                    item =>
                        item.title
                            ?.toLowerCase()
                            .includes(
                                'lyrics'
                            )
                )

                ||

                videos[0]


            if (!video) {

                return await sendPlayMessage(

                    sock,

                    from,

                    ui.error(

                        'SIN RESULTADOS',

                        'No se encontró ninguna canción relacionada.'

                    )

                )

            }


            /* ─────────────────────────────
               COLA
            ───────────────────────────── */

            const position =
                getQueueLength() + 1


            await sendPlayMessage(

                sock,

                from,

                ui.info(

                    '🎧 COLA DE DESCARGA',

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
                            'Posición',
                            `#${position}`
                        ]

                    ],

                    'La canción fue añadida a la cola.'

                )

            )


            /* ─────────────────────────────
               TEMP
            ───────────────────────────── */

            const filePath =
                generateTempFile(

                    'temp',

                    'audio'

                )


            /* ─────────────────────────────
               DESCARGAR
            ───────────────────────────── */

            const downloadResult =
                await addToQueue(

                    async () => {

                        return await downloadWithYtDlp(

                            video.url,

                            filePath

                        )

                    }

                )


            /*
                Preferimos la ruta devuelta
                directamente por yt-dlp.
            */

            finalPath =
                downloadResult?.outputFile ||


                path.join(

                    __dirname,

                    '../../temp',

                    `${path.basename(filePath)}.mp3`

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


            /* ─────────────────────────────
               PESO
            ───────────────────────────── */

            const stats =
                fs.statSync(
                    finalPath
                )


            if (
                isMediaTooLarge(

                    stats.size,

                    MAX_AUDIO_MB

                )
            ) {

                const size =
                    getFileSizeMB(
                        stats.size
                    )


                removeTemp(
                    finalPath
                )


                finalPath =
                    null


                return await sendPlayMessage(

                    sock,

                    from,

                    ui.error(

                        'ARCHIVO MUY PESADO',

                        `La canción pesa ${size} MB y supera el límite de ${MAX_AUDIO_MB} MB.`

                    )

                )

            }


            /* ─────────────────────────────
               ENVIAR AUDIO
            ───────────────────────────── */

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


            /* ─────────────────────────────
               RESULTADO
            ───────────────────────────── */

            await sendPlayMessage(

                sock,

                from,

                ui.success(

                    '🎵 MUSIC DOWNLOAD',

                    [

                        [
                            'Título',
                            video.title
                        ],

                        [
                            'Autor',
                            video.author?.name ||
                            'Desconocido'
                        ],

                        [
                            'Duración',
                            video.timestamp ||
                            'Desconocida'
                        ],

                        [
                            'Vistas',
                            formatViews(
                                video.views
                            )
                        ],

                        [
                            'Formato',
                            'MP3'
                        ],

                        [
                            'Fuente',
                            'YouTube'
                        ]

                    ],

                    'Canción descargada correctamente.'

                )

            )


            logger.event(

                `Play: "${video.title}" | ${sender?.split('@')[0] || 'desconocido'}`

            )


            /* ─────────────────────────────
               LIMPIEZA
            ───────────────────────────── */

            const pathToDelete =
                finalPath


            setTimeout(

                () => {

                    removeTemp(
                        pathToDelete
                    )

                },

                15000

            )


            finalPath =
                null


        } catch (err) {

            logger.error(

                `Error play: ${err.stack || err.message}`

            )


            /*
                Si falló después de descargar,
                eliminamos inmediatamente el temp.
            */

            if (
                finalPath
            ) {

                removeTemp(
                    finalPath
                )

            }


            let detail =
                'No se pudo descargar la música.'


            if (
                String(
                    err.message
                ).includes(
                    'yt-dlp'
                )
            ) {

                detail =
                    'Ocurrió un problema con el descargador de YouTube.'

            }


            try {

                await sendPlayMessage(

                    sock,

                    from,

                    ui.error(

                        'ERROR DE DESCARGA',

                        detail

                    )

                )

            } catch {}

        }

    }

}
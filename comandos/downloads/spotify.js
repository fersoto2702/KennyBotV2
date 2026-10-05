const fs =
    require('fs')

const axios =
    require('axios')

const yts =
    require('yt-search')

const youtubedl =
    require('youtube-dl-exec')

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


const SPOTIFY_API =
    'https://api.vreden.my.id/api/spotify'

const MAX_AUDIO_MB =
    25


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


function isSpotifyUrl(value = '') {

    try {

        const parsed =
            new URL(value)

        const host =
            parsed.hostname
                .toLowerCase()
                .replace(/^www\./, '')


        return (
            host === 'open.spotify.com' ||
            host === 'spotify.com' ||
            host.endsWith('.spotify.com')
        )

    } catch {

        return false

    }

}


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
                `Temp eliminado: ${filePath}`
            )

        }

    } catch (err) {

        logger.warn(
            `Error borrando temp: ${err.message}`
        )

    }

}


module.exports = {

    name:
        'spotify',

    aliases: [
        'sp'
    ],

    description:
        'Descarga canciones de Spotify en MP3',

    category:
        'descargas',

    cooldown:
        20,


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
               COOLDOWN
            ───────────────────────────── */

            const cooldown =
                checkCooldown(

                    sender,

                    'spotify',

                    20

                )


            if (
                cooldown.active
            ) {

                return await sendSpotifyMessage(

                    sock,

                    from,

                    ui.warn(

                        'COOLDOWN ACTIVO',

                        `Espera ${cooldown.left}s antes de volver a usar este comando.`

                    )

                )

            }


            /* ─────────────────────────────
               URL
            ───────────────────────────── */

            const url =
                String(
                    args?.[0] || ''
                )
                    .trim()


            if (
                !url ||
                !isSpotifyUrl(url)
            ) {

                return await sendSpotifyMessage(

                    sock,

                    from,

                    ui.warn(

                        'ENLACE REQUERIDO',

                        'Envía un enlace válido de Spotify.\n\nUso: /spotify link'

                    )

                )

            }


            /* ─────────────────────────────
               OBTENER INFORMACIÓN
            ───────────────────────────── */

            await sendSpotifyMessage(

                sock,

                from,

                ui.info(

                    '🎧 SPOTIFY',

                    [

                        [
                            'Fuente',
                            'Spotify'
                        ],

                        [
                            'Estado',
                            'OBTENIENDO INFORMACIÓN'
                        ]

                    ],

                    'Analizando la canción...'

                )

            )


            const response =
                await axios.get(

                    SPOTIFY_API,

                    {

                        params: {
                            url
                        },

                        timeout:
                            30000,

                        headers: {

                            'User-Agent':
                                'Mozilla/5.0'

                        }

                    }

                )


            const data =
                response.data


            logger.info(

                `Spotify API response: ${JSON.stringify(data)}`

            )


            if (
                !data ||
                !data.result
            ) {

                return await sendSpotifyMessage(

                    sock,

                    from,

                    ui.error(

                        'SIN INFORMACIÓN',

                        'No se pudieron obtener los datos de la canción.'

                    )

                )

            }


            const trackTitle =
                String(
                    data.result.title || ''
                )
                    .trim()


            const artist =
                String(
                    data.result.artist || ''
                )
                    .trim()


            if (!trackTitle) {

                return await sendSpotifyMessage(

                    sock,

                    from,

                    ui.error(

                        'DATOS INCOMPLETOS',

                        'Spotify no devolvió el título de la canción.'

                    )

                )

            }


            /* ─────────────────────────────
               BUSCAR AUDIO
            ───────────────────────────── */

            const searchQuery =

                artist
                    ? `${trackTitle} ${artist}`
                    : trackTitle


            await sendSpotifyMessage(

                sock,

                from,

                ui.info(

                    '🎵 BUSCANDO AUDIO',

                    [

                        [
                            'Título',
                            trackTitle
                        ],

                        [
                            'Artista',
                            artist ||
                            'Desconocido'
                        ]

                    ],

                    'Buscando la mejor coincidencia...'

                )

            )


            const search =
                await yts(
                    searchQuery
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

                return await sendSpotifyMessage(

                    sock,

                    from,

                    ui.error(

                        'SIN RESULTADOS',

                        'No se encontró una coincidencia para esa canción.'

                    )

                )

            }


            /* ─────────────────────────────
               COLA
            ───────────────────────────── */

            const position =
                getQueueLength() + 1


            await sendSpotifyMessage(

                sock,

                from,

                ui.info(

                    '🎶 COLA DE DESCARGA',

                    [

                        [
                            'Canción',
                            trackTitle
                        ],

                        [
                            'Artista',
                            artist ||
                            'Desconocido'
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
               ARCHIVO TEMPORAL
            ───────────────────────────── */

            const filePath =
                generateTempFile(

                    'temp',

                    'audio'

                )


            finalPath =
                `${filePath}.mp3`


            /* ─────────────────────────────
               DESCARGAR Y CONVERTIR A MP3
            ───────────────────────────── */

            await addToQueue(

                async () => {

                    await youtubedl(

                        video.url,

                        {

                            format:
                                'bestaudio/best',

                            extractAudio:
                                true,

                            audioFormat:
                                'mp3',

                            audioQuality:
                                0,

                            output:
                                finalPath,

                            noCheckCertificates:
                                true,

                            noPlaylist:
                                true

                        }

                    )

                }

            )


            /* ─────────────────────────────
               VERIFICAR ARCHIVO
            ───────────────────────────── */

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
               TAMAÑO
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


                return await sendSpotifyMessage(

                    sock,

                    from,

                    ui.error(

                        'ARCHIVO MUY PESADO',

                        `La canción pesa ${size} MB y supera el límite de ${MAX_AUDIO_MB} MB.`

                    )

                )

            }


            /* ─────────────────────────────
               ENVIAR MP3
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

            await sendSpotifyMessage(

                sock,

                from,

                ui.success(

                    '🎧 SPOTIFY DOWNLOAD',

                    [

                        [
                            'Título',
                            trackTitle
                        ],

                        [
                            'Artista',
                            artist ||
                            'Desconocido'
                        ],

                        [
                            'Duración',
                            video.timestamp ||
                            'Desconocida'
                        ],

                        [
                            'Formato',
                            'MP3'
                        ],

                        [
                            'Fuente',
                            'Spotify'
                        ]

                    ],

                    'Canción descargada correctamente.'

                )

            )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Spotify: "${trackTitle}" - ${artist || 'Desconocido'} | MP3 | ${sender?.split('@')[0] || 'desconocido'}`

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

                `Error spotify: ${err.stack || err.message}`

            )


            if (
                err.response
            ) {

                logger.error(

                    `Spotify API status: ${err.response.status}`

                )

                logger.error(

                    `Spotify API response: ${JSON.stringify(err.response.data)}`

                )

            }


            if (
                finalPath
            ) {

                removeTemp(
                    finalPath
                )

            }


            let detail =
                'No se pudo descargar la canción.'


            if (
                String(
                    err.message
                )
                    .toLowerCase()
                    .includes(
                        'ffmpeg'
                    )
            ) {

                detail =
                    'No se pudo convertir el audio a MP3. Verifica que FFmpeg esté instalado.'

            }


            try {

                await sendSpotifyMessage(

                    sock,

                    from,

                    ui.error(

                        'ERROR DE SPOTIFY',

                        detail

                    )

                )

            } catch {}

        }

    }

}
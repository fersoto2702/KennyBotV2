const fs =
    require('fs')

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

const youtubedl =
    require('youtube-dl-exec')


const MAX_VIDEO_MB =
    80


async function sendYtmp4Message(
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


function isYouTubeUrl(value = '') {

    try {

        const parsed =
            new URL(value)

        const host =
            parsed.hostname
                .toLowerCase()
                .replace(/^www\./, '')

        return (
            host === 'youtube.com' ||
            host.endsWith('.youtube.com') ||
            host === 'youtu.be'
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
        'ytmp4',

    aliases: [
        'ytv'
    ],

    description:
        'Descarga videos de YouTube en MP4',

    category:
        'descargas',

    cooldown:
        30,


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

                    'ytmp4',

                    30

                )


            if (
                cooldown.active
            ) {

                return await sendYtmp4Message(

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
                !isYouTubeUrl(url)
            ) {

                return await sendYtmp4Message(

                    sock,

                    from,

                    ui.warn(

                        'ENLACE REQUERIDO',

                        'Envía un enlace válido de YouTube.\n\nUso: /ytmp4 link'

                    )

                )

            }


            /* ─────────────────────────────
               COLA
            ───────────────────────────── */

            const position =
                getQueueLength() + 1


            await sendYtmp4Message(

                sock,

                from,

                ui.info(

                    '🎬 YOUTUBE VIDEO',

                    [

                        [
                            'Formato',
                            'MP4'
                        ],

                        [
                            'Posición',
                            `#${position}`
                        ],

                        [
                            'Estado',
                            'EN COLA'
                        ]

                    ],

                    'El video será procesado en la mejor calidad compatible.'

                )

            )


            /* ─────────────────────────────
               ARCHIVO TEMPORAL
            ───────────────────────────── */

            const filePath =
                generateTempFile(

                    'temp',

                    'video'

                )


            finalPath =
                `${filePath}.mp4`


            /* ─────────────────────────────
               DESCARGAR VIDEO
            ───────────────────────────── */

            await addToQueue(

                async () => {

                    await youtubedl(

                        url,

                        {

                            /*
                                Priorizamos MP4 + M4A para
                                evitar conversiones innecesarias.

                                Si no existe esa combinación,
                                usa la mejor alternativa.
                            */

                            format:
                                'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',

                            mergeOutputFormat:
                                'mp4',

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
                    'Archivo MP4 descargado no encontrado'
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

                    MAX_VIDEO_MB

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


                return await sendYtmp4Message(

                    sock,

                    from,

                    ui.error(

                        'ARCHIVO MUY PESADO',

                        `El video pesa ${size} MB y supera el límite de ${MAX_VIDEO_MB} MB.`

                    )

                )

            }


            /* ─────────────────────────────
               ENVIAR VIDEO
            ───────────────────────────── */

            await sock.sendMessage(

                from,

                {

                    video: {

                        url:
                            finalPath

                    },

                    mimetype:
                        'video/mp4',

                    caption:
                        ui.success(

                            '🎬 YOUTUBE VIDEO',

                            [

                                [
                                    'Formato',
                                    'MP4'
                                ],

                                [
                                    'Estado',
                                    'COMPLETADO'
                                ],

                                [
                                    'Peso',
                                    `${getFileSizeMB(stats.size)} MB`
                                ]

                            ],

                            'Video descargado correctamente.'

                        )

                }

            )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `YTMP4 descargado por ${sender?.split('@')[0] || 'desconocido'} | ${getFileSizeMB(stats.size)} MB`

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

                `Error ytmp4: ${err.stack || err.message}`

            )


            if (
                finalPath
            ) {

                removeTemp(
                    finalPath
                )

            }


            let detail =
                'No se pudo descargar el video.'


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
                    'No se pudo combinar el video y el audio. Verifica que FFmpeg esté instalado.'

            }


            try {

                await sendYtmp4Message(

                    sock,

                    from,

                    ui.error(

                        'ERROR YTMP4',

                        detail

                    )

                )

            } catch {}

        }

    }

}
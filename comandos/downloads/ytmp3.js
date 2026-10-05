const fs =
    require('fs')

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

const youtubedl =
    require('youtube-dl-exec')


const MAX_AUDIO_MB =
    25


async function sendYtmp3Message(
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
        'ytmp3',

    aliases: [
        'yta'
    ],

    description:
        'Descarga audio de YouTube en MP3',

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

                    'ytmp3',

                    20

                )


            if (
                cooldown.active
            ) {

                return await sendYtmp3Message(

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

                return await sendYtmp3Message(

                    sock,

                    from,

                    ui.warn(

                        'ENLACE REQUERIDO',

                        'Envía un enlace válido de YouTube.\n\nUso: /ytmp3 link'

                    )

                )

            }


            /* ─────────────────────────────
               COLA
            ───────────────────────────── */

            const position =
                getQueueLength() + 1


            await sendYtmp3Message(

                sock,

                from,

                ui.info(

                    '🎵 YOUTUBE MP3',

                    [

                        [
                            'Formato',
                            'MP3'
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

                    'El audio será procesado en la mejor calidad disponible.'

                )

            )


            /* ─────────────────────────────
               TEMPORAL
            ───────────────────────────── */

            const filePath =
                generateTempFile(

                    'temp',

                    'audio'

                )


            finalPath =
                `${filePath}.mp3`


            /* ─────────────────────────────
               DESCARGAR + CONVERTIR
            ───────────────────────────── */

            await addToQueue(

                async () => {

                    await youtubedl(

                        url,

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


                return await sendYtmp3Message(

                    sock,

                    from,

                    ui.error(

                        'ARCHIVO MUY PESADO',

                        `El audio pesa ${size} MB y supera el límite de ${MAX_AUDIO_MB} MB.`

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

            await sendYtmp3Message(

                sock,

                from,

                ui.success(

                    '🎧 YOUTUBE MP3',

                    [

                        [
                            'Formato',
                            'MP3'
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

                    'Audio descargado correctamente.'

                )

            )


            logger.event(

                `YTMP3 descargado por ${sender?.split('@')[0] || 'desconocido'} | ${getFileSizeMB(stats.size)} MB`

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

                `Error ytmp3: ${err.stack || err.message}`

            )


            if (
                finalPath
            ) {

                removeTemp(
                    finalPath
                )

            }


            let detail =
                'No se pudo descargar el audio.'


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

                await sendYtmp3Message(

                    sock,

                    from,

                    ui.error(

                        'ERROR YTMP3',

                        detail

                    )

                )

            } catch {}

        }

    }

}
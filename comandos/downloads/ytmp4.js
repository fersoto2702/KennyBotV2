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

const youtubedl =
    require('youtube-dl-exec')

module.exports = {

    name: 'ytmp4',

    aliases: [

        'ytv'

    ],

    description:
        'Descarga videos de YouTube',

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

            // =========================
            // COOLDOWN
            // =========================

            const cooldown =
                checkCooldown(
                    sender,
                    'ytmp4',
                    30
                )

            if (cooldown.active) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(
                                'COOLDOWN ACTIVO',
                                `Espera ${cooldown.left}s antes de usar este comando.`
                            )

                    }

                )

            }

            // =========================
            // URL
            // =========================

            const url =
                args[0]

            if (

                !url ||

                (
                    !url.includes('youtube.com') &&
                    !url.includes('youtu.be')
                )

            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(
                                'URL INVÁLIDA',
                                'Uso: /ytmp4 link'
                            )

                    }

                )

            }

            // =========================
            // QUEUE
            // =========================

            const position =
                getQueueLength() + 1

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.info(

                            'COLA DE DESCARGA',

                            [

                                ['Formato', 'Video'],

                                ['Posición', `#${position}`]

                            ]

                        )

                }

            )

            // =========================
            // FILE
            // =========================

            const filePath =
                generateTempFile(
                    'temp',
                    'video'
                )

            // =========================
            // DOWNLOAD
            // =========================

            await addToQueue(

                async () => {

                    await youtubedl(

                        url,

                        {

                            format:
                                'bestvideo+bestaudio/best',

                            output:
                                `${filePath}.%(ext)s`,

                            noCheckCertificates: true,

                            noPlaylist: true

                        }

                    )

                }

            )

            // =========================
            // WAIT
            // =========================

            await new Promise(resolve =>

                setTimeout(
                    resolve,
                    3000
                )

            )

            // =========================
            // FIND FILE
            // =========================

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

            // =========================
            // STATS
            // =========================

            const stats =
                fs.statSync(finalPath)

            // =========================
            // ANTI CRASH
            // =========================

            if (

                isMediaTooLarge(
                    stats.size,
                    80
                )

            ) {

                fs.unlinkSync(finalPath)

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(
                                'ARCHIVO MUY PESADO',
                                `Peso: ${getFileSizeMB(stats.size)} MB`
                            )

                    }

                )

            }

            // =========================
            // SEND
            // =========================

            await sock.sendMessage(

                from,

                {

                    video: {
                        url: finalPath
                    },

                    mimetype:
                        'video/mp4',

                    caption:
                        ui.success(

                            'VIDEO ENVIADO',

                            [

                                ['Formato', 'Video'],

                                ['Estado', 'Completado']

                            ]

                        )

                }

            )

            // =========================
            // DELETE TEMP
            // =========================

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
                `Error ytmp4: ${err.message}`
            )

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.error(
                            'ERROR',
                            'No se pudo descargar el video.'
                        )

                }

            )

        }

    }

}
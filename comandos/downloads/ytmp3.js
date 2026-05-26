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

const youtubedl =
    require('youtube-dl-exec')

module.exports = {

    name: 'ytmp3',

    aliases: [

        'yta'

    ],

    description:
        'Descarga audio de YouTube',

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
                    'ytmp3',
                    20
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
                                'Uso: /ytmp3 link'
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

                                ['Formato', 'Audio'],

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
                    'audio'
                )

            // =========================
            // DOWNLOAD
            // =========================

            await addToQueue(

                async () => {

                    await youtubedl(

                        url,

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

            // =========================
            // WAIT
            // =========================

            await new Promise(resolve =>

                setTimeout(
                    resolve,
                    2000
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
                    25
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

                    audio: {
                        url: finalPath
                    },

                    mimetype:
                        'audio/mp4',

                    ptt: false

                }

            )

            // =========================
            // INFO
            // =========================

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            'AUDIO ENVIADO',

                            [

                                ['Formato', 'Audio'],

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
                `Error ytmp3: ${err.message}`
            )

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.error(
                            'ERROR',
                            'No se pudo descargar el audio.'
                        )

                }

            )

        }

    }

}
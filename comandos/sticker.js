const fs =
    require('fs')

const path =
    require('path')

const jimp =
    require('jimp')

const {

    downloadMediaMessage

} = require('@whiskeysockets/baileys')

const {

    isMediaTooLarge

} = require('../src/utils/antiCrash')

const generateTempFile =
    require('../src/utils/generateTempFile')

const logger =
    require('../src/utils/logger')

const ui =
    require('../src/utils/ui')

const {

    isLimited,
    getRemainingTime

} = require('../src/system/rateLimiter')

// =========================
// CONFIG
// =========================

const MAX_MEDIA_MB = 20

const MAX_VIDEO_SECONDS = 10

// =========================
// SAFE DELETE
// =========================

const safeDelete = file => {

    try {

        if (
            fs.existsSync(file)
        ) {

            fs.unlinkSync(file)

        }

    } catch {}

}

// =========================
// EXPORT
// =========================

module.exports = {

    name:
        'sticker',

    aliases: [

        's',
        'stiker',
        'stick'

    ],

    description:
        'Convierte imágenes o videos en stickers',

    category:
        'general',

    cooldown: 5,

    async execute({

        sock,
        msg,
        from

    }) {

        let outputPath = null

        try {

            // =========================
            // USER
            // =========================

            const sender =

                msg.key.participant ||

                msg.key.remoteJid

            // =========================
            // RATE LIMIT
            // =========================

            if (

                isLimited(
                    sender,
                    'stickers'
                )

            ) {

                const left =

                    getRemainingTime(

                        sender,
                        'stickers'

                    )

                return await sock.safeSendMessage(

                    from,

                    {

                        text:

                            ui.warn(

                                'RATE LIMIT',

                                `Demasiados stickers.\n\nEspera ${left}s.`

                            )

                    }

                )

            }

            // =========================
            // TYPING
            // =========================

            try {

                await sock.sendPresenceUpdate(

                    'composing',
                    from

                )

            } catch {}

            // =========================
            // QUOTED
            // =========================

            const quoted =

                msg.message
                    ?.extendedTextMessage
                    ?.contextInfo
                    ?.quotedMessage

            const imageMessage =

                quoted?.imageMessage ||

                msg.message?.imageMessage

            const videoMessage =

                quoted?.videoMessage ||

                msg.message?.videoMessage

            // =========================
            // VALIDATE
            // =========================

            if (

                !imageMessage &&
                !videoMessage

            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:

                            ui.warn(

                                'MEDIA REQUERIDA',

                                'Responde una imagen o video con /sticker'

                            )

                    }

                )

            }

            // =========================
            // VIDEO LIMIT
            // =========================

            if (

                videoMessage?.seconds >
                MAX_VIDEO_SECONDS

            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:

                            ui.error(

                                'VIDEO DEMASIADO LARGO',

                                `Máximo ${MAX_VIDEO_SECONDS} segundos.`

                            )

                    }

                )

            }

            // =========================
            // DOWNLOAD
            // =========================

            const mediaMessage =

                imageMessage

                    ? { imageMessage }

                    : { videoMessage }

            const buffer =

                await downloadMediaMessage(

                    {

                        message:
                            mediaMessage

                    },

                    'buffer',

                    {},

                    {

                        logger: {

                            info: () => {},
                            warn: () => {},
                            error: () => {}

                        },

                        reuploadRequest:
                            sock.updateMediaMessage

                    }

                )

            // =========================
            // VALID BUFFER
            // =========================

            if (
                !buffer ||
                !Buffer.isBuffer(buffer)
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:

                            ui.error(

                                'ERROR',

                                'No se pudo descargar el archivo.'

                            )

                    }

                )

            }

            // =========================
            // SIZE LIMIT
            // =========================

            if (

                isMediaTooLarge(

                    buffer.length,
                    MAX_MEDIA_MB

                )

            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:

                            ui.error(

                                'ARCHIVO DEMASIADO PESADO',

                                `Máximo ${MAX_MEDIA_MB}MB.`

                            )

                    }

                )

            }

            // =========================
            // TEMP
            // =========================

            const tempDir =

                path.join(

                    __dirname,

                    '../../temp'

                )

            if (
                !fs.existsSync(tempDir)
            ) {

                fs.mkdirSync(

                    tempDir,

                    {

                        recursive: true

                    }

                )

            }

            outputPath =

                generateTempFile(

                    'temp',
                    'webp'

                )

            // =========================
            // IMAGE
            // =========================

            if (imageMessage) {

                await jimp(buffer)

                    .resize(

                        512,
                        512,

                        {

                            fit: 'contain',

                            background: {

                                r: 0,
                                g: 0,
                                b: 0,
                                alpha: 0

                            }

                        }

                    )

                    .webp({

                        quality: 80,

                        effort: 4

                    })

                    .toFile(
                        outputPath
                    )

            }

            // =========================
            // VIDEO
            // =========================

            else {

                fs.writeFileSync(

                    outputPath,
                    buffer

                )

            }

            // =========================
            // CHECK
            // =========================

            if (

                !fs.existsSync(
                    outputPath
                )

            ) {

                throw new Error(
                    'Sticker no generado'
                )

            }

            // =========================
            // SEND
            // =========================

            await sock.safeSendMessage(

                from,

                {

                    sticker:

                        fs.readFileSync(
                            outputPath
                        )

                }

            )

            logger.event(

                `Sticker enviado → ${sender.split('@')[0]}`

            )

        } catch (err) {

            logger.error(

                `Error sticker: ${err.message}`

            )

            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:

                            ui.error(

                                'ERROR',

                                'No se pudo crear el sticker.'

                            )

                    }

                )

            } catch {}

        } finally {

            // =========================
            // CLEANUP
            // =========================

            if (outputPath) {

                setTimeout(() => {

                    safeDelete(
                        outputPath
                    )

                }, 5000)

            }

        }

    }

}

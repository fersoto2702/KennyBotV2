const fs =
    require('fs')

const path =
    require('path')

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

const MAX_MEDIA_MB = 20

const MAX_VIDEO_SECONDS = 10

const safeDelete = file => {

    try {

        if (fs.existsSync(file)) {
            fs.unlinkSync(file)
        }

    } catch {}

}

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

            const sender =
                msg.key.participant ||
                msg.key.remoteJid

            if (isLimited(sender, 'stickers')) {

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

            try {
                await sock.sendPresenceUpdate(
                    'composing',
                    from
                )
            } catch {}

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

            if (!imageMessage && !videoMessage) {

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

            if (videoMessage?.seconds > MAX_VIDEO_SECONDS) {

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

            const mediaMessage =
                imageMessage
                    ? { imageMessage }
                    : { videoMessage }

            const buffer =
                await downloadMediaMessage(
                    {
                        message: mediaMessage
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

            if (!buffer || !Buffer.isBuffer(buffer)) {

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

            if (isMediaTooLarge(buffer.length, MAX_MEDIA_MB)) {

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

            const tempDir =
                path.join(
                    __dirname,
                    '../../temp'
                )

            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(
                    tempDir,
                    { recursive: true }
                )
            }

            outputPath =
                generateTempFile(
                    'temp',
                    'webp'
                )

            if (imageMessage) {

               const sharp =
    require('sharp')

await sharp(buffer)
    .resize(512, 512, {
        fit: 'inside'
    })
    .webp({
        quality: 100
    })
    .toFile(outputPath)

            } else {

                fs.writeFileSync(outputPath, buffer)

            }

            if (!fs.existsSync(outputPath)) {
                throw new Error('Sticker no generado')
            }

            await sock.safeSendMessage(
                from,
                {
                    sticker:
                        fs.readFileSync(outputPath)
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

            if (outputPath) {

                setTimeout(() => {
                    safeDelete(outputPath)
                }, 5000)

            }

        }

    }

}
const fs =
    require('fs')

const path =
    require('path')

const {
    execFile
} = require('child_process')

const {
    promisify
} = require('util')

const {
    downloadMediaMessage
} = require('@whiskeysockets/baileys')

const sharp =
    require('sharp')

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


const execFileAsync =
    promisify(
        execFile
    )


const MAX_MEDIA_MB =
    20

const MAX_VIDEO_SECONDS =
    10


/*
    Puedes definir:

    FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe

    Si no existe la variable, intentará
    utilizar "ffmpeg" desde el PATH.
*/

const FFMPEG_PATH =
    process.env.FFMPEG_PATH ||
    'ffmpeg'


function normalizeJid(
    jid
) {

    if (!jid) {

        return null

    }


    return String(jid)
        .trim()
        .replace(
            /:\d+@/,
            '@'
        )

}


function getNumber(
    jid
) {

    return String(
        jid || ''
    )
        .split('@')[0]
        .split(':')[0]

}


function safeDelete(
    file
) {

    try {

        if (
            file &&
            fs.existsSync(
                file
            )
        ) {

            fs.unlinkSync(
                file
            )

        }

    } catch {}

}


function ensureTempDirectory(
    file
) {

    const directory =
        path.dirname(
            file
        )


    if (
        !fs.existsSync(
            directory
        )
    ) {

        fs.mkdirSync(
            directory,
            {
                recursive: true
            }
        )

    }

}


function getQuotedMessage(
    msg
) {

    return (

        msg.message
            ?.extendedTextMessage
            ?.contextInfo
            ?.quotedMessage

        ||

        msg.message
            ?.imageMessage
            ?.contextInfo
            ?.quotedMessage

        ||

        msg.message
            ?.videoMessage
            ?.contextInfo
            ?.quotedMessage

        ||

        null

    )

}


function getMediaMessage(
    msg
) {

    const quoted =
        getQuotedMessage(
            msg
        )


    const imageMessage =

        quoted?.imageMessage ||

        msg.message?.imageMessage ||

        null


    const videoMessage =

        quoted?.videoMessage ||

        msg.message?.videoMessage ||

        null


    if (
        imageMessage
    ) {

        return {

            type:
                'image',

            content:
                imageMessage,

            message: {
                imageMessage
            }

        }

    }


    if (
        videoMessage
    ) {

        return {

            type:
                'video',

            content:
                videoMessage,

            message: {
                videoMessage
            }

        }

    }


    return null

}


async function convertImageToSticker(
    buffer,
    outputPath
) {

    await sharp(
        buffer
    )
        .rotate()
        .resize(
            512,
            512,
            {
                fit:
                    'contain',

                background: {
                    r: 0,
                    g: 0,
                    b: 0,
                    alpha: 0
                },

                withoutEnlargement:
                    true
            }
        )
        .webp(
            {
                quality:
                    90,

                alphaQuality:
                    100,

                effort:
                    6
            }
        )
        .toFile(
            outputPath
        )

}


async function convertVideoToSticker(
    inputPath,
    outputPath
) {

    const filter = [

        'fps=15',

        'scale=512:512:force_original_aspect_ratio=decrease',

        'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000'

    ]
        .join(',')


    await execFileAsync(

        FFMPEG_PATH,

        [

            '-y',

            '-i',
            inputPath,

            '-t',
            String(
                MAX_VIDEO_SECONDS
            ),

            '-vf',
            filter,

            '-an',

            '-vcodec',
            'libwebp',

            '-lossless',
            '0',

            '-compression_level',
            '6',

            '-q:v',
            '70',

            '-loop',
            '0',

            '-vsync',
            '0',

            outputPath

        ],

        {
            windowsHide:
                true,

            maxBuffer:
                10 * 1024 * 1024
        }

    )

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

    cooldown:
        5,


    async execute({

        sock,
        msg,
        from

    }) {

        let inputPath =
            null

        let outputPath =
            null


        try {

            /* ─────────────────────────────
               USUARIO
            ───────────────────────────── */

            const sender =
                normalizeJid(

                    msg.key?.participant ||

                    msg.participant ||

                    msg.key?.remoteJid

                )


            if (!sender) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE USUARIO',

                                'No pude identificar al usuario.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               RATE LIMIT
            ───────────────────────────── */

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


            /* ─────────────────────────────
               PRESENCIA
            ───────────────────────────── */

            try {

                await sock.sendPresenceUpdate(

                    'composing',

                    from

                )

            } catch {}


            /* ─────────────────────────────
               MEDIA
            ───────────────────────────── */

            const media =
                getMediaMessage(
                    msg
                )


            if (!media) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'MEDIA REQUERIDA',

                                [
                                    'Envía o responde a una imagen o video.',
                                    '',
                                    'Uso:',
                                    '/sticker',
                                    '',
                                    `Videos: máximo ${MAX_VIDEO_SECONDS} segundos.`
                                ].join('\n')

                            )

                    }

                )

            }


            /* ─────────────────────────────
               DURACIÓN DEL VIDEO
            ───────────────────────────── */

            if (
                media.type === 'video'
            ) {

                const seconds =
                    Number(
                        media.content?.seconds
                    ) || 0


                if (
                    seconds >
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

            }


            /* ─────────────────────────────
               DESCARGAR
            ───────────────────────────── */

            const buffer =
                await downloadMediaMessage(

                    {
                        message:
                            media.message
                    },

                    'buffer',

                    {},

                    {

                        logger: {

                            info:
                                () => {},

                            warn:
                                () => {},

                            error:
                                () => {}

                        },

                        reuploadRequest:
                            sock.updateMediaMessage

                    }

                )


            if (
                !buffer ||
                !Buffer.isBuffer(
                    buffer
                )
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE DESCARGA',

                                'No se pudo descargar el archivo.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               PESO
            ───────────────────────────── */

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

                                `Máximo ${MAX_MEDIA_MB} MB.`

                            )

                    }

                )

            }


            /* ─────────────────────────────
               ARCHIVO DE SALIDA
            ───────────────────────────── */

            outputPath =
                generateTempFile(

                    'sticker',

                    'webp'

                )


            ensureTempDirectory(
                outputPath
            )


            /* ─────────────────────────────
               IMAGEN
            ───────────────────────────── */

            if (
                media.type === 'image'
            ) {

                await convertImageToSticker(

                    buffer,

                    outputPath

                )

            }


            /* ─────────────────────────────
               VIDEO
            ───────────────────────────── */

            else {

                inputPath =
                    generateTempFile(

                        'sticker-video',

                        'mp4'

                    )


                ensureTempDirectory(
                    inputPath
                )


                fs.writeFileSync(

                    inputPath,

                    buffer

                )


                await convertVideoToSticker(

                    inputPath,

                    outputPath

                )

            }


            /* ─────────────────────────────
               VALIDAR RESULTADO
            ───────────────────────────── */

            if (
                !fs.existsSync(
                    outputPath
                )
            ) {

                throw new Error(
                    'Sticker no generado'
                )

            }


            const stats =
                fs.statSync(
                    outputPath
                )


            if (
                !stats.size
            ) {

                throw new Error(
                    'El sticker generado está vacío'
                )

            }


            /* ─────────────────────────────
               ENVIAR
            ───────────────────────────── */

            await sock.safeSendMessage(

                from,

                {

                    sticker:
                        fs.readFileSync(
                            outputPath
                        )

                }

            )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Sticker enviado: ${getNumber(sender)} | tipo=${media.type} | entrada=${(buffer.length / 1024 / 1024).toFixed(2)}MB | salida=${(stats.size / 1024).toFixed(2)}KB`

            )


        } catch (err) {

            logger.error(

                `Error sticker: ${err.stack || err.message}`

            )


            let message =
                'No se pudo crear el sticker.'


            if (
                err.code ===
                'ENOENT' &&
                String(
                    err.message || ''
                )
                    .toLowerCase()
                    .includes(
                        'ffmpeg'
                    )
            ) {

                message =
                    'No se encontró FFmpeg para convertir el video en sticker.'

            }


            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE STICKER',

                                message

                            )

                    }

                )

            } catch {}


        } finally {

            /* ─────────────────────────────
               LIMPIEZA
            ───────────────────────────── */

            safeDelete(
                inputPath
            )


            safeDelete(
                outputPath
            )


            try {

                await sock.sendPresenceUpdate(

                    'paused',

                    from

                )

            } catch {}

        }

    }

}
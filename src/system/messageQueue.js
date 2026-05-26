const logger =
    require('../utils/logger')

// =========================
// QUEUES
// =========================

const textQueue  = []
const mediaQueue = []

let processingText  = false
let processingMedia = false

// =========================
// CONFIG
// =========================

const TEXT_DELAY  = 350
const MEDIA_DELAY = 1200

const MAX_RETRIES = 3

// =========================
// WAIT
// =========================

const wait = ms =>

    new Promise(

        resolve =>

            setTimeout(
                resolve,
                ms
            )

    )

// =========================
// IS MEDIA
// =========================

const isMediaMessage = content => {

    return (

        content.image ||
        content.video ||
        content.audio ||
        content.document ||
        content.sticker

    )

}

// =========================
// PROCESS TEXT
// =========================

const processTextQueue = async () => {

    if (
        processingText ||
        textQueue.length === 0
    ) return

    processingText = true

    const item =
        textQueue.shift()

    try {

        await item.task()

        item.resolve()

    } catch (err) {

        logger.error(

            `TextQueue Error: ${err.message}`

        )

        item.reject(err)

    }

    await wait(TEXT_DELAY)

    processingText = false

    processTextQueue()

}

// =========================
// PROCESS MEDIA
// =========================

const processMediaQueue = async () => {

    if (
        processingMedia ||
        mediaQueue.length === 0
    ) return

    processingMedia = true

    const item =
        mediaQueue.shift()

    try {

        await item.task()

        item.resolve()

    } catch (err) {

        logger.error(

            `MediaQueue Error: ${err.message}`

        )

        item.reject(err)

    }

    await wait(MEDIA_DELAY)

    processingMedia = false

    processMediaQueue()

}

// =========================
// ADD
// =========================

const addToQueue = (

    task,
    type = 'text'

) => {

    return new Promise(

        (resolve, reject) => {

            const item = {

                task,
                resolve,
                reject,

                retries: 0

            }

            if (type === 'media') {

                mediaQueue.push(item)

                processMediaQueue()

            } else {

                textQueue.push(item)

                processTextQueue()

            }

        }

    )

}

// =========================
// PATCH SOCKET
// =========================

const patchSocket = sock => {

    sock.safeSendMessage = async (

        jid,
        content,
        options = {}

    ) => {

        const type =

            isMediaMessage(content)

                ? 'media'

                : 'text'

        return addToQueue(

            async () => {

                let attempts = 0

                while (

                    attempts < MAX_RETRIES

                ) {

                    try {

                        return await sock.sendMessage(

                            jid,
                            content,
                            options

                        )

                    } catch (err) {

                        attempts++

                        logger.warn(

                            `Retry ${attempts}/${MAX_RETRIES}`

                        )

                        if (

                            attempts >= MAX_RETRIES

                        ) {

                            throw err

                        }

                        await wait(1000)

                    }

                }

            },

            type

        )

    }

    logger.success(
        'MessageQueue cargada'
    )

}

// =========================
// STATS
// =========================

const getQueueStats = () => {

    return {

        text:
            textQueue.length,

        media:
            mediaQueue.length,

        processingText,

        processingMedia

    }

}

module.exports = {

    patchSocket,

    getQueueStats

}
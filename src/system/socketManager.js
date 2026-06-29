const logger =
    require('../utils/logger')

const queue = []

let processing =
    false

const CONFIG = {
    delay: 100,
    retries: 3,
    retryDelay: 2000,
    burstLimit: 20,
    burstDelay: 500
}

let burstCount =
    0

let lastBurstReset =
    Date.now()

const sleep = ms =>
    new Promise(
        resolve =>
            setTimeout(resolve, ms)
    )

async function checkBurst() {

    const now =
        Date.now()

    if (now - lastBurstReset > 10000) {
        burstCount = 0
        lastBurstReset = now
    }

    burstCount++

    if (burstCount >= CONFIG.burstLimit) {

        logger.warn('Burst protection activado')

        await sleep(CONFIG.burstDelay)

        burstCount = 0

    }

}

async function processQueue() {

    if (processing) return
    if (queue.length === 0) return

    processing = true

    const item =
        queue.shift()

    try {

        await checkBurst()

        let lastError =
            null

        for (let i = 0; i < CONFIG.retries; i++) {

            try {

                const result =
                    await item.task()

                item.resolve(result)

                lastError = null

                break

            } catch (err) {

                lastError = err

                logger.warn(
                    `Retry ${i + 1}/${CONFIG.retries}: ${err.message}`
                )

                await sleep(CONFIG.retryDelay)

            }

        }

        if (lastError) {
            item.reject(lastError)
        }

    } catch (err) {

        item.reject(err)

        logger.error(
            `Queue Error: ${err.message}`
        )

    }

    await sleep(CONFIG.delay)

    processing = false

    processQueue()

}

function enqueue(task) {

    return new Promise(
        (resolve, reject) => {

            queue.push({
                task,
                resolve,
                reject
            })

            processQueue()

        }
    )

}

function patchSocket(sock) {

    sock.safeSendMessage = async (jid, content, options = {}) => {

    if (
        content &&
        content.image &&
        content.caption
    ) {

        content = {
            text: content.caption
        }

    }

    return enqueue(
        async () =>
            sock.sendMessage(jid, content, options)
    )

}

    sock.safeDeleteMessage = async (jid, key) => {

        return enqueue(
            async () =>
                sock.sendMessage(jid, { delete: key })
        )

    }

    sock.safeGroupUpdate = async (jid, users, action) => {

        return enqueue(
            async () =>
                sock.groupParticipantsUpdate(jid, users, action)
        )

    }

    sock.safeTyping = async jid => {

        try {

            return enqueue(
                async () =>
                    sock.sendPresenceUpdate('composing', jid)
            )

        } catch {}

    }

    sock.queueStats = () => ({
        queue: queue.length,
        processing,
        burstCount
    })

    logger.success('SocketManager cargado')

    return sock

}

module.exports = {
    patchSocket,
    enqueue
}
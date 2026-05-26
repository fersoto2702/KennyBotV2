const logger =
    require('../utils/logger')

// =========================
// QUEUE
// =========================

const queue = []

let processing =
    false

// =========================
// CONFIG
// =========================

const CONFIG = {

    delay: 800,

    retries: 3,

    retryDelay: 2000,

    burstLimit: 5,

    burstDelay: 4000

}

// =========================
// BURST CONTROL
// =========================

let burstCount =
    0

let lastBurstReset =
    Date.now()

// =========================
// SLEEP
// =========================

const sleep = ms =>

    new Promise(

        resolve =>

            setTimeout(
                resolve,
                ms
            )

    )

// =========================
// BURST CHECK
// =========================

async function checkBurst() {

    const now =
        Date.now()

    // =========================
    // RESET
    // =========================

    if (

        now - lastBurstReset >
        10000

    ) {

        burstCount = 0

        lastBurstReset = now

    }

    burstCount++

    // =========================
    // LIMIT
    // =========================

    if (

        burstCount >=
        CONFIG.burstLimit

    ) {

        logger.warn(
            'Burst protection activado'
        )

        await sleep(
            CONFIG.burstDelay
        )

        burstCount = 0
    }

}

// =========================
// PROCESS
// =========================

async function processQueue() {

    if (processing)
        return

    if (queue.length === 0)
        return

    processing = true

    const item =
        queue.shift()

    try {

        await checkBurst()

        let lastError =
            null

        // =========================
        // RETRIES
        // =========================

        for (

            let i = 0;

            i < CONFIG.retries;

            i++

        ) {

            try {

                const result =

                    await item.task()

                item.resolve(
                    result
                )

                lastError = null

                break

            } catch (err) {

                lastError = err

                logger.warn(

                    `Retry ${i + 1}/${CONFIG.retries}: ${err.message}`

                )

                await sleep(
                    CONFIG.retryDelay
                )

            }

        }

        // =========================
        // FAILED
        // =========================

        if (lastError) {

            item.reject(
                lastError
            )

        }

    } catch (err) {

        item.reject(err)

        logger.error(

            `Queue Error: ${err.message}`

        )

    }

    // =========================
    // DELAY
    // =========================

    await sleep(
        CONFIG.delay
    )

    processing = false

    processQueue()

}

// =========================
// ADD
// =========================

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

// =========================
// PATCH SOCKET
// =========================

function patchSocket(sock) {

    // =========================
    // SAFE SEND
    // =========================

    sock.safeSendMessage = async (

        jid,
        content,
        options = {}

    ) => {

        return enqueue(

            async () =>

                sock.sendMessage(

                    jid,

                    content,

                    options

                )

        )

    }

    // =========================
    // SAFE DELETE
    // =========================

    sock.safeDeleteMessage = async (

        jid,
        key

    ) => {

        return enqueue(

            async () =>

                sock.sendMessage(

                    jid,

                    {

                        delete: key

                    }

                )

        )

    }

    // =========================
    // SAFE GROUP UPDATE
    // =========================

    sock.safeGroupUpdate = async (

        jid,
        users,
        action

    ) => {

        return enqueue(

            async () =>

                sock.groupParticipantsUpdate(

                    jid,

                    users,

                    action

                )

        )

    }

    // =========================
    // SAFE PRESENCE
    // =========================

    sock.safeTyping = async jid => {

        try {

            return enqueue(

                async () =>

                    sock.sendPresenceUpdate(

                        'composing',

                        jid

                    )

            )

        } catch {}

    }

    // =========================
    // STATS
    // =========================

    sock.queueStats = () => ({

        queue:
            queue.length,

        processing,

        burstCount

    })

    logger.success(
        'SocketManager cargado'
    )

    return sock

}

// =========================
// EXPORT
// =========================

module.exports = {

    patchSocket,

    enqueue

}
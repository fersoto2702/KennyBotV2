const logger =
    require('../utils/logger')

const socketStates =
    new WeakMap()

const CONFIG = {

    delay:
        100,

    retries:
        3,

    retryDelay:
        2000,

    burstLimit:
        20,

    burstDelay:
        500,

    burstWindow:
        10000

}

const sleep =
    ms =>
        new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    ms
                )
        )

function getBotName(
    sock
) {

    return String(
        sock?.botProfile?.name ||
        'KennyBot'
    )
        .trim()

}

function getState(
    sock
) {

    if (
        !sock ||
        (
            typeof sock !==
            'object' &&
            typeof sock !==
            'function'
        )
    ) {

        throw new Error(
            'Socket inválido'
        )

    }

    if (
        !socketStates.has(
            sock
        )
    ) {

        socketStates.set(
            sock,
            {

                queue:
                    [],

                processing:
                    false,

                burstCount:
                    0,

                lastBurstReset:
                    Date.now(),

                closed:
                    false

            }
        )

    }

    return socketStates.get(
        sock
    )

}

async function checkBurst(
    sock
) {

    const state =
        getState(
            sock
        )

    const now =
        Date.now()

    if (
        now -
        state.lastBurstReset >
        CONFIG.burstWindow
    ) {

        state.burstCount =
            0

        state.lastBurstReset =
            now

    }

    state.burstCount++

    if (
        state.burstCount >=
        CONFIG.burstLimit
    ) {

        logger.warn(
            `${getBotName(sock)} | Burst protection activado`
        )

        await sleep(
            CONFIG.burstDelay
        )

        state.burstCount =
            0

        state.lastBurstReset =
            Date.now()

    }

}

async function processQueue(
    sock
) {

    const state =
        getState(
            sock
        )

    if (
        state.processing
    ) {

        return

    }

    if (
        state.closed
    ) {

        return

    }

    if (
        state.queue.length ===
        0
    ) {

        return

    }

    state.processing =
        true

    try {

        while (
            state.queue.length >
            0 &&
            !state.closed
        ) {

            const item =
                state.queue.shift()

            if (
                !item
            ) {

                continue

            }

            try {

                await checkBurst(
                    sock
                )

                let result =
                    null

                let lastError =
                    null

                for (
                    let attempt = 1;
                    attempt <= CONFIG.retries;
                    attempt++
                ) {

                    try {

                        result =
                            await item.task()

                        lastError =
                            null

                        break

                    } catch (err) {

                        lastError =
                            err

                        logger.warn(
                            `${getBotName(sock)} | Retry ${attempt}/${CONFIG.retries}: ${err.stack || err.message}`
                        )

                        if (
                            attempt <
                            CONFIG.retries
                        ) {

                            await sleep(
                                CONFIG.retryDelay
                            )

                        }

                    }

                }

                if (
                    lastError
                ) {

                    item.reject(
                        lastError
                    )

                } else {

                    item.resolve(
                        result
                    )

                }

            } catch (err) {

                item.reject(
                    err
                )

                logger.error(
                    `${getBotName(sock)} | Queue Error: ${err.stack || err.message}`
                )

            }

            if (
                state.queue.length >
                0 &&
                !state.closed
            ) {

                await sleep(
                    CONFIG.delay
                )

            }

        }

    } finally {

        state.processing =
            false

    }

}

function enqueue(
    sock,
    task
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            let state

            try {

                state =
                    getState(
                        sock
                    )

            } catch (err) {

                reject(
                    err
                )

                return

            }

            if (
                state.closed
            ) {

                reject(
                    new Error(
                        'SocketManager cerrado'
                    )
                )

                return

            }

            if (
                typeof task !==
                'function'
            ) {

                reject(
                    new TypeError(
                        'Queue task debe ser una función'
                    )
                )

                return

            }

            state.queue.push(
                {
                    task,
                    resolve,
                    reject
                }
            )

            processQueue(
                sock
            )
                .catch(
                    err => {

                        logger.error(
                            `${getBotName(sock)} | Process Queue Error: ${err.stack || err.message}`
                        )

                    }
                )

        }
    )

}

function clearQueue(
    sock
) {

    const state =
        socketStates.get(
            sock
        )

    if (
        !state
    ) {

        return 0

    }

    const removed =
        state.queue.length

    while (
        state.queue.length >
        0
    ) {

        const item =
            state.queue.shift()

        try {

            item?.reject(
                new Error(
                    'Cola cancelada'
                )
            )

        } catch {}

    }

    return removed

}

function closeQueue(
    sock
) {

    const state =
        socketStates.get(
            sock
        )

    if (
        !state
    ) {

        return false

    }

    state.closed =
        true

    clearQueue(
        sock
    )

    return true

}

function patchSocket(
    sock
) {

    if (
        !sock
    ) {

        throw new Error(
            'patchSocket requiere un socket'
        )

    }

    if (
        sock.__kennySocketPatched
    ) {

        return sock

    }

    Object.defineProperty(
        sock,
        '__kennySocketPatched',
        {

            value:
                true,

            configurable:
                false,

            enumerable:
                false,

            writable:
                false

        }
    )

    getState(
        sock
    )

    sock.safeSendMessage =
        async (
            jid,
            content,
            options = {}
        ) => {

            if (
                !jid
            ) {

                throw new Error(
                    'safeSendMessage requiere jid'
                )

            }

            if (
                !content ||
                typeof content !==
                'object'
            ) {

                throw new Error(
                    'safeSendMessage requiere content'
                )

            }

            return enqueue(
                sock,
                async () =>
                    sock.sendMessage(
                        jid,
                        content,
                        options
                    )
            )

        }

    sock.safeDeleteMessage =
        async (
            jid,
            key
        ) => {

            if (
                !jid ||
                !key
            ) {

                return null

            }

            return enqueue(
                sock,
                async () =>
                    sock.sendMessage(
                        jid,
                        {
                            delete:
                                key
                        }
                    )
            )

        }

    sock.safeGroupUpdate =
        async (
            jid,
            users,
            action
        ) => {

            if (
                !jid
            ) {

                throw new Error(
                    'safeGroupUpdate requiere jid'
                )

            }

            if (
                !Array.isArray(
                    users
                ) ||
                users.length ===
                0
            ) {

                throw new Error(
                    'safeGroupUpdate requiere usuarios'
                )

            }

            if (
                !action
            ) {

                throw new Error(
                    'safeGroupUpdate requiere action'
                )

            }

            return enqueue(
                sock,
                async () =>
                    sock.groupParticipantsUpdate(
                        jid,
                        users,
                        action
                    )
            )

        }

    sock.safeTyping =
        async jid => {

            if (
                !jid
            ) {

                return null

            }

            try {

                return await enqueue(
                    sock,
                    async () =>
                        sock.sendPresenceUpdate(
                            'composing',
                            jid
                        )
                )

            } catch {

                return null

            }

        }

    sock.safePaused =
        async jid => {

            if (
                !jid
            ) {

                return null

            }

            try {

                return await enqueue(
                    sock,
                    async () =>
                        sock.sendPresenceUpdate(
                            'paused',
                            jid
                        )
                )

            } catch {

                return null

            }

        }

    sock.queueStats =
        () => {

            const state =
                getState(
                    sock
                )

            return {

                queue:
                    state.queue.length,

                processing:
                    state.processing,

                burstCount:
                    state.burstCount,

                closed:
                    state.closed

            }

        }

    sock.clearQueue =
        () =>
            clearQueue(
                sock
            )

    sock.closeQueue =
        () =>
            closeQueue(
                sock
            )

    logger.success(
        `${getBotName(sock)} | SocketManager cargado`
    )

    return sock

}

module.exports = {

    patchSocket,

    enqueue,

    clearQueue,

    closeQueue

}
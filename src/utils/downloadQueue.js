const logger =
    require('./logger')

const queue =
    []

let processing =
    false

const TASK_TIMEOUT =
    1000 * 60 * 5

let completed =
    0

let failed =
    0

const withTimeout = promise =>

    Promise.race([

        promise,

        new Promise((_, reject) =>

            setTimeout(

                () => reject(
                    new Error('Task timeout')
                ),

                TASK_TIMEOUT

            )

        )

    ])

const processQueue = async () => {

    if (processing)
        return

    processing = true

    while (queue.length > 0) {

        const item =
            queue.shift()

        try {

            const result =
                await withTimeout(
                    item.task()
                )

            completed++

            item.resolve(result)

        } catch (err) {

            failed++

            logger.error(
                `Queue Error: ${err.message}`
            )

            item.reject(err)

        }

    }

    processing = false

}

const addToQueue = task =>

    new Promise((resolve, reject) => {

        queue.push({

            task,
            resolve,
            reject

        })

        processQueue()

    })

const getQueueLength = () =>
    queue.length

const getQueueStats = () => ({

    pending:
        queue.length,

    processing,

    completed,

    failed

})

module.exports = {

    addToQueue,

    getQueueLength,

    getQueueStats

}
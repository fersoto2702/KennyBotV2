const {
    prepareMissingAwardRewards
} = require(
    './awardDeliveryService'
)

const {
    processPendingRewardGrants
} = require(
    './rewardGrantService'
)


let running = false


async function runRewardMaintenance(
    options = {}
) {

    if (running) {

        return {
            processed: false,
            reason:
                'ALREADY_RUNNING'
        }
    }


    running = true


    try {

        const prepareLimit =
            Math.max(
                1,
                Math.min(
                    500,
                    Number(
                        options.prepareLimit
                    ) || 100
                )
            )


        const processLimit =
            Math.max(
                1,
                Math.min(
                    500,
                    Number(
                        options.processLimit
                    ) || 100
                )
            )


        const preparation =
            await prepareMissingAwardRewards(
                prepareLimit
            )


        const processing =
            await processPendingRewardGrants(
                processLimit
            )


        return {
            processed: true,
            reason:
                'COMPLETED',

            preparation,

            processing,

            summary: {
                awardsChecked:
                    preparation.checked || 0,

                awardsPrepared:
                    preparation.prepared || 0,

                preparationFailures:
                    preparation.failed || 0,

                grantsProcessed:
                    processing.processed || 0,

                rewardsDelivered:
                    processing.delivered || 0,

                processingFailures:
                    processing.failed || 0
            }
        }


    } catch (error) {

        return {
            processed: false,
            reason:
                'MAINTENANCE_ERROR',

            error:
                String(
                    error.message ||
                    error
                )
        }


    } finally {

        running = false
    }
}


module.exports = {
    runRewardMaintenance
}
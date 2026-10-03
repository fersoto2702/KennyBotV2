const {
    pool
} = require('../database/mysql')

const {
    syncEventStatuses
} = require('./eventService')

const {
    processPendingObjectiveRewardGrants
} = require('./objectiveRewardGrantService')

let running = false

async function expireMemberObjectives(
    conn = pool
) {

    const [result] =
        await conn.execute(
            `
            UPDATE kb_member_objectives

            SET
                status = 'EXPIRED',
                updated_at =
                    CURRENT_TIMESTAMP

            WHERE status = 'IN_PROGRESS'
              AND period_end IS NOT NULL
              AND period_end <= NOW()
            `
        )

    return Number(
        result.affectedRows || 0
    )
}

async function cancelDisabledObjectives(
    conn = pool
) {

    const [result] =
        await conn.execute(
            `
            UPDATE kb_member_objectives mo

            INNER JOIN kb_objectives o
                ON o.id =
                   mo.objective_id

            SET
                mo.status = 'CANCELLED',
                mo.updated_at =
                    CURRENT_TIMESTAMP

            WHERE mo.status = 'IN_PROGRESS'
              AND o.enabled = 0
            `
        )

    return Number(
        result.affectedRows || 0
    )
}

async function runObjectiveMaintenance(
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

        const rewardLimit =
            Math.max(
                1,
                Math.min(
                    500,
                    Number(
                        options.rewardLimit
                    ) || 100
                )
            )

        const eventResult =
            await syncEventStatuses()

        const expired =
            await expireMemberObjectives()

        const cancelled =
            await cancelDisabledObjectives()

        const rewardProcessing =
            await processPendingObjectiveRewardGrants(
                rewardLimit
            )

        return {
            processed: true,
            reason:
                'COMPLETED',

            eventsActivated:
                eventResult.activated || 0,

            eventsFinished:
                eventResult.finished || 0,

            objectivesExpired:
                expired,

            objectivesCancelled:
                cancelled,

            grantsProcessed:
                rewardProcessing.processed || 0,

            rewardsDelivered:
                rewardProcessing.delivered || 0,

            rewardFailures:
                rewardProcessing.failed || 0,

            rewardProcessing
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
    expireMemberObjectives,
    cancelDisabledObjectives,
    runObjectiveMaintenance
}
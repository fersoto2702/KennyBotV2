const { pool } =
    require('../database/mysql')

const {
    checkMemberMilestones
} = require(
    './milestoneService'
)


let running = false


async function runMilestoneMaintenance(
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

        const limit =
            Math.max(
                1,
                Math.min(
                    1000,
                    Number(
                        options.limit
                    ) || 500
                )
            )


        const [members] =
            await pool.query(
                `
                SELECT
                    id,
                    display_name,
                    joined_at

                FROM kb_members

                WHERE active = 1
                  AND group_joined_at IS NOT NULL

                ORDER BY id ASC

                LIMIT ${limit}
                `
            )


        const results = []


        for (const member of members) {

            try {

                const result =
                    await checkMemberMilestones(
                        member.id
                    )


                results.push({
                    memberId:
                        member.id,

                    success: true,

                    result
                })


            } catch (error) {

                results.push({
                    memberId:
                        member.id,

                    success: false,

                    error:
                        String(
                            error.message ||
                            error
                        )
                })
            }
        }


        const awardsGranted =
            results.reduce(
                (total, item) =>
                    total +
                    (
                        Array.isArray(
                            item.result?.granted
                        )
                            ? item.result
                                .granted
                                .length
                            : 0
                    ),
                0
            )


        const rewardsDelivered =
            results.reduce(
                (total, item) => {

                    const awards =
                        item.result
                            ?.granted ||
                        []


                    return (
                        total +
                        awards.reduce(
                            (
                                subtotal,
                                award
                            ) =>
                                subtotal +
                                Number(
                                    award
                                        .rewards
                                        ?.delivered ||
                                    0
                                ),
                            0
                        )
                    )
                },
                0
            )


        const failures =
            results.filter(
                item =>
                    !item.success
            ).length


        return {
            processed: true,
            reason:
                'COMPLETED',

            membersChecked:
                members.length,

            awardsGranted,

            rewardsDelivered,

            failures,

            results
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
    runMilestoneMaintenance
}
const { pool } =
    require('../database/mysql')

const {
    prepareRewardGrants
} = require(
    '../database/repositories/awardRewardRepository'
)

const {
    processRewardGrant
} = require(
    './rewardGrantService'
)

async function deliverAwardRewards(
    memberAwardId
) {

    const prepared =
        await prepareRewardGrants(
            memberAwardId
        )


    const grants =
        prepared.grants || []


    if (!grants.length) {

        return {
            memberAwardId,
            prepared:
                prepared.created || 0,
            processed: 0,
            delivered: 0,
            skipped: 0,
            failed: 0,
            results: []
        }
    }


    const results = []


    for (const grant of grants) {

        try {

            const result =
                await processRewardGrant(
                    grant.id
                )


            results.push({
                grantId:
                    grant.id,

                success:
                    result.processed === true,

                result
            })


        } catch (error) {

            results.push({
                grantId:
                    grant.id,

                success: false,

                error:
                    String(
                        error.message ||
                        error
                    )
            })
        }
    }


    const delivered =
        results.filter(
            item =>
                item.result?.reason ===
                'DELIVERED'
        ).length


    const skipped =
        results.filter(
            item =>
                [
                    'ALREADY_DELIVERED',
                    'GRANT_CANCELLED'
                ].includes(
                    item.result?.reason
                )
        ).length


    const failed =
        results.filter(
            item =>
                item.error
        ).length


    return {
        memberAwardId,

        prepared:
            prepared.created || 0,

        processed:
            results.length,

        delivered,

        skipped,

        failed,

        results
    }
}

async function prepareMissingAwardRewards(
    limit = 100
) {

    const safeLimit =
        Math.max(
            1,
            Math.min(
                500,
                Number(limit) || 100
            )
        )


    const [rows] =
        await pool.query(
            `
            SELECT DISTINCT
                ma.id AS member_award_id

            FROM kb_member_awards ma

            INNER JOIN kb_awards a
                ON a.id = ma.award_id

            INNER JOIN kb_award_rewards ar
                ON ar.award_id = a.id

            WHERE ma.enabled = 1
              AND a.enabled = 1
              AND ar.enabled = 1

              AND (
                    ar.season_id IS NULL
                    OR ar.season_id =
                        ma.season_id
                  )

              AND EXISTS (
                    SELECT 1

                    FROM kb_award_rewards ar2

                    WHERE ar2.award_id =
                        ma.award_id

                      AND ar2.enabled = 1

                      AND (
                            ar2.season_id IS NULL
                            OR ar2.season_id =
                                ma.season_id
                          )
                  )

              AND NOT EXISTS (
                    SELECT 1

                    FROM kb_member_reward_grants g

                    WHERE g.member_award_id =
                        ma.id

                      AND g.award_reward_id =
                        ar.id
                  )

            ORDER BY ma.id ASC

            LIMIT ${safeLimit}
            `
        )


    const results = []


    for (const row of rows) {

        try {

            const result =
                await prepareRewardGrants(
                    row.member_award_id
                )


            results.push({
                memberAwardId:
                    row.member_award_id,

                success: true,

                result
            })


        } catch (error) {

            results.push({
                memberAwardId:
                    row.member_award_id,

                success: false,

                error:
                    String(
                        error.message ||
                        error
                    )
            })
        }
    }


    return {
        checked:
            rows.length,

        prepared:
            results.filter(
                item =>
                    item.result?.created > 0
            ).length,

        failed:
            results.filter(
                item =>
                    !item.success
            ).length,

        results
    }
}


module.exports = {
    deliverAwardRewards,
    prepareMissingAwardRewards
}
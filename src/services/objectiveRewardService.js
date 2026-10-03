const {
    pool
} = require('../database/mysql')

const {
    getMemberObjectiveById,
    getObjectiveRewards
} = require(
    '../database/repositories/objectiveRepository'
)

async function getObjectiveRewardGrants(
    memberObjectiveId,
    conn = pool
) {

    const [rows] =
        await conn.execute(
            `
            SELECT
                g.*,
                r.reward_type,
                r.card_family,
                r.card_promo_code,
                r.card_subpromo,
                r.card_design_variant,
                r.card_game_code,
                r.card_rating,
                r.pack_type_id,
                r.pool_id,
                r.quantity
            FROM kb_objective_reward_grants g
            INNER JOIN kb_objective_rewards r
                ON r.id =
                   g.objective_reward_id
            WHERE g.member_objective_id = ?
            ORDER BY
                r.display_order ASC,
                g.reward_index ASC,
                g.id ASC
            `,
            [
                memberObjectiveId
            ]
        )

    return rows
}

async function prepareObjectiveRewardGrants(
    memberObjectiveId,
    conn = pool
) {

    const memberObjective =
        await getMemberObjectiveById(
            memberObjectiveId,
            conn
        )

    if (!memberObjective) {

        return {
            processed: false,
            reason:
                'MEMBER_OBJECTIVE_NOT_FOUND',
            grants: []
        }
    }

    if (
        memberObjective.status !==
            'COMPLETED' &&
        memberObjective.status !==
            'CLAIMED'
    ) {

        return {
            processed: false,
            reason:
                'OBJECTIVE_NOT_COMPLETED',
            grants: []
        }
    }

    const rewards =
        await getObjectiveRewards(
            memberObjective.objective_id,
            conn
        )

    for (const reward of rewards) {

        const quantity =
            Math.max(
                1,
                Number(
                    reward.quantity
                ) || 1
            )

        for (
            let rewardIndex = 1;
            rewardIndex <= quantity;
            rewardIndex++
        ) {

            await conn.execute(
                `
                INSERT INTO
                    kb_objective_reward_grants (
                        member_objective_id,
                        objective_reward_id,
                        member_id,
                        reward_index,
                        status
                    )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    'PENDING'
                )
                ON DUPLICATE KEY UPDATE
                    id = id
                `,
                [
                    memberObjective.id,
                    reward.id,
                    memberObjective.member_id,
                    rewardIndex
                ]
            )
        }
    }

    const grants =
        await getObjectiveRewardGrants(
            memberObjectiveId,
            conn
        )

    return {
        processed: true,
        memberObjective,
        rewardsPrepared:
            grants.length,
        grants
    }
}

async function claimObjective(
    memberId,
    memberObjectiveId
) {

    const conn =
        await pool.getConnection()

    try {

        await conn.beginTransaction()

        const [rows] =
            await conn.execute(
                `
                SELECT
                    mo.*,
                    o.code AS objective_code,
                    o.name AS objective_name,
                    o.target_value
                FROM kb_member_objectives mo
                INNER JOIN kb_objectives o
                    ON o.id =
                       mo.objective_id
                WHERE mo.id = ?
                  AND mo.member_id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [
                    memberObjectiveId,
                    memberId
                ]
            )

        const memberObjective =
            rows[0] || null

        if (!memberObjective) {

            await conn.rollback()

            return {
                processed: false,
                reason:
                    'MEMBER_OBJECTIVE_NOT_FOUND'
            }
        }

        if (
            memberObjective.status ===
            'CLAIMED'
        ) {

            const grants =
                await getObjectiveRewardGrants(
                    memberObjective.id,
                    conn
                )

            await conn.commit()

            return {
                processed: true,
                alreadyClaimed: true,
                memberObjective,
                grants
            }
        }

        if (
            memberObjective.status !==
            'COMPLETED'
        ) {

            await conn.rollback()

            return {
                processed: false,
                reason:
                    'OBJECTIVE_NOT_COMPLETED',
                status:
                    memberObjective.status
            }
        }

        const rewards =
            await getObjectiveRewards(
                memberObjective.objective_id,
                conn
            )

        if (!rewards.length) {

            await conn.rollback()

            return {
                processed: false,
                reason:
                    'OBJECTIVE_HAS_NO_REWARDS'
            }
        }

        for (const reward of rewards) {

            const quantity =
                Math.max(
                    1,
                    Number(
                        reward.quantity
                    ) || 1
                )

            for (
                let rewardIndex = 1;
                rewardIndex <= quantity;
                rewardIndex++
            ) {

                await conn.execute(
                    `
                    INSERT INTO
                        kb_objective_reward_grants (
                            member_objective_id,
                            objective_reward_id,
                            member_id,
                            reward_index,
                            status
                        )
                    VALUES (
                        ?,
                        ?,
                        ?,
                        ?,
                        'PENDING'
                    )
                    ON DUPLICATE KEY UPDATE
                        id = id
                    `,
                    [
                        memberObjective.id,
                        reward.id,
                        memberId,
                        rewardIndex
                    ]
                )
            }
        }

        await conn.execute(
            `
            UPDATE kb_member_objectives
            SET
                status = 'CLAIMED',
                claimed_at =
                    COALESCE(
                        claimed_at,
                        CURRENT_TIMESTAMP
                    ),
                updated_at =
                    CURRENT_TIMESTAMP
            WHERE id = ?
              AND status = 'COMPLETED'
            `,
            [
                memberObjective.id
            ]
        )

        const grants =
            await getObjectiveRewardGrants(
                memberObjective.id,
                conn
            )

        await conn.commit()

        return {
            processed: true,
            alreadyClaimed: false,
            memberObjectiveId:
                memberObjective.id,
            objectiveId:
                memberObjective.objective_id,
            objectiveCode:
                memberObjective.objective_code,
            objectiveName:
                memberObjective.objective_name,
            grants
        }

    } catch (err) {

        try {
            await conn.rollback()
        } catch {}

        throw err

    } finally {

        conn.release()
    }
}

async function getPendingObjectiveRewardGrants(
    limit = 100,
    conn = pool
) {

    const normalizedLimit =
        Math.max(
            1,
            Math.min(
                500,
                Number(limit) || 100
            )
        )

    const [rows] =
        await conn.query(
            `
            SELECT
                g.*,
                r.reward_type,
                r.card_family,
                r.card_promo_code,
                r.card_subpromo,
                r.card_design_variant,
                r.card_game_code,
                r.card_rating,
                r.pack_type_id,
                r.pool_id,
                r.quantity
            FROM kb_objective_reward_grants g
            INNER JOIN kb_objective_rewards r
                ON r.id =
                   g.objective_reward_id
            WHERE g.status IN (
                'PENDING',
                'FAILED'
            )
              AND r.enabled = 1
            ORDER BY
                g.id ASC
            LIMIT ${normalizedLimit}
            `
        )

    return rows
}

module.exports = {
    getObjectiveRewardGrants,
    prepareObjectiveRewardGrants,
    claimObjective,
    getPendingObjectiveRewardGrants
}
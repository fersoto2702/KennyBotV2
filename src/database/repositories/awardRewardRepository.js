const { pool } = require('../mysql')

async function getAwardRewards(
    awardId,
    seasonId = null,
    conn = pool
) {

    const [rows] =
        await conn.execute(
            `
            SELECT
                ar.id,
                ar.award_id,
                ar.season_id,
                ar.reward_type,

                ar.card_family,
                ar.card_promo_code,
                ar.card_subpromo,
                ar.card_design_variant,
                ar.card_game_code,
                ar.card_rating,

                ar.pack_type_id,
                ar.pool_id,

                ar.quantity,
                ar.enabled,

                pt.code AS pack_type_code,
                pt.name AS pack_type_name

            FROM kb_award_rewards ar

            LEFT JOIN ut_pack_types pt
                ON pt.id = ar.pack_type_id

            WHERE ar.award_id = ?
              AND ar.enabled = 1
              AND (
                    ar.season_id = ?
                    OR ar.season_id IS NULL
                  )

            ORDER BY
                CASE
                    WHEN ar.season_id = ?
                    THEN 0
                    ELSE 1
                END,
                ar.id ASC
            `,
            [
                awardId,
                seasonId,
                seasonId
            ]
        )

    if (seasonId !== null) {

        const specific =
            rows.filter(
                reward =>
                    Number(reward.season_id) ===
                    Number(seasonId)
            )


        if (specific.length) {
            return specific
        }
    }


    return rows.filter(
        reward =>
            reward.season_id === null
    )
}

async function getMemberAwardForRewards(
    memberAwardId,
    conn = pool
) {

    const [rows] =
        await conn.execute(
            `
            SELECT
                ma.id,
                ma.member_id,
                ma.award_id,
                ma.season_id,
                ma.reason,
                ma.ranking_position,
                ma.awarded_at,

                a.code AS award_code,
                a.name AS award_name,
                a.award_type,
                a.repeatable

            FROM kb_member_awards ma

            INNER JOIN kb_awards a
                ON a.id = ma.award_id

            WHERE ma.id = ?
              AND ma.enabled = 1
              AND a.enabled = 1

            LIMIT 1
            `,
            [memberAwardId]
        )


    return rows[0] || null
}

async function prepareRewardGrants(
    memberAwardId
) {

    const conn =
        await pool.getConnection()

    try {

        await conn.beginTransaction()

        const [memberAwardRows] =
            await conn.execute(
                `
                SELECT
                    ma.id,
                    ma.member_id,
                    ma.award_id,
                    ma.season_id,
                    ma.enabled

                FROM kb_member_awards ma

                WHERE ma.id = ?

                FOR UPDATE
                `,
                [memberAwardId]
            )


        if (!memberAwardRows.length) {

            await conn.rollback()

            return {
                prepared: false,
                reason:
                    'MEMBER_AWARD_NOT_FOUND',
                created: 0,
                grants: []
            }
        }


        const memberAward =
            memberAwardRows[0]


        if (
            Number(memberAward.enabled) !== 1
        ) {

            await conn.rollback()

            return {
                prepared: false,
                reason:
                    'MEMBER_AWARD_DISABLED',
                created: 0,
                grants: []
            }
        }


        const rewards =
            await getAwardRewards(
                memberAward.award_id,
                memberAward.season_id,
                conn
            )


        if (!rewards.length) {

            await conn.commit()

            return {
                prepared: true,
                reason:
                    'NO_REWARDS_CONFIGURED',
                created: 0,
                grants: []
            }
        }


        let created = 0

        for (const reward of rewards) {

            const quantity =
                Math.max(
                    1,
                    Number(reward.quantity) || 1
                )


            for (
                let rewardIndex = 1;
                rewardIndex <= quantity;
                rewardIndex++
            ) {

                const [result] =
                    await conn.execute(
                        `
                        INSERT IGNORE INTO
                            kb_member_reward_grants
                        (
                            member_award_id,
                            award_reward_id,
                            member_id,
                            reward_index,
                            status
                        )
                        VALUES (?, ?, ?, ?, 'PENDING')
                        `,
                        [
                            memberAward.id,
                            reward.id,
                            memberAward.member_id,
                            rewardIndex
                        ]
                    )


                if (
                    Number(result.affectedRows) === 1
                ) {
                    created++
                }
            }
        }

        const [grants] =
            await conn.execute(
                `
                SELECT
                    g.id,
                    g.member_award_id,
                    g.award_reward_id,
                    g.member_id,
                    g.reward_index,
                    g.status,
                    g.member_card_id,
                    g.user_pack_id,
                    g.attempts,
                    g.last_error,
                    g.processing_at,
                    g.delivered_at,

                    ar.reward_type,
                    ar.card_family,
                    ar.card_promo_code,
                    ar.card_subpromo,
                    ar.card_design_variant,
                    ar.card_game_code,
                    ar.card_rating,
                    ar.pack_type_id,
                    ar.pool_id

                FROM kb_member_reward_grants g

                INNER JOIN kb_award_rewards ar
                    ON ar.id =
                        g.award_reward_id

                WHERE g.member_award_id = ?

                ORDER BY
                    g.award_reward_id ASC,
                    g.reward_index ASC
                `,
                [memberAward.id]
            )


        await conn.commit()


        return {
            prepared: true,

            reason:
                created > 0
                    ? 'GRANTS_CREATED'
                    : 'GRANTS_ALREADY_EXIST',

            created,
            grants
        }


    } catch (error) {

        try {
            await conn.rollback()
        } catch (_) {}

        throw error

    } finally {

        conn.release()

    }
}

async function getPendingRewardGrants(
    limit = 50
) {

    const safeLimit =
        Math.max(
            1,
            Math.min(
                500,
                Number(limit) || 50
            )
        )

    const [rows] =
        await pool.query(
            `
            SELECT
                g.id,
                g.member_award_id,
                g.award_reward_id,
                g.member_id,
                g.reward_index,
                g.status,
                g.attempts,
                g.last_error,

                ar.reward_type,

                ar.card_family,
                ar.card_promo_code,
                ar.card_subpromo,
                ar.card_design_variant,
                ar.card_game_code,
                ar.card_rating,

                ar.pack_type_id,
                ar.pool_id,

                a.code AS award_code,
                a.name AS award_name

            FROM kb_member_reward_grants g

            INNER JOIN kb_award_rewards ar
                ON ar.id =
                    g.award_reward_id

            INNER JOIN kb_member_awards ma
                ON ma.id =
                    g.member_award_id

            INNER JOIN kb_awards a
                ON a.id =
                    ma.award_id

            WHERE g.status = 'PENDING'
              AND ar.enabled = 1
              AND ma.enabled = 1
              AND a.enabled = 1

            ORDER BY
                g.id ASC

            LIMIT ${safeLimit}
            `
        )


    return rows
}


module.exports = {
    getAwardRewards,
    getMemberAwardForRewards,
    prepareRewardGrants,
    getPendingRewardGrants
}
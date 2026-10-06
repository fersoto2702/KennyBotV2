const {
    pool
} = require('../mysql')


function validatePositiveInteger(
    value,
    name
) {

    const number =
        Number(
            value
        )


    if (
        !Number.isInteger(number) ||
        number <= 0
    ) {

        throw new Error(
            `${name} inválido: ${value}`
        )

    }


    return number

}


function normalizeNullableInteger(
    value,
    name
) {

    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {

        return null

    }


    return validatePositiveInteger(
        value,
        name
    )

}


function normalizeLimit(
    value,
    fallback = 50,
    max = 500
) {

    const number =
        Number(
            value
        )


    if (
        !Number.isFinite(number)
    ) {

        return fallback

    }


    return Math.max(
        1,
        Math.min(
            max,
            Math.floor(number)
        )
    )

}


async function getAwardRewards(
    awardId,
    seasonId = null,
    conn = pool
) {

    const id =
        validatePositiveInteger(
            awardId,
            'awardId'
        )


    const normalizedSeasonId =
        normalizeNullableInteger(
            seasonId,
            'seasonId'
        )


    const [
        rows
    ] =
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
                id,
                normalizedSeasonId,
                normalizedSeasonId
            ]

        )


    const rewards =
        Array.isArray(rows)
            ? rows
            : []


    /*
        Si existen recompensas específicas
        de temporada, reemplazan a las globales.
    */

    if (
        normalizedSeasonId !== null
    ) {

        const specific =
            rewards.filter(

                reward =>

                    reward.season_id !== null &&

                    Number(
                        reward.season_id
                    ) ===
                    normalizedSeasonId

            )


        if (
            specific.length > 0
        ) {

            return specific

        }

    }


    return rewards.filter(

        reward =>
            reward.season_id === null

    )

}


async function getMemberAwardForRewards(
    memberAwardId,
    conn = pool
) {

    const id =
        validatePositiveInteger(
            memberAwardId,
            'memberAwardId'
        )


    const [
        rows
    ] =
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

            [
                id
            ]

        )


    return (
        rows?.[0] ||
        null
    )

}


async function prepareRewardGrants(
    memberAwardId
) {

    const id =
        validatePositiveInteger(
            memberAwardId,
            'memberAwardId'
        )


    const conn =
        await pool.getConnection()


    let transactionFinished =
        false


    try {

        await conn.beginTransaction()


        /* ─────────────────────────────
           MEMBER AWARD
        ───────────────────────────── */

        const [
            memberAwardRows
        ] =
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

                [
                    id
                ]

            )


        if (
            !Array.isArray(
                memberAwardRows
            ) ||
            memberAwardRows.length === 0
        ) {

            await conn.rollback()

            transactionFinished =
                true


            return {

                prepared:
                    false,

                reason:
                    'MEMBER_AWARD_NOT_FOUND',

                created:
                    0,

                grants:
                    []

            }

        }


        const memberAward =
            memberAwardRows[0]


        if (
            Number(
                memberAward.enabled
            ) !== 1
        ) {

            await conn.rollback()

            transactionFinished =
                true


            return {

                prepared:
                    false,

                reason:
                    'MEMBER_AWARD_DISABLED',

                created:
                    0,

                grants:
                    []

            }

        }


        /* ─────────────────────────────
           RECOMPENSAS
        ───────────────────────────── */

        const rewards =
            await getAwardRewards(

                memberAward.award_id,

                memberAward.season_id,

                conn

            )


        if (
            rewards.length === 0
        ) {

            await conn.commit()

            transactionFinished =
                true


            return {

                prepared:
                    true,

                reason:
                    'NO_REWARDS_CONFIGURED',

                created:
                    0,

                grants:
                    []

            }

        }


        /* ─────────────────────────────
           CREAR GRANTS
        ───────────────────────────── */

        let created =
            0


        for (
            const reward of rewards
        ) {

            if (
                !reward ||
                !reward.id
            ) {

                continue

            }


            const quantity =
                Math.max(

                    1,

                    Math.floor(
                        Number(
                            reward.quantity
                        ) || 1
                    )

                )


            for (
                let rewardIndex = 1;
                rewardIndex <= quantity;
                rewardIndex++
            ) {

                const [
                    result
                ] =
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
                    Number(
                        result.affectedRows
                    ) === 1
                ) {

                    created++

                }

            }

        }


        /* ─────────────────────────────
           CONSULTAR GRANTS
        ───────────────────────────── */

        const [
            grantsRows
        ] =
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

                [
                    memberAward.id
                ]

            )


        const grants =
            Array.isArray(
                grantsRows
            )
                ? grantsRows
                : []


        await conn.commit()

        transactionFinished =
            true


        return {

            prepared:
                true,

            reason:
                created > 0
                    ? 'GRANTS_CREATED'
                    : 'GRANTS_ALREADY_EXIST',

            created,

            grants

        }


    } catch (error) {

        if (
            !transactionFinished
        ) {

            try {

                await conn.rollback()

            } catch {}

        }


        throw error


    } finally {

        conn.release()

    }

}


async function getPendingRewardGrants(
    limit = 50
) {

    const safeLimit =
        normalizeLimit(
            limit,
            50,
            500
        )


    const [
        rows
    ] =
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


    return Array.isArray(rows)
        ? rows
        : []

}


module.exports = {

    getAwardRewards,

    getMemberAwardForRewards,

    prepareRewardGrants,

    getPendingRewardGrants

}
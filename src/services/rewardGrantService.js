const { pool } =
    require('../database/mysql')

function buildRewardCardKey(grantId) {

    return `reward:grant:${grantId}`
}

async function processMemberCardGrant(
    conn,
    grant
) {

    if (grant.member_card_id) {

        return {
            memberCardId:
                grant.member_card_id,

            recovered: true
        }
    }


    if (!grant.card_family) {
        throw new Error(
            'CARD_FAMILY_REQUIRED'
        )
    }


    if (!grant.card_promo_code) {
        throw new Error(
            'CARD_PROMO_CODE_REQUIRED'
        )
    }


    if (!grant.card_rating) {
        throw new Error(
            'CARD_RATING_REQUIRED'
        )
    }


    const cardKey =
        buildRewardCardKey(grant.id)

    const [existingCards] =
        await conn.execute(
            `
            SELECT id
            FROM kb_member_cards
            WHERE card_key = ?
            LIMIT 1
            FOR UPDATE
            `,
            [cardKey]
        )


    if (existingCards.length) {

        return {
            memberCardId:
                existingCards[0].id,

            recovered: true
        }
    }

    const [statsRows] =
        await conn.execute(
            `
            SELECT
                valid_messages,
                commands_used,
                interactions,
                active_days,
                longest_streak

            FROM kb_member_stats

            WHERE member_id = ?

            LIMIT 1
            FOR UPDATE
            `,
            [grant.member_id]
        )


    const stats =
        statsRows[0] || {}

    const rating =
        Math.max(
            1,
            Math.min(
                99,
                Number(grant.card_rating)
            )
        )

    const [result] =
        await conn.execute(
            `
            INSERT INTO kb_member_cards (
                member_id,
                card_key,
                family,
                promo_code,
                subpromo,
                design_variant,
                game_code,
                card_name,
                rating,

                msg_stat,
                act_stat,
                cmd_stat,
                rac_stat,
                ant_stat,
                int_stat,

                image_path,
                obtained_reason,
                obtained_at,
                equipped,
                enabled
            )

            VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?,
                ?,
                ?, ?, ?, ?, ?, ?,
                NULL,
                ?,
                CURRENT_TIMESTAMP,
                0,
                1
            )
            `,
            [
                grant.member_id,
                cardKey,

                grant.card_family,
                grant.card_promo_code,
                grant.card_subpromo,
                grant.card_design_variant,
                grant.card_game_code,

                grant.award_name,

                rating,

                rating,
                rating,
                rating,
                rating,
                rating,
                rating,

                `Recompensa: ${grant.award_name}`
            ]
        )


    return {
        memberCardId:
            result.insertId,

        recovered: false
    }
}

async function processUserPackGrant(
    conn,
    grant
) {

    if (grant.user_pack_id) {

        return {
            userPackId:
                grant.user_pack_id,

            recovered: true
        }
    }


    if (!grant.pack_type_id) {
        throw new Error(
            'PACK_TYPE_REQUIRED'
        )
    }


    if (!grant.pool_id) {
        throw new Error(
            'PACK_POOL_REQUIRED'
        )
    }


    const [packTypes] =
        await conn.execute(
            `
            SELECT id
            FROM ut_pack_types
            WHERE id = ?
            LIMIT 1
            `,
            [grant.pack_type_id]
        )


    if (!packTypes.length) {
        throw new Error(
            'PACK_TYPE_NOT_FOUND'
        )
    }


    const [pools] =
        await conn.execute(
            `
            SELECT id
            FROM ut_pack_pools
            WHERE id = ?
            LIMIT 1
            `,
            [grant.pool_id]
        )


    if (!pools.length) {
        throw new Error(
            'PACK_POOL_NOT_FOUND'
        )
    }


    const [result] =
        await conn.execute(
            `
            INSERT INTO ut_user_packs (
                member_id,
                pack_type_id,
                pool_id,
                status,
                obtained_reason
            )
            VALUES (?, ?, ?, 'UNOPENED', ?)
            `,
            [
                grant.member_id,
                grant.pack_type_id,
                grant.pool_id,
                `Recompensa: ${grant.award_name}`
            ]
        )


    return {
        userPackId:
            result.insertId,

        recovered: false
    }
}

async function processRewardGrant(grantId) {

    const conn =
        await pool.getConnection()

    try {

        await conn.beginTransaction()

        const [rows] =
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

                WHERE g.id = ?

                LIMIT 1

                FOR UPDATE
                `,
                [grantId]
            )


        if (!rows.length) {

            await conn.rollback()

            return {
                processed: false,
                reason:
                    'GRANT_NOT_FOUND'
            }
        }


        const grant =
            rows[0]

        if (grant.status === 'DELIVERED') {

            await conn.commit()

            return {
                processed: false,
                reason:
                    'ALREADY_DELIVERED',
                grantId:
                    grant.id
            }
        }


        if (grant.status === 'CANCELLED') {

            await conn.commit()

            return {
                processed: false,
                reason:
                    'GRANT_CANCELLED',
                grantId:
                    grant.id
            }
        }

        if (grant.status !== 'PENDING') {

            await conn.commit()

            return {
                processed: false,
                reason:
                    `INVALID_STATUS_${grant.status}`,
                grantId:
                    grant.id
            }
        }

        await conn.execute(
            `
            UPDATE kb_member_reward_grants

            SET
                status = 'PROCESSING',
                attempts = attempts + 1,
                processing_at =
                    CURRENT_TIMESTAMP,
                last_error = NULL

            WHERE id = ?
            `,
            [grant.id]
        )

        if (
            grant.reward_type ===
            'MEMBER_CARD'
        ) {

            const delivery =
                await processMemberCardGrant(
                    conn,
                    grant
                )


            await conn.execute(
                `
                UPDATE kb_member_reward_grants

                SET
                    status = 'DELIVERED',
                    member_card_id = ?,
                    delivered_at =
                        CURRENT_TIMESTAMP,
                    processing_at = NULL,
                    last_error = NULL

                WHERE id = ?
                `,
                [
                    delivery.memberCardId,
                    grant.id
                ]
            )


            await conn.commit()


            return {
                processed: true,
                reason: 'DELIVERED',
                rewardType:
                    'MEMBER_CARD',
                grantId:
                    grant.id,
                memberCardId:
                    delivery.memberCardId,
                recovered:
                    delivery.recovered
            }
        }

        if (
    grant.reward_type ===
    'USER_PACK'
) {

    const delivery =
        await processUserPackGrant(
            conn,
            grant
        )


    await conn.execute(
        `
        UPDATE kb_member_reward_grants

        SET
            status = 'DELIVERED',
            user_pack_id = ?,
            delivered_at =
                CURRENT_TIMESTAMP,
            processing_at = NULL,
            last_error = NULL

        WHERE id = ?
        `,
        [
            delivery.userPackId,
            grant.id
        ]
    )


    await conn.commit()


    return {
        processed: true,
        reason: 'DELIVERED',
        rewardType:
            'USER_PACK',
        grantId:
            grant.id,
        userPackId:
            delivery.userPackId,
        recovered:
            delivery.recovered
    }
}


        throw new Error(
            `UNKNOWN_REWARD_TYPE: ${grant.reward_type}`
        )


    } catch (error) {

        try {
            await conn.rollback()
        } catch (_) {}

        try {

            await pool.execute(
                `
                UPDATE kb_member_reward_grants

                SET
                    status = 'FAILED',
                    attempts = attempts + 1,
                    processing_at = NULL,
                    last_error = ?

                WHERE id = ?
                  AND status <> 'DELIVERED'
                  AND status <> 'CANCELLED'
                `,
                [
                    String(
                        error.message || error
                    ).slice(0, 1000),

                    grantId
                ]
            )

        } catch (_) {}


        throw error

    } finally {

        conn.release()

    }
}

async function processPendingRewardGrants(
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


    const [pending] =
        await pool.query(
            `
            SELECT id
            FROM kb_member_reward_grants
            WHERE status = 'PENDING'
            ORDER BY id ASC
            LIMIT ${safeLimit}
            `
        )


    const results = []


    for (const grant of pending) {

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


    const failed =
        results.filter(
            item =>
                item.error
        ).length


    return {
        processed:
            results.length,

        delivered,

        failed,

        results
    }
}

module.exports = {
    processRewardGrant,
    processPendingRewardGrants
}
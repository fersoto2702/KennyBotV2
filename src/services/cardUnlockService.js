const { pool } =
    require('../database/mysql')

const {
    getProgressionData,
    getCardTier
} = require('./cardProgressionService')

function evaluateCardUnlock(rating, ownedCardKeys = [], memberId) {

    const tier =
        getCardTier(rating)

    if (tier.tier === 1) {
        return {
            shouldUnlock: false,
            reason: 'INITIAL_TIER',
            tier
        }
    }

    const cardKey =
        `member:${memberId}:progression:${tier.tier}`

    if (ownedCardKeys.includes(cardKey)) {
        return {
            shouldUnlock: false,
            reason: 'ALREADY_UNLOCKED',
            cardKey,
            tier
        }
    }

    return {
        shouldUnlock: true,
        reason: 'NEW_TIER',
        cardKey,
        tier
    }
}

async function checkCardUnlock(memberId) {

    const progression =
        await getProgressionData(memberId)

    const tier =
        getCardTier(progression.rating)

    if (tier.tier === 1) {

        return {
            unlocked: false,
            reason: 'INITIAL_TIER',
            progression,
            tier
        }
    }


    const conn =
        await pool.getConnection()


    try {

        await conn.beginTransaction()

        const [members] =
            await conn.execute(
                `
                SELECT
                    id,
                    member_type
                FROM kb_members
                WHERE id = ?
                FOR UPDATE
                `,
                [memberId]
            )


        if (!members.length) {

            throw new Error(
                `No existe member_id ${memberId}`
            )
        }


        const member =
            members[0]

        if (member.member_type !== 'MEMBER') {

            await conn.rollback()

            return {
                unlocked: false,
                reason: 'NOT_STANDARD_MEMBER',
                progression,
                tier
            }
        }

        const cardKey =
            `member:${memberId}:progression:${tier.tier}`


        const [existing] =
            await conn.execute(
                `
                SELECT
                    id,
                    card_key,
                    rating,
                    equipped
                FROM kb_member_cards
                WHERE card_key = ?
                LIMIT 1
                FOR UPDATE
                `,
                [cardKey]
            )

        if (existing.length) {

            await conn.commit()

            return {
                unlocked: false,
                reason: 'ALREADY_UNLOCKED',
                card: existing[0],
                progression,
                tier
            }
        }

        const {
            msg,
            act,
            cmd,
            rac,
            ant,
            int
        } = progression.stats

        await conn.execute(
            `
            UPDATE kb_member_cards
            SET equipped = 0
            WHERE member_id = ?
              AND equipped = 1
            `,
            [memberId]
        )

        const [result] =
            await conn.execute(
                `
                INSERT INTO kb_member_cards (
                    member_id,
                    card_key,
                    family,
                    promo_code,
                    card_name,
                    rating,

                    msg_stat,
                    act_stat,
                    cmd_stat,
                    rac_stat,
                    ant_stat,
                    int_stat,

                    obtained_reason,
                    equipped,
                    enabled
                )
                VALUES (
                    ?,
                    ?,
                    'PLAYER',
                    ?,
                    ?,
                    ?,

                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,

                    ?,
                    1,
                    1
                )
                `,
                [
                    memberId,
                    cardKey,

                    tier.promoCode,
                    tier.cardName,
                    progression.rating,

                    msg,
                    act,
                    cmd,
                    rac,
                    ant,
                    int,

                    `Progresión alcanzada: Tier ${tier.tier}`
                ]
            )


        const cardId =
            result.insertId


        const [cards] =
            await conn.execute(
                `
                SELECT *
                FROM kb_member_cards
                WHERE id = ?
                LIMIT 1
                `,
                [cardId]
            )


        await conn.commit()


        return {
            unlocked: true,
            reason: 'NEW_TIER',
            card: cards[0],
            progression,
            tier
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


module.exports = {
    checkCardUnlock,
    evaluateCardUnlock
}
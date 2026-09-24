const {
    pool
} = require('../database/mysql')

const {
    restoreBestEligibleCard
} = require('./specialCardService')


let running = false


async function getAdminOfMonthCardsToReview(
    conn,
    limit
) {

    const [rows] =
        await conn.query(
            `
            SELECT
                c.id AS card_id,
                c.member_id,
                c.rating,
                c.obtained_at

            FROM kb_member_cards c

            INNER JOIN kb_members m
                ON m.id = c.member_id

            WHERE c.enabled = 1
              AND c.equipped = 1
              AND c.family = 'ICON'
              AND c.promo_code =
                  'ADMIN_OF_THE_MONTH'
              AND m.active = 1

            ORDER BY
                c.id ASC

            LIMIT ${limit}
            `
        )


    return rows
}


async function maintainSpecialCardForMember(
    memberId
) {

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
                  AND active = 1

                LIMIT 1

                FOR UPDATE
                `,
                [memberId]
            )


        if (!members.length) {

            await conn.rollback()

            return {
                processed: false,
                reason:
                    'MEMBER_NOT_FOUND'
            }
        }


        const [equippedCards] =
            await conn.execute(
                `
                SELECT
                    id,
                    family,
                    promo_code,
                    rating

                FROM kb_member_cards

                WHERE member_id = ?
                  AND enabled = 1
                  AND equipped = 1

                LIMIT 1

                FOR UPDATE
                `,
                [memberId]
            )


        if (!equippedCards.length) {

            await conn.commit()

            return {
                processed: false,
                reason:
                    'NO_EQUIPPED_CARD'
            }
        }


        const currentCard =
            equippedCards[0]


        if (
            currentCard.family !== 'ICON' ||
            currentCard.promo_code !==
                'ADMIN_OF_THE_MONTH'
        ) {

            await conn.commit()

            return {
                processed: false,
                reason:
                    'NO_MAINTENANCE_REQUIRED'
            }
        }


        const restoration =
            await restoreBestEligibleCard(
                conn,
                memberId
            )


        await conn.commit()


        if (!restoration.restored) {

            return {
                processed: false,
                reason:
                    restoration.reason ||
                    'RESTORE_FAILED'
            }
        }


        const changed =
            Number(
                restoration.cardId
            ) !==
            Number(
                currentCard.id
            )


        return {
            processed: true,
            reason:
                changed
                    ? 'CARD_CHANGED'
                    : 'CARD_STILL_ELIGIBLE',

            changed,

            previousCard: {
                id:
                    currentCard.id,

                family:
                    currentCard.family,

                promoCode:
                    currentCard.promo_code,

                rating:
                    Number(
                        currentCard.rating
                    )
            },

            currentCard: {
                id:
                    restoration.cardId,

                family:
                    restoration.family,

                promoCode:
                    restoration.promoCode,

                rating:
                    restoration.rating
            },

            memberType:
                restoration.memberType
        }


    } catch (error) {

        try {

            await conn.rollback()

        } catch {}


        throw error


    } finally {

        conn.release()
    }
}


async function runSpecialCardMaintenance(
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
                    500,
                    Number(
                        options.limit
                    ) || 100
                )
            )


        const conn =
            await pool.getConnection()


        let cards


        try {

            cards =
                await getAdminOfMonthCardsToReview(
                    conn,
                    limit
                )

        } finally {

            conn.release()
        }


        const results = []


        for (const card of cards) {

            try {

                const result =
                    await maintainSpecialCardForMember(
                        card.member_id
                    )


                results.push({
                    memberId:
                        card.member_id,

                    success: true,

                    result
                })


            } catch (error) {

                results.push({
                    memberId:
                        card.member_id,

                    success: false,

                    error:
                        String(
                            error.message ||
                            error
                        )
                })
            }
        }


        const changed =
            results.filter(
                item =>
                    item.result?.changed ===
                    true
            ).length


        const unchanged =
            results.filter(
                item =>
                    item.result?.reason ===
                    'CARD_STILL_ELIGIBLE'
            ).length


        const failed =
            results.filter(
                item =>
                    item.success === false
            ).length


        return {
            processed: true,
            reason:
                'COMPLETED',

            checked:
                cards.length,

            changed,

            unchanged,

            failed,

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
    maintainSpecialCardForMember,
    runSpecialCardMaintenance
}
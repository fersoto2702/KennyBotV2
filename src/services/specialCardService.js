const SPECIAL_CARD_RULES = {

    HERO_RECOGNITION: {
        family: 'HERO',
        promoCode: 'HERO_RECOGNITION',
        minimumRating: 90,
        ratingBoost: 2,
        maximumRating: 99,
        autoEquip: true
    },

    ADMIN_PROMOTION: {
        family: 'ICON',
        promoCode: 'ADMIN_ICON',
        minimumRating: 91,
        ratingBoost: 2,
        maximumRating: 99,
        autoEquip: true
    },

    ADMIN_OF_THE_MONTH: {
        family: 'ICON',
        promoCode: 'ADMIN_OF_THE_MONTH',
        minimumRating: 94,
        ratingBoost: 2,
        maximumRating: 99,
        autoEquip: true
    },

    OWNER: {
        family: 'ICON',
        promoCode: 'OWNER_ICON',
        fixedRating: 99,
        maximumRating: 99,
        autoEquip: true
    }

}


function normalizeAwardCode(awardCode) {

    return String(
        awardCode || ''
    )
        .trim()
        .toUpperCase()
}


function getSpecialCardRule(awardCode) {

    return SPECIAL_CARD_RULES[
        normalizeAwardCode(
            awardCode
        )
    ] || null
}


function isSpecialCardAward(awardCode) {

    return Boolean(
        getSpecialCardRule(
            awardCode
        )
    )
}


async function getBestMemberCardRating(
    conn,
    memberId,
    options = {}
) {

    const excludeIcon =
        options.excludeIcon === true

    let familyCondition = ''

    if (excludeIcon) {

        familyCondition =
            `AND family IN ('PLAYER', 'HERO')`
    }


    const [rows] =
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
              ${familyCondition}

            ORDER BY
                rating DESC,
                obtained_at DESC,
                id DESC

            LIMIT 1

            FOR UPDATE
            `,
            [memberId]
        )


    if (!rows.length) {

        return {
            cardId: null,
            family: null,
            promoCode: null,
            rating: 75
        }
    }


    return {
        cardId:
            rows[0].id,

        family:
            rows[0].family,

        promoCode:
            rows[0].promo_code,

        rating:
            Number(
                rows[0].rating || 75
            )
    }
}


async function calculateSpecialCardRating(
    conn,
    memberId,
    awardCode,
    configuredRating = null
) {

    const normalizedAwardCode =
        normalizeAwardCode(
            awardCode
        )

    const rule =
        getSpecialCardRule(
            normalizedAwardCode
        )


    if (!rule) {

        if (
            configuredRating === null ||
            configuredRating === undefined
        ) {

            throw new Error(
                'CARD_RATING_REQUIRED'
            )
        }


        const rating =
            Number(
                configuredRating
            )


        if (!Number.isFinite(rating)) {

            throw new Error(
                'INVALID_CARD_RATING'
            )
        }


        return Math.max(
            1,
            Math.min(
                99,
                Math.round(rating)
            )
        )
    }


    if (
        rule.fixedRating !== undefined
    ) {

        return Math.max(
            1,
            Math.min(
                Number(
                    rule.maximumRating || 99
                ),
                Number(
                    rule.fixedRating
                )
            )
        )
    }


    const excludeIcon =
        normalizedAwardCode ===
        'ADMIN_PROMOTION'


    const best =
        await getBestMemberCardRating(
            conn,
            memberId,
            {
                excludeIcon
            }
        )


    const calculated =
        Math.max(
            Number(
                rule.minimumRating || 1
            ),
            Number(
                best.rating || 75
            ) +
            Number(
                rule.ratingBoost || 0
            )
        )


    return Math.max(
        1,
        Math.min(
            Number(
                rule.maximumRating || 99
            ),
            calculated
        )
    )
}


async function getActiveMemberType(
    conn,
    memberId
) {

    const [members] =
        await conn.execute(
            `
            SELECT
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

        return null
    }


    return members[0].member_type
}


async function hasActiveAdminOfMonthAward(
    conn,
    memberId
) {

    const [rows] =
        await conn.execute(
            `
            SELECT
                ma.id,
                ma.awarded_at,
                ma.season_id

            FROM kb_member_awards ma

            INNER JOIN kb_awards a
                ON a.id = ma.award_id

            WHERE ma.member_id = ?
              AND ma.enabled = 1
              AND a.code = 'ADMIN_OF_THE_MONTH'
              AND a.enabled = 1
              AND CURRENT_TIMESTAMP >= ma.awarded_at
              AND CURRENT_TIMESTAMP <
                  DATE_ADD(
                      ma.awarded_at,
                      INTERVAL 30 DAY
                  )

            ORDER BY
                ma.awarded_at DESC,
                ma.id DESC

            LIMIT 1

            FOR UPDATE
            `,
            [memberId]
        )


    return rows.length > 0
}


async function shouldAutoEquipSpecialCard(
    conn,
    memberId,
    awardCode
) {

    const normalizedAwardCode =
        normalizeAwardCode(
            awardCode
        )

    const rule =
        getSpecialCardRule(
            normalizedAwardCode
        )


    if (
        !rule ||
        !rule.autoEquip
    ) {

        return false
    }


    const memberType =
        await getActiveMemberType(
            conn,
            memberId
        )


    if (!memberType) {

        return false
    }


    if (
        normalizedAwardCode ===
        'HERO_RECOGNITION'
    ) {

        return memberType === 'MEMBER'
    }


    if (
        normalizedAwardCode ===
        'ADMIN_PROMOTION'
    ) {

        return (
            memberType === 'ADMIN' ||
            memberType === 'OWNER'
        )
    }


    if (
        normalizedAwardCode ===
        'ADMIN_OF_THE_MONTH'
    ) {

        if (
            memberType !== 'ADMIN' &&
            memberType !== 'OWNER'
        ) {

            return false
        }


        return await hasActiveAdminOfMonthAward(
            conn,
            memberId
        )
    }


    if (
        normalizedAwardCode ===
        'OWNER'
    ) {

        return memberType === 'OWNER'
    }


    return false
}


async function equipSpecialCard(
    conn,
    memberId,
    cardId
) {

    const [cards] =
        await conn.execute(
            `
            SELECT
                id

            FROM kb_member_cards

            WHERE id = ?
              AND member_id = ?
              AND enabled = 1

            LIMIT 1

            FOR UPDATE
            `,
            [
                cardId,
                memberId
            ]
        )


    if (!cards.length) {

        return {
            equipped: false,
            reason:
                'CARD_NOT_FOUND_OR_DISABLED'
        }
    }


    await conn.execute(
        `
        UPDATE kb_member_cards

        SET equipped = 0

        WHERE member_id = ?
          AND equipped = 1
        `,
        [memberId]
    )


    await conn.execute(
        `
        UPDATE kb_member_cards

        SET equipped = 1

        WHERE id = ?
          AND member_id = ?
          AND enabled = 1
        `,
        [
            cardId,
            memberId
        ]
    )


    return {
        equipped: true,
        cardId
    }
}


async function activateSpecialCard(
    conn,
    memberId,
    cardId,
    awardCode
) {

    const shouldEquip =
        await shouldAutoEquipSpecialCard(
            conn,
            memberId,
            awardCode
        )


    if (!shouldEquip) {

        return {
            equipped: false
        }
    }


    const result =
        await equipSpecialCard(
            conn,
            memberId,
            cardId
        )


    return {
        equipped:
            result.equipped === true
    }
}


async function getBestAdminIcon(
    conn,
    memberId,
    includeAdminOfMonth
) {

    let promoCondition =
        `promo_code = 'ADMIN_ICON'`

    if (includeAdminOfMonth) {

        promoCondition =
            `
            promo_code IN (
                'ADMIN_ICON',
                'ADMIN_OF_THE_MONTH'
            )
            `
    }


    const [cards] =
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
              AND family = 'ICON'
              AND ${promoCondition}

            ORDER BY
                CASE
                    WHEN promo_code =
                        'ADMIN_OF_THE_MONTH'
                        THEN 2
                    WHEN promo_code =
                        'ADMIN_ICON'
                        THEN 1
                    ELSE 0
                END DESC,
                rating DESC,
                obtained_at DESC,
                id DESC

            LIMIT 1

            FOR UPDATE
            `,
            [memberId]
        )


    return cards.length
        ? cards[0]
        : null
}


async function getBestPersonalCard(
    conn,
    memberId
) {

    const [cards] =
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
              AND family IN (
                  'PLAYER',
                  'HERO'
              )

            ORDER BY
                CASE
                    WHEN family = 'HERO'
                        THEN 2
                    WHEN family = 'PLAYER'
                        THEN 1
                    ELSE 0
                END DESC,
                rating DESC,
                obtained_at DESC,
                id DESC

            LIMIT 1

            FOR UPDATE
            `,
            [memberId]
        )


    return cards.length
        ? cards[0]
        : null
}


async function getBestEligibleCard(
    conn,
    memberId,
    memberType
) {

    if (memberType === 'OWNER') {

        const [ownerCards] =
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
                  AND family = 'ICON'
                  AND promo_code = 'OWNER_ICON'

                ORDER BY
                    rating DESC,
                    obtained_at DESC,
                    id DESC

                LIMIT 1

                FOR UPDATE
                `,
                [memberId]
            )


        if (ownerCards.length) {

            return ownerCards[0]
        }


        const activeAdminOfMonth =
            await hasActiveAdminOfMonthAward(
                conn,
                memberId
            )


        const adminCard =
            await getBestAdminIcon(
                conn,
                memberId,
                activeAdminOfMonth
            )


        if (adminCard) {

            return adminCard
        }
    }


    if (memberType === 'ADMIN') {

        const activeAdminOfMonth =
            await hasActiveAdminOfMonthAward(
                conn,
                memberId
            )


        const adminCard =
            await getBestAdminIcon(
                conn,
                memberId,
                activeAdminOfMonth
            )


        if (adminCard) {

            return adminCard
        }
    }


    return await getBestPersonalCard(
        conn,
        memberId
    )
}


async function restoreBestEligibleCard(
    conn,
    memberId
) {

    const memberType =
        await getActiveMemberType(
            conn,
            memberId
        )


    if (!memberType) {

        return {
            restored: false,
            reason:
                'MEMBER_NOT_FOUND'
        }
    }


    const card =
        await getBestEligibleCard(
            conn,
            memberId,
            memberType
        )


    if (!card) {

        return {
            restored: false,
            reason:
                'NO_ELIGIBLE_CARD'
        }
    }


    const result =
        await equipSpecialCard(
            conn,
            memberId,
            card.id
        )


    if (!result.equipped) {

        return {
            restored: false,
            reason:
                result.reason ||
                'EQUIP_FAILED'
        }
    }


    return {
        restored: true,

        cardId:
            card.id,

        family:
            card.family,

        promoCode:
            card.promo_code,

        rating:
            Number(
                card.rating
            ),

        memberType
    }
}


module.exports = {

    SPECIAL_CARD_RULES,

    getSpecialCardRule,

    isSpecialCardAward,

    getBestMemberCardRating,

    calculateSpecialCardRating,

    shouldAutoEquipSpecialCard,

    equipSpecialCard,

    activateSpecialCard,

    hasActiveAdminOfMonthAward,

    getBestEligibleCard,

    restoreBestEligibleCard

}
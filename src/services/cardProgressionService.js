const { pool } =
    require('../database/mysql')


const clamp = (value, min = 0, max = 99) =>
    Math.max(
        min,
        Math.min(max, Math.round(value))
    )

const scaleStat = (value, target99) => {

    const safeValue =
        Math.max(0, Number(value) || 0)

    const progress =
        Math.min(
            1,
            Math.sqrt(
                safeValue / target99
            )
        )

    return clamp(
        75 + (24 * progress),
        75,
        99
    )
}


async function getProgressionData(memberId) {

    const [rows] = await pool.execute(
        `
        SELECT
            m.id,
            m.joined_at,

            s.valid_messages,
            s.commands_used,
            s.interactions,
            s.active_days,
            s.current_streak,
            s.longest_streak

        FROM kb_members m

        INNER JOIN kb_member_stats s
            ON s.member_id = m.id

        WHERE m.id = ?

        LIMIT 1
        `,
        [memberId]
    )


    if (!rows.length) {

        throw new Error(
            `No existen estadísticas para member_id ${memberId}`
        )
    }


    const data = rows[0]

    const joinedAt =
        new Date(data.joined_at)

    const now =
        new Date()

    const tenureDays =
        Math.max(
            0,
            Math.floor(
                (
                    now.getTime() -
                    joinedAt.getTime()
                ) /
                86400000
            )
        )

    const msg =
        scaleStat(
            data.valid_messages,
            10000
        )

    const act =
        scaleStat(
            data.active_days,
            365
        )

    const cmd =
        scaleStat(
            data.commands_used,
            1000
        )

    const rac =
        scaleStat(
            data.longest_streak,
            100
        )

    const ant =
        scaleStat(
            tenureDays,
            730
        )

    const int =
        scaleStat(
            data.interactions,
            1000
        )

    const rating =
        clamp(
            (
                msg * 0.25 +
                act * 0.25 +
                cmd * 0.10 +
                rac * 0.15 +
                ant * 0.10 +
                int * 0.15
            ),
            75,
            99
        )


    return {

        memberId,

        raw: {
            validMessages:
                Number(
                    data.valid_messages || 0
                ),

            commandsUsed:
                Number(
                    data.commands_used || 0
                ),

            interactions:
                Number(
                    data.interactions || 0
                ),

            activeDays:
                Number(
                    data.active_days || 0
                ),

            currentStreak:
                Number(
                    data.current_streak || 0
                ),

            longestStreak:
                Number(
                    data.longest_streak || 0
                ),

            tenureDays
        },

        stats: {
            msg,
            act,
            cmd,
            rac,
            ant,
            int
        },

        rating
    }
}

const CARD_TIERS = [

    {
        minRating: 75,
        maxRating: 82,
        tier: 1,
        promoCode: 'GOLD_RARE',
        cardName: 'Gold Rare'
    },

    {
        minRating: 83,
        maxRating: 86,
        tier: 2,
        promoCode: 'PROGRESSION_1',
        cardName: 'Rising Star'
    },

    {
        minRating: 87,
        maxRating: 90,
        tier: 3,
        promoCode: 'PROGRESSION_2',
        cardName: 'Breakthrough'
    },

    {
        minRating: 91,
        maxRating: 94,
        tier: 4,
        promoCode: 'PROGRESSION_3',
        cardName: 'Elite'
    },

    {
        minRating: 95,
        maxRating: 97,
        tier: 5,
        promoCode: 'PROGRESSION_4',
        cardName: 'Master'
    },

    {
        minRating: 98,
        maxRating: 99,
        tier: 6,
        promoCode: 'PROGRESSION_5',
        cardName: 'Ultimate'
    }

]


function getCardTier(rating) {

    return (
        CARD_TIERS.find(
            tier =>
                rating >= tier.minRating &&
                rating <= tier.maxRating
        ) ||
        CARD_TIERS[0]
    )
}

module.exports = {
    getProgressionData,
    getCardTier,
    CARD_TIERS
}
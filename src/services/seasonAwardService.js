const { pool } =
    require('../database/mysql')

const {
    grantAward
} = require(
    '../database/repositories/awardRepository'
)

const {
    deliverAwardRewards
} = require(
    './awardDeliveryService'
)

async function deliverGrantedAward(
    awardResult
) {

    if (
        !awardResult?.granted ||
        !awardResult?.memberAwardId
    ) {

        return {
            attempted: false,
            delivered: 0,
            failed: 0,
            result: null
        }
    }


    try {

        const delivery =
            await deliverAwardRewards(
                awardResult.memberAwardId
            )


        return {
            attempted: true,
            delivered:
                delivery.delivered || 0,
            failed:
                delivery.failed || 0,
            result:
                delivery
        }


    } catch (error) {

        return {
            attempted: true,
            delivered: 0,
            failed: 1,
            error:
                String(
                    error.message ||
                    error
                )
        }
    }
}

async function processSeasonAwards(
    seasonId
) {

    const [seasonRows] =
        await pool.execute(
            `
            SELECT
                id,
                code,
                name,
                status

            FROM kb_seasons

            WHERE id = ?

            LIMIT 1
            `,
            [seasonId]
        )


    if (!seasonRows.length) {

        return {
            processed: false,
            reason:
                'SEASON_NOT_FOUND',
            awards: []
        }
    }


    const season =
        seasonRows[0]


    if (
        season.status !==
        'FINISHED'
    ) {

        return {
            processed: false,
            reason:
                'SEASON_NOT_FINISHED',
            season,
            awards: []
        }
    }


    const [participants] =
        await pool.execute(
            `
            SELECT
                ss.id,
                ss.member_id,
                ss.valid_messages,
                ss.commands_used,
                ss.interactions,
                ss.active_days,
                ss.current_streak,
                ss.longest_streak,
                ss.events_participated,
                ss.events_won,
                ss.final_score,
                ss.final_rank,
                ss.finalized_at,
                m.display_name

            FROM kb_member_season_stats ss

            INNER JOIN kb_members m
                ON m.id =
                    ss.member_id

            WHERE ss.season_id = ?

              AND ss.finalized_at
                    IS NOT NULL

              AND ss.final_rank
                    IS NOT NULL

            ORDER BY
                ss.final_rank ASC,
                ss.member_id ASC
            `,
            [seasonId]
        )


    if (!participants.length) {

        return {
            processed: false,
            reason:
                'NO_FINALIZED_PARTICIPANTS',
            season,
            awards: []
        }
    }


    const results = []

    const memberOfMonth =
        participants.find(
            participant =>
                Number(
                    participant.final_rank
                ) === 1
        )


    if (memberOfMonth) {

        const result =
            await grantAward(
                memberOfMonth.member_id,
                'MEMBER_OF_THE_MONTH',
                {
                    seasonId,

                    rankingPosition: 1,

                    reason:
                        `Primer lugar general de ${season.name}`
                }
            )


        const rewardDelivery =
            await deliverGrantedAward(
                result
            )


        results.push({
            code:
                'MEMBER_OF_THE_MONTH',

            memberId:
                memberOfMonth.member_id,

            displayName:
                memberOfMonth.display_name,

            granted:
                result.granted,

            reason:
                result.reason,

            memberAwardId:
                result.memberAwardId ||
                null,

            rewards:
                rewardDelivery
        })
    }

    const definitions = [

        {
            code:
                'TOP_ACTIVITY',

            field:
                'active_days'
        },

        {
            code:
                'TOP_MESSAGES',

            field:
                'valid_messages'
        },

        {
            code:
                'TOP_INTERACTIONS',

            field:
                'interactions'
        },

        {
            code:
                'LONGEST_STREAK',

            field:
                'longest_streak'
        }
    ]


    for (
        const definition
        of definitions
    ) {

        const ranking =
            [...participants].sort(
                (a, b) => {

                    const difference =
                        Number(
                            b[
                                definition.field
                            ] || 0
                        ) -
                        Number(
                            a[
                                definition.field
                            ] || 0
                        )


                    if (
                        difference !== 0
                    ) {

                        return difference
                    }


                    const rankDifference =
                        Number(
                            a.final_rank
                        ) -
                        Number(
                            b.final_rank
                        )


                    if (
                        rankDifference !== 0
                    ) {

                        return (
                            rankDifference
                        )
                    }


                    return (
                        Number(
                            a.member_id
                        ) -
                        Number(
                            b.member_id
                        )
                    )
                }
            )


        const winner =
            ranking[0]

        if (
            !winner ||
            Number(
                winner[
                    definition.field
                ] || 0
            ) <= 0
        ) {

            results.push({
                code:
                    definition.code,

                granted: false,

                reason:
                    'NO_QUALIFYING_MEMBER',

                rewards: {
                    attempted: false,
                    delivered: 0,
                    failed: 0,
                    result: null
                }
            })

            continue
        }


        const result =
            await grantAward(
                winner.member_id,
                definition.code,
                {
                    seasonId,

                    rankingPosition: 1,

                    reason:
                        `${definition.code}: ` +
                        `${winner[definition.field]} ` +
                        `en ${season.name}`
                }
            )


        const rewardDelivery =
            await deliverGrantedAward(
                result
            )


        results.push({
            code:
                definition.code,

            memberId:
                winner.member_id,

            displayName:
                winner.display_name,

            value:
                Number(
                    winner[
                        definition.field
                    ]
                ),

            granted:
                result.granted,

            reason:
                result.reason,

            memberAwardId:
                result.memberAwardId ||
                null,

            rewards:
                rewardDelivery
        })
    }

    const awardsGranted =
        results.filter(
            item =>
                item.granted === true
        ).length


    const rewardsDelivered =
        results.reduce(
            (total, item) =>
                total +
                Number(
                    item.rewards
                        ?.delivered || 0
                ),
            0
        )


    const rewardFailures =
        results.reduce(
            (total, item) =>
                total +
                Number(
                    item.rewards
                        ?.failed || 0
                ),
            0
        )


    return {
        processed: true,
        reason:
            'PROCESSED',

        season,

        summary: {
            participants:
                participants.length,

            awardsGranted,

            rewardsDelivered,

            rewardFailures
        },

        awards:
            results
    }
}


module.exports = {
    processSeasonAwards
}
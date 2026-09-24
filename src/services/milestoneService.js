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


async function deliverMilestoneReward(
    awardResult
) {

    if (
        !awardResult?.granted ||
        !awardResult?.memberAwardId
    ) {

        return {
            attempted: false,
            delivered: 0,
            failed: 0
        }
    }


    try {

        const result =
            await deliverAwardRewards(
                awardResult.memberAwardId
            )


        return {
            attempted: true,
            ...result
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


async function checkMemberMilestones(
    memberId
) {

    const [rows] =
        await pool.execute(
            `
            SELECT
                id,
                display_name,
                member_type,
                group_joined_at,
                CASE
                    WHEN group_joined_at IS NULL
                    THEN NULL
                    ELSE TIMESTAMPDIFF(
                        DAY,
                        group_joined_at,
                        NOW()
                    )
                END AS tenure_days

            FROM kb_members

            WHERE id = ?
              AND active = 1

            LIMIT 1
            `,
            [
                memberId
            ]
        )


    const member =
        rows[0]


    if (!member) {

        return {
            processed: false,
            reason:
                'MEMBER_NOT_FOUND',
            granted: []
        }
    }


    if (!member.group_joined_at) {

        return {
            processed: false,
            reason:
                'GROUP_JOIN_DATE_UNKNOWN',
            memberId:
                member.id,
            granted: []
        }
    }


    const tenureDays =
        Number(
            member.tenure_days || 0
        )


    const granted = []


    if (tenureDays >= 365) {

        const result =
            await grantAward(
                memberId,
                'ONE_YEAR_VETERAN',
                {
                    reason:
                        '1 año de antigüedad en la comunidad'
                }
            )


        if (result.granted) {

            const rewards =
                await deliverMilestoneReward(
                    result
                )


            granted.push({
                code:
                    'ONE_YEAR_VETERAN',

                name:
                    result.award.name,

                memberAwardId:
                    result.memberAwardId,

                rewards
            })
        }
    }


    if (tenureDays >= 730) {

        const result =
            await grantAward(
                memberId,
                'TWO_YEAR_VETERAN',
                {
                    reason:
                        '2 años de antigüedad en la comunidad'
                }
            )


        if (result.granted) {

            const rewards =
                await deliverMilestoneReward(
                    result
                )


            granted.push({
                code:
                    'TWO_YEAR_VETERAN',

                name:
                    result.award.name,

                memberAwardId:
                    result.memberAwardId,

                rewards
            })
        }
    }


    return {
        processed: true,
        reason:
            'COMPLETED',

        memberId:
            member.id,

        groupJoinedAt:
            member.group_joined_at,

        tenureDays,

        granted
    }
}


module.exports = {
    checkMemberMilestones
}
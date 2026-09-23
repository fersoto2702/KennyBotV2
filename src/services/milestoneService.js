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


async function checkMemberMilestones(
    memberId
) {

    const [rows] =
        await pool.execute(
            `
            SELECT
                id,
                display_name,
                joined_at,
                TIMESTAMPDIFF(
                    DAY,
                    joined_at,
                    NOW()
                ) AS tenure_days

            FROM kb_members

            WHERE id = ?

            LIMIT 1
            `,
            [memberId]
        )


    if (!rows.length) {

        return {
            memberId,
            tenureDays: 0,
            granted: []
        }
    }


    const member =
        rows[0]

    const tenureDays =
        Math.max(
            0,
            Number(
                member.tenure_days || 0
            )
        )

    const granted = []


    if (tenureDays >= 365) {

        const result =
            await grantAward(
                memberId,
                'ONE_YEAR_VETERAN',
                {
                    reason:
                        'Alcanzó 1 año de antigüedad en KennyBot'
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
                        'Alcanzó 2 años de antigüedad en KennyBot'
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
        memberId,

        displayName:
            member.display_name,

        tenureDays,

        granted
    }
}


module.exports = {
    checkMemberMilestones
}
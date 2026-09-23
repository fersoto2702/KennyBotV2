const { pool } = require('../mysql')


async function getAwardByCode(code, conn = pool) {

    const [rows] = await conn.execute(
        `
        SELECT
            id,
            code,
            name,
            description,
            award_type,
            repeatable,
            enabled,
            display_order
        FROM kb_awards
        WHERE code = ?
          AND enabled = 1
        LIMIT 1
        `,
        [code]
    )

    return rows[0] || null
}


async function getMemberAwards(memberId) {

    const [rows] = await pool.execute(
        `
        SELECT
            ma.id,
            ma.member_id,
            ma.award_id,
            ma.season_id,
            ma.reason,
            ma.ranking_position,
            ma.awarded_at,

            a.code,
            a.name,
            a.description,
            a.award_type,
            a.repeatable,

            s.code AS season_code,
            s.name AS season_name

        FROM kb_member_awards ma

        INNER JOIN kb_awards a
            ON a.id = ma.award_id

        LEFT JOIN kb_seasons s
            ON s.id = ma.season_id

        WHERE ma.member_id = ?
          AND ma.enabled = 1
          AND a.enabled = 1

        ORDER BY
            ma.awarded_at DESC,
            ma.id DESC
        `,
        [memberId]
    )

    return rows
}


async function grantAward(
    memberId,
    awardCode,
    {
        seasonId = null,
        reason = null,
        rankingPosition = null
    } = {}
) {

    const conn =
        await pool.getConnection()

    try {

        await conn.beginTransaction()

        const [members] =
            await conn.execute(
                `
                SELECT id
                FROM kb_members
                WHERE id = ?
                FOR UPDATE
                `,
                [memberId]
            )


        if (!members.length) {

            await conn.rollback()

            return {
                granted: false,
                reason: 'MEMBER_NOT_FOUND'
            }
        }


        const award =
            await getAwardByCode(
                awardCode,
                conn
            )


        if (!award) {

            await conn.rollback()

            return {
                granted: false,
                reason: 'AWARD_NOT_FOUND'
            }
        }


        const isRepeatable =
            Number(award.repeatable) === 1

        if (!isRepeatable) {

            const [existing] =
                await conn.execute(
                    `
                    SELECT id
                    FROM kb_member_awards
                    WHERE member_id = ?
                      AND award_id = ?
                      AND enabled = 1
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        memberId,
                        award.id
                    ]
                )


            if (existing.length) {

                await conn.commit()

                return {
                    granted: false,
                    reason: 'ALREADY_GRANTED',
                    memberAwardId:
                        existing[0].id,
                    award
                }
            }

        }

        else if (
            award.award_type === 'SEASON'
        ) {

            if (seasonId === null) {

                await conn.rollback()

                return {
                    granted: false,
                    reason: 'SEASON_REQUIRED',
                    award
                }
            }


            const [existing] =
                await conn.execute(
                    `
                    SELECT id
                    FROM kb_member_awards
                    WHERE member_id = ?
                      AND award_id = ?
                      AND season_id = ?
                      AND enabled = 1
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        memberId,
                        award.id,
                        seasonId
                    ]
                )


            if (existing.length) {

                await conn.commit()

                return {
                    granted: false,
                    reason:
                        'ALREADY_GRANTED_THIS_SEASON',
                    memberAwardId:
                        existing[0].id,
                    award
                }
            }

        }

        else {

            if (seasonId !== null) {

                const [existing] =
                    await conn.execute(
                        `
                        SELECT id
                        FROM kb_member_awards
                        WHERE member_id = ?
                          AND award_id = ?
                          AND season_id = ?
                          AND enabled = 1
                        LIMIT 1
                        FOR UPDATE
                        `,
                        [
                            memberId,
                            award.id,
                            seasonId
                        ]
                    )


                if (existing.length) {

                    await conn.commit()

                    return {
                        granted: false,
                        reason:
                            'ALREADY_GRANTED_THIS_SEASON',
                        memberAwardId:
                            existing[0].id,
                        award
                    }
                }
            }
        }

        const [result] =
            await conn.execute(
                `
                INSERT INTO kb_member_awards (
                    member_id,
                    award_id,
                    season_id,
                    reason,
                    ranking_position
                )
                VALUES (?, ?, ?, ?, ?)
                `,
                [
                    memberId,
                    award.id,
                    seasonId,
                    reason,
                    rankingPosition
                ]
            )


        const memberAwardId =
            result.insertId


        await conn.commit()


        return {
            granted: true,
            reason: 'GRANTED',
            memberAwardId,
            award
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
    getAwardByCode,
    getMemberAwards,
    grantAward
}
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


function normalizeAwardCode(
    code
) {

    const value =
        String(
            code || ''
        )
            .trim()
            .toUpperCase()


    if (!value) {

        throw new Error(
            'awardCode es obligatorio'
        )

    }


    return value

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


function normalizeNullableText(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return null

    }


    const text =
        String(
            value
        )
            .trim()


    return text ||
        null

}


async function getAwardByCode(
    code,
    conn = pool
) {

    const awardCode =
        normalizeAwardCode(
            code
        )


    const [
        rows
    ] =
        await conn.execute(

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

            [
                awardCode
            ]

        )


    return (
        rows?.[0] ||
        null
    )

}


async function getMemberAwards(
    memberId
) {

    const id =
        validatePositiveInteger(
            memberId,
            'memberId'
        )


    const [
        rows
    ] =
        await pool.execute(

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

            [
                id
            ]

        )


    return Array.isArray(rows)
        ? rows
        : []

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

    const id =
        validatePositiveInteger(
            memberId,
            'memberId'
        )


    const code =
        normalizeAwardCode(
            awardCode
        )


    const normalizedSeasonId =
        normalizeNullableInteger(
            seasonId,
            'seasonId'
        )


    const normalizedRankingPosition =
        normalizeNullableInteger(
            rankingPosition,
            'rankingPosition'
        )


    const normalizedReason =
        normalizeNullableText(
            reason
        )


    const conn =
        await pool.getConnection()


    let transactionFinished =
        false


    try {

        await conn.beginTransaction()


        /* ─────────────────────────────
           MIEMBRO
        ───────────────────────────── */

        const [
            members
        ] =
            await conn.execute(

                `
                SELECT
                    id
                FROM kb_members
                WHERE id = ?
                FOR UPDATE
                `,

                [
                    id
                ]

            )


        if (
            !Array.isArray(members) ||
            members.length === 0
        ) {

            await conn.rollback()

            transactionFinished =
                true


            return {

                granted:
                    false,

                reason:
                    'MEMBER_NOT_FOUND'

            }

        }


        /* ─────────────────────────────
           PREMIO
        ───────────────────────────── */

        const award =
            await getAwardByCode(

                code,

                conn

            )


        if (!award) {

            await conn.rollback()

            transactionFinished =
                true


            return {

                granted:
                    false,

                reason:
                    'AWARD_NOT_FOUND'

            }

        }


        /* ─────────────────────────────
           TEMPORADA
        ───────────────────────────── */

        if (
            normalizedSeasonId !== null
        ) {

            const [
                seasons
            ] =
                await conn.execute(

                    `
                    SELECT
                        id,
                        code,
                        name
                    FROM kb_seasons
                    WHERE id = ?
                    LIMIT 1
                    `,

                    [
                        normalizedSeasonId
                    ]

                )


            if (
                !Array.isArray(seasons) ||
                seasons.length === 0
            ) {

                await conn.rollback()

                transactionFinished =
                    true


                return {

                    granted:
                        false,

                    reason:
                        'SEASON_NOT_FOUND',

                    award

                }

            }

        }


        const isRepeatable =
            Number(
                award.repeatable
            ) === 1


        /* ─────────────────────────────
           NO REPETIBLE
        ───────────────────────────── */

        if (
            !isRepeatable
        ) {

            const [
                existing
            ] =
                await conn.execute(

                    `
                    SELECT
                        id
                    FROM kb_member_awards
                    WHERE member_id = ?
                      AND award_id = ?
                      AND enabled = 1
                    LIMIT 1
                    FOR UPDATE
                    `,

                    [
                        id,
                        award.id
                    ]

                )


            if (
                existing.length
            ) {

                await conn.commit()

                transactionFinished =
                    true


                return {

                    granted:
                        false,

                    reason:
                        'ALREADY_GRANTED',

                    memberAwardId:
                        existing[0].id,

                    award

                }

            }

        }


        /* ─────────────────────────────
           PREMIO DE TEMPORADA
        ───────────────────────────── */

        else if (
            award.award_type ===
            'SEASON'
        ) {

            if (
                normalizedSeasonId === null
            ) {

                await conn.rollback()

                transactionFinished =
                    true


                return {

                    granted:
                        false,

                    reason:
                        'SEASON_REQUIRED',

                    award

                }

            }


            const [
                existing
            ] =
                await conn.execute(

                    `
                    SELECT
                        id
                    FROM kb_member_awards
                    WHERE member_id = ?
                      AND award_id = ?
                      AND season_id = ?
                      AND enabled = 1
                    LIMIT 1
                    FOR UPDATE
                    `,

                    [
                        id,
                        award.id,
                        normalizedSeasonId
                    ]

                )


            if (
                existing.length
            ) {

                await conn.commit()

                transactionFinished =
                    true


                return {

                    granted:
                        false,

                    reason:
                        'ALREADY_GRANTED_THIS_SEASON',

                    memberAwardId:
                        existing[0].id,

                    award

                }

            }

        }


        /* ─────────────────────────────
           REPETIBLE CON TEMPORADA
        ───────────────────────────── */

        else if (
            normalizedSeasonId !== null
        ) {

            const [
                existing
            ] =
                await conn.execute(

                    `
                    SELECT
                        id
                    FROM kb_member_awards
                    WHERE member_id = ?
                      AND award_id = ?
                      AND season_id = ?
                      AND enabled = 1
                    LIMIT 1
                    FOR UPDATE
                    `,

                    [
                        id,
                        award.id,
                        normalizedSeasonId
                    ]

                )


            if (
                existing.length
            ) {

                await conn.commit()

                transactionFinished =
                    true


                return {

                    granted:
                        false,

                    reason:
                        'ALREADY_GRANTED_THIS_SEASON',

                    memberAwardId:
                        existing[0].id,

                    award

                }

            }

        }


        /* ─────────────────────────────
           OTORGAR
        ───────────────────────────── */

        const [
            result
        ] =
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
                    id,
                    award.id,
                    normalizedSeasonId,
                    normalizedReason,
                    normalizedRankingPosition
                ]

            )


        const memberAwardId =
            result.insertId


        if (
            !memberAwardId
        ) {

            throw new Error(
                'No se pudo obtener el ID del premio otorgado'
            )

        }


        await conn.commit()

        transactionFinished =
            true


        return {

            granted:
                true,

            reason:
                'GRANTED',

            memberAwardId,

            award

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


module.exports = {

    getAwardByCode,

    getMemberAwards,

    grantAward

}
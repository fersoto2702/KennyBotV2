const {
    pool
} = require('../mysql')

async function getUserPackById(
    packId,
    memberId,
    conn = pool
) {
    const [rows] =
        await conn.execute(
            `
            SELECT
                up.id,
                up.member_id,
                up.pack_type_id,
                pt.code AS pack_code,
                pt.name AS pack_name,
                up.pool_id,
                pp.code AS pool_code,
                pp.name AS pool_name,
                up.status,
                up.obtained_reason,
                up.obtained_at,
                up.opened_at,
                up.claimed_at,
                up.expires_at
            FROM ut_user_packs up
            INNER JOIN ut_pack_types pt
                ON pt.id = up.pack_type_id
            INNER JOIN ut_pack_pools pp
                ON pp.id = up.pool_id
            WHERE up.id = ?
              AND up.member_id = ?
            LIMIT 1
            `,
            [
                packId,
                memberId
            ]
        )

    return rows[0] || null
}

async function getUserPacks(
    memberId,
    options = {},
    conn = pool
) {
    const {
        includeFinished = false,
        limit = 50
    } = options

    const safeLimit =
        Math.max(
            1,
            Math.min(
                100,
                Number(limit) || 50
            )
        )

    let sql = `
        SELECT
            up.id,
            up.member_id,
            up.pack_type_id,
            pt.code AS pack_code,
            pt.name AS pack_name,
            up.pool_id,
            pp.code AS pool_code,
            pp.name AS pool_name,
            up.status,
            up.obtained_reason,
            up.obtained_at,
            up.opened_at,
            up.claimed_at,
            up.expires_at
        FROM ut_user_packs up
        INNER JOIN ut_pack_types pt
            ON pt.id = up.pack_type_id
        INNER JOIN ut_pack_pools pp
            ON pp.id = up.pool_id
        WHERE up.member_id = ?
    `

    const params = [
        memberId
    ]

    if (!includeFinished) {
        sql += `
            AND up.status IN (
                'UNOPENED',
                'PENDING_SELECTION'
            )
        `
    }

    sql += `
        ORDER BY
            CASE up.status
                WHEN 'PENDING_SELECTION' THEN 1
                WHEN 'UNOPENED' THEN 2
                ELSE 3
            END,
            up.obtained_at DESC,
            up.id DESC
        LIMIT ${safeLimit}
    `

    const [rows] =
        await conn.execute(
            sql,
            params
        )

    return rows
}

async function getUserPackCounts(
    memberId,
    conn = pool
) {
    const [rows] =
        await conn.execute(
            `
            SELECT
                COUNT(*) AS total,
                SUM(
                    status = 'UNOPENED'
                ) AS unopened,
                SUM(
                    status = 'PENDING_SELECTION'
                ) AS pending_selection,
                SUM(
                    status = 'CLAIMED'
                ) AS claimed,
                SUM(
                    status = 'EXPIRED'
                ) AS expired,
                SUM(
                    status = 'CANCELLED'
                ) AS cancelled
            FROM ut_user_packs
            WHERE member_id = ?
            `,
            [
                memberId
            ]
        )

    const row =
        rows[0] || {}

    return {
        total:
            Number(row.total || 0),
        unopened:
            Number(row.unopened || 0),
        pendingSelection:
            Number(
                row.pending_selection || 0
            ),
        claimed:
            Number(row.claimed || 0),
        expired:
            Number(row.expired || 0),
        cancelled:
            Number(row.cancelled || 0)
    }
}

module.exports = {
    getUserPackById,
    getUserPacks,
    getUserPackCounts
}
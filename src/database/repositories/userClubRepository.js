const { pool } = require('../mysql')

async function getClubCount(memberId) {
    const [rows] = await pool.execute(
        `
        SELECT COUNT(*) AS total
        FROM ut_user_club uc
        INNER JOIN ut_cards c
            ON c.id = uc.card_id
        WHERE uc.member_id = ?
          AND uc.enabled = 1
          AND c.enabled = 1
        `,
        [memberId]
    )

    return Number(rows[0]?.total || 0)
}

async function getClubCards(
    memberId,
    page = 1,
    pageSize = 10
) {
    const numericPage =
        Math.max(Number(page) || 1, 1)

    const numericPageSize =
        Math.max(
            Math.min(
                Number(pageSize) || 10,
                50
            ),
            1
        )

    const offset =
        (numericPage - 1) *
        numericPageSize

    const [rows] = await pool.execute(
        `
        SELECT
            uc.id AS club_entry_id,
            uc.source,
            uc.source_pack_id,
            uc.obtained_at,
            c.id AS card_id,
            c.card_key,
            c.rating,
            c.position,
            c.family,
            c.club,
            c.league,
            c.image_path,
            c.pac,
            c.sho,
            c.pas,
            c.dri,
            c.def,
            c.phy,
            c.div_stat,
            c.han,
            c.kic,
            c.ref_stat,
            c.spd,
            c.pos_stat,
            p.name AS player_name,
            p.known_as,
            p.nationality,
            g.code AS game_code,
            g.name AS game_name,
            pr.code AS promo_code,
            pr.name AS promo_name
        FROM ut_user_club uc
        INNER JOIN ut_cards c
            ON c.id = uc.card_id
        INNER JOIN ut_players p
            ON p.id = c.player_id
        INNER JOIN ut_games g
            ON g.id = c.game_id
        INNER JOIN ut_promos pr
            ON pr.id = c.promo_id
        WHERE uc.member_id = ?
          AND uc.enabled = 1
          AND c.enabled = 1
        ORDER BY
            c.rating DESC,
            uc.obtained_at DESC,
            uc.id DESC
        LIMIT ?
        OFFSET ?
        `,
        [
            memberId,
            numericPageSize,
            offset
        ]
    )

    return rows
}

async function getUserClub(
    memberId,
    page = 1,
    pageSize = 10
) {
    const numericPage =
        Math.max(Number(page) || 1, 1)

    const total =
        await getClubCount(memberId)

    const totalPages =
        Math.max(
            Math.ceil(total / pageSize),
            1
        )

    if (
        total > 0 &&
        numericPage > totalPages
    ) {
        return {
            cards: [],
            total,
            page: numericPage,
            pageSize,
            totalPages
        }
    }

    const cards =
        total > 0
            ? await getClubCards(
                memberId,
                numericPage,
                pageSize
            )
            : []

    return {
        cards,
        total,
        page: numericPage,
        pageSize,
        totalPages
    }
}

module.exports = {
    getClubCount,
    getClubCards,
    getUserClub
}
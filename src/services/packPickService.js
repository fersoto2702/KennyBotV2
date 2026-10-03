const { pool } = require('../database/mysql')

async function getPackForUpdate(
    connection,
    packId,
    memberId
) {
    const [rows] = await connection.execute(
        `
        SELECT
            up.id,
            up.member_id,
            up.pack_type_id,
            up.pool_id,
            up.status,
            up.opened_at,
            up.claimed_at,
            up.expires_at,
            pt.code AS pack_code,
            pt.name AS pack_name,
            pt.pick_count,
            pt.choose_count
        FROM ut_user_packs up
        INNER JOIN ut_pack_types pt
            ON pt.id = up.pack_type_id
        WHERE up.id = ?
          AND up.member_id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [
            packId,
            memberId
        ]
    )

    return rows[0] || null
}

async function getPickForUpdate(
    connection,
    packId,
    position
) {
    const [rows] = await connection.execute(
        `
        SELECT
            pp.id,
            pp.user_pack_id,
            pp.card_id,
            pp.pick_position,
            pp.selected,
            pp.selected_at,
            c.rating,
            c.position,
            c.family,
            c.club,
            c.league,
            c.image_path,
            p.name AS player_name,
            p.known_as,
            g.code AS game_code,
            pr.code AS promo_code,
            pr.name AS promo_name
        FROM ut_pack_picks pp
        INNER JOIN ut_cards c
            ON c.id = pp.card_id
        INNER JOIN ut_players p
            ON p.id = c.player_id
        INNER JOIN ut_games g
            ON g.id = c.game_id
        INNER JOIN ut_promos pr
            ON pr.id = c.promo_id
        WHERE pp.user_pack_id = ?
          AND pp.pick_position = ?
        LIMIT 1
        FOR UPDATE
        `,
        [
            packId,
            position
        ]
    )

    return rows[0] || null
}

async function getSelectedCount(
    connection,
    packId
) {
    const [rows] = await connection.execute(
        `
        SELECT COUNT(*) AS total
        FROM ut_pack_picks
        WHERE user_pack_id = ?
          AND selected = 1
        `,
        [packId]
    )

    return Number(rows[0]?.total || 0)
}

async function addCardToClub(
    connection,
    memberId,
    cardId,
    packId
) {
    const [result] = await connection.execute(
        `
        INSERT INTO ut_user_club (
            member_id,
            card_id,
            source,
            source_pack_id
        )
        VALUES (?, ?, 'PACK', ?)
        `,
        [
            memberId,
            cardId,
            packId
        ]
    )

    return result.insertId
}

async function claimPick(
    memberId,
    packId,
    position
) {
    const numericMemberId =
        Number(memberId)

    const numericPackId =
        Number(packId)

    const numericPosition =
        Number(position)

    if (
        !Number.isInteger(numericMemberId) ||
        numericMemberId <= 0
    ) {
        throw new Error(
            'memberId inválido.'
        )
    }

    if (
        !Number.isInteger(numericPackId) ||
        numericPackId <= 0
    ) {
        throw new Error(
            'packId inválido.'
        )
    }

    if (
        !Number.isInteger(numericPosition) ||
        numericPosition <= 0
    ) {
        throw new Error(
            'La opción seleccionada no es válida.'
        )
    }

    const connection =
        await pool.getConnection()

    try {
        await connection.beginTransaction()

        const pack =
            await getPackForUpdate(
                connection,
                numericPackId,
                numericMemberId
            )

        if (!pack) {
            throw new Error(
                'El Player Pick no existe o no te pertenece.'
            )
        }

        if (pack.status === 'UNOPENED') {
            throw new Error(
                'Primero debes abrir este Player Pick.'
            )
        }

        if (pack.status === 'CLAIMED') {
            throw new Error(
                'Este Player Pick ya fue reclamado.'
            )
        }

        if (pack.status === 'EXPIRED') {
            throw new Error(
                'Este Player Pick ha expirado.'
            )
        }

        if (pack.status === 'CANCELLED') {
            throw new Error(
                'Este Player Pick fue cancelado.'
            )
        }

        if (
            pack.status !==
            'PENDING_SELECTION'
        ) {
            throw new Error(
                `Estado de Player Pick no válido: ${pack.status}`
            )
        }

        if (
            pack.expires_at &&
            new Date(pack.expires_at).getTime() <=
                Date.now()
        ) {
            await connection.execute(
                `
                UPDATE ut_user_packs
                SET status = 'EXPIRED'
                WHERE id = ?
                `,
                [numericPackId]
            )

            await connection.commit()

            return {
                status: 'EXPIRED',
                pack
            }
        }

        if (
            numericPosition >
            Number(pack.pick_count)
        ) {
            throw new Error(
                `La opción debe estar entre 1 y ${pack.pick_count}.`
            )
        }

        const selectedCount =
            await getSelectedCount(
                connection,
                numericPackId
            )

        if (
            selectedCount >=
            Number(pack.choose_count)
        ) {
            throw new Error(
                'Ya seleccionaste todas las cartas permitidas de este Player Pick.'
            )
        }

        const pick =
            await getPickForUpdate(
                connection,
                numericPackId,
                numericPosition
            )

        if (!pick) {
            throw new Error(
                `La opción ${numericPosition} no existe en este Player Pick.`
            )
        }

        if (pick.selected) {
            throw new Error(
                'Esta opción ya fue seleccionada.'
            )
        }

        const clubEntryId =
            await addCardToClub(
                connection,
                numericMemberId,
                pick.card_id,
                numericPackId
            )

        await connection.execute(
            `
            UPDATE ut_pack_picks
            SET
                selected = 1,
                selected_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND selected = 0
            `,
            [pick.id]
        )

        const newSelectedCount =
            selectedCount + 1

        const completed =
            newSelectedCount >=
            Number(pack.choose_count)

        if (completed) {
            await connection.execute(
                `
                UPDATE ut_user_packs
                SET
                    status = 'CLAIMED',
                    claimed_at = CURRENT_TIMESTAMP
                WHERE id = ?
                `,
                [numericPackId]
            )
        }

        await connection.commit()

        return {
            status: completed
                ? 'CLAIMED'
                : 'PENDING_SELECTION',
            pack: {
                ...pack,
                status: completed
                    ? 'CLAIMED'
                    : 'PENDING_SELECTION'
            },
            pick,
            clubEntryId,
            selectedCount:
                newSelectedCount,
            chooseCount:
                Number(pack.choose_count),
            remaining:
                Math.max(
                    Number(pack.choose_count) -
                        newSelectedCount,
                    0
                )
        }
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}

module.exports = {
    claimPick
}
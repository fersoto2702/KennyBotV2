const { pool } = require('../database/mysql')

function weightedPick(cards) {
    const totalWeight = cards.reduce(
        (total, card) =>
            total + Number(card.effective_weight),
        0
    )

    if (totalWeight <= 0) {
        throw new Error(
            'El pool no contiene pesos válidos.'
        )
    }

    let random = Math.random() * totalWeight

    for (const card of cards) {
        random -= Number(card.effective_weight)

        if (random <= 0) {
            return card
        }
    }

    return cards[cards.length - 1]
}

function selectWeightedCards(cards, count) {
    const available = [...cards]
    const selected = []

    while (
        selected.length < count &&
        available.length > 0
    ) {
        const card = weightedPick(available)

        selected.push(card)

        const index = available.findIndex(
            item => item.id === card.id
        )

        if (index !== -1) {
            available.splice(index, 1)
        }
    }

    return selected
}

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
            up.obtained_reason,
            up.obtained_at,
            up.opened_at,
            up.claimed_at,
            up.expires_at,
            pt.code AS pack_code,
            pt.name AS pack_name,
            pt.pick_count,
            pt.choose_count,
            pt.enabled AS pack_type_enabled,
            pp.code AS pool_code,
            pp.name AS pool_name
        FROM ut_user_packs up
        INNER JOIN ut_pack_types pt
            ON pt.id = up.pack_type_id
        INNER JOIN ut_pack_pools pp
            ON pp.id = up.pool_id
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

async function getSavedPicks(
    connection,
    packId
) {
    const [rows] = await connection.execute(
        `
        SELECT
            pp.pick_position,
            pp.selected,
            pp.selected_at,
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
            g.code AS game_code,
            g.name AS game_name,
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
        ORDER BY pp.pick_position ASC
        `,
        [packId]
    )

    return rows
}

async function getEligibleCards(
    connection,
    poolId
) {
    const [rows] = await connection.execute(
        `
        SELECT
            c.id,
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
            g.code AS game_code,
            g.name AS game_name,
            pr.code AS promo_code,
            pr.name AS promo_name,
            (
                CAST(pc.weight AS DECIMAL(18,6)) *
                CAST(c.pack_weight AS DECIMAL(18,6))
            ) AS effective_weight
        FROM ut_pack_pool_cards pc
        INNER JOIN ut_cards c
            ON c.id = pc.card_id
        INNER JOIN ut_players p
            ON p.id = c.player_id
        INNER JOIN ut_games g
            ON g.id = c.game_id
        INNER JOIN ut_promos pr
            ON pr.id = c.promo_id
        WHERE pc.pool_id = ?
          AND pc.enabled = 1
          AND c.enabled = 1
          AND c.packable = 1
          AND p.enabled = 1
          AND g.enabled = 1
          AND pr.enabled = 1
          AND pc.weight > 0
          AND c.pack_weight > 0
        `,
        [poolId]
    )

    return rows
}

async function savePicks(
    connection,
    packId,
    cards
) {
    for (
        let index = 0;
        index < cards.length;
        index++
    ) {
        await connection.execute(
            `
            INSERT INTO ut_pack_picks (
                user_pack_id,
                card_id,
                pick_position
            )
            VALUES (?, ?, ?)
            `,
            [
                packId,
                cards[index].id,
                index + 1
            ]
        )
    }
}

async function openPack(
    memberId,
    packId
) {
    const numericMemberId = Number(memberId)
    const numericPackId = Number(packId)

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

        if (!pack.pack_type_enabled) {
            throw new Error(
                'Este tipo de Player Pick está deshabilitado.'
            )
        }

        if (
            pack.expires_at &&
            new Date(pack.expires_at).getTime() <=
                Date.now()
        ) {
            if (
                pack.status === 'UNOPENED' ||
                pack.status ===
                    'PENDING_SELECTION'
            ) {
                await connection.execute(
                    `
                    UPDATE ut_user_packs
                    SET status = 'EXPIRED'
                    WHERE id = ?
                    `,
                    [numericPackId]
                )
            }

            await connection.commit()

            return {
                status: 'EXPIRED',
                pack,
                picks: []
            }
        }

        if (
            pack.status ===
            'PENDING_SELECTION'
        ) {
            const picks =
                await getSavedPicks(
                    connection,
                    numericPackId
                )

            if (
                picks.length !==
                Number(pack.pick_count)
            ) {
                throw new Error(
                    'El Player Pick tiene una selección pendiente incompleta.'
                )
            }

            await connection.commit()

            return {
                status:
                    'PENDING_SELECTION',
                reused: true,
                pack,
                picks
            }
        }

        if (pack.status === 'CLAIMED') {
            const picks =
                await getSavedPicks(
                    connection,
                    numericPackId
                )

            await connection.commit()

            return {
                status: 'CLAIMED',
                pack,
                picks
            }
        }

        if (pack.status === 'EXPIRED') {
            await connection.commit()

            return {
                status: 'EXPIRED',
                pack,
                picks: []
            }
        }

        if (pack.status === 'CANCELLED') {
            await connection.commit()

            return {
                status: 'CANCELLED',
                pack,
                picks: []
            }
        }

        if (pack.status !== 'UNOPENED') {
            throw new Error(
                `Estado de Player Pick no válido: ${pack.status}`
            )
        }

        const existingPicks =
            await getSavedPicks(
                connection,
                numericPackId
            )

        if (existingPicks.length > 0) {
            throw new Error(
                'El Player Pick contiene opciones guardadas aunque figura como UNOPENED.'
            )
        }

        const eligibleCards =
            await getEligibleCards(
                connection,
                pack.pool_id
            )

        const pickCount =
            Number(pack.pick_count)

        if (
            eligibleCards.length <
            pickCount
        ) {
            throw new Error(
                `El pool ${pack.pool_name} necesita al menos ${pickCount} cartas elegibles y actualmente tiene ${eligibleCards.length}.`
            )
        }

        const selectedCards =
            selectWeightedCards(
                eligibleCards,
                pickCount
            )

        if (
            selectedCards.length !==
            pickCount
        ) {
            throw new Error(
                'No fue posible generar todas las opciones del Player Pick.'
            )
        }

        await savePicks(
            connection,
            numericPackId,
            selectedCards
        )

        await connection.execute(
            `
            UPDATE ut_user_packs
            SET
                status = 'PENDING_SELECTION',
                opened_at = COALESCE(
                    opened_at,
                    CURRENT_TIMESTAMP
                )
            WHERE id = ?
            `,
            [numericPackId]
        )

        const picks =
            await getSavedPicks(
                connection,
                numericPackId
            )

        await connection.commit()

        return {
            status:
                'PENDING_SELECTION',
            reused: false,
            pack: {
                ...pack,
                status:
                    'PENDING_SELECTION'
            },
            picks
        }
    } catch (error) {
        await connection.rollback()
        throw error
    } finally {
        connection.release()
    }
}

module.exports = {
    openPack
}
const { pool } = require('../database/mysql')

function clean(value) {
    if (value === undefined || value === null) return null

    const result = String(value).trim()

    return result || null
}

function normalizeCode(value) {
    const result = clean(value)

    if (!result) return null

    return result
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
}

function normalizeWeight(value, fallback = 1) {
    const number = Number(value)

    if (!Number.isFinite(number) || number <= 0) {
        return fallback
    }

    return number
}

async function getPoolByCode(poolCode, conn = pool) {
    const code = normalizeCode(poolCode)

    if (!code) {
        throw new Error('El código del pool es obligatorio.')
    }

    const [rows] = await conn.execute(
        `
        SELECT
            id,
            code,
            name,
            enabled
        FROM ut_pack_pools
        WHERE code = ?
        LIMIT 1
        `,
        [code]
    )

    return rows[0] || null
}

async function getCardById(cardId, conn = pool) {
    const id = Number(cardId)

    if (!Number.isInteger(id) || id <= 0) {
        throw new Error('cardId inválido.')
    }

    const [rows] = await conn.execute(
        `
        SELECT
            id,
            card_key,
            family,
            rating,
            packable,
            pack_tier,
            pack_weight,
            enabled
        FROM ut_cards
        WHERE id = ?
        LIMIT 1
        `,
        [id]
    )

    return rows[0] || null
}

async function getCardByKey(cardKey, conn = pool) {
    const key = clean(cardKey)

    if (!key) {
        throw new Error('cardKey inválido.')
    }

    const [rows] = await conn.execute(
        `
        SELECT
            id,
            card_key,
            family,
            rating,
            packable,
            pack_tier,
            pack_weight,
            enabled
        FROM ut_cards
        WHERE card_key = ?
        LIMIT 1
        `,
        [key]
    )

    return rows[0] || null
}

async function setCardPool(
    cardId,
    poolCode,
    options = {},
    conn = pool
) {
    const card = await getCardById(cardId, conn)

    if (!card) {
        throw new Error(`La carta #${cardId} no existe.`)
    }

    if (!card.enabled) {
        throw new Error(`La carta #${cardId} está deshabilitada.`)
    }

    const targetPool = await getPoolByCode(poolCode, conn)

    if (!targetPool) {
        throw new Error(
            `El pool ${normalizeCode(poolCode)} no existe.`
        )
    }

    if (!targetPool.enabled) {
        throw new Error(
            `El pool ${targetPool.code} está deshabilitado.`
        )
    }

    const weight = normalizeWeight(
        options.weight,
        normalizeWeight(card.pack_weight, 1)
    )

    const enabled =
        options.enabled === undefined
            ? 1
            : options.enabled
                ? 1
                : 0

    await conn.execute(
        `
        INSERT INTO ut_pack_pool_cards (
            pool_id,
            card_id,
            weight,
            enabled
        )
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            weight = VALUES(weight),
            enabled = VALUES(enabled)
        `,
        [
            targetPool.id,
            card.id,
            weight,
            enabled
        ]
    )

    return {
        cardId: card.id,
        cardKey: card.card_key,
        poolId: targetPool.id,
        poolCode: targetPool.code,
        weight,
        enabled
    }
}

async function removeCardFromPool(
    cardId,
    poolCode,
    conn = pool
) {
    const targetPool = await getPoolByCode(poolCode, conn)

    if (!targetPool) {
        throw new Error(
            `El pool ${normalizeCode(poolCode)} no existe.`
        )
    }

    const [result] = await conn.execute(
        `
        DELETE FROM ut_pack_pool_cards
        WHERE pool_id = ?
          AND card_id = ?
        `,
        [
            targetPool.id,
            Number(cardId)
        ]
    )

    return result.affectedRows > 0
}

async function disableCardInPool(
    cardId,
    poolCode,
    conn = pool
) {
    const targetPool = await getPoolByCode(poolCode, conn)

    if (!targetPool) {
        throw new Error(
            `El pool ${normalizeCode(poolCode)} no existe.`
        )
    }

    const [result] = await conn.execute(
        `
        UPDATE ut_pack_pool_cards
        SET enabled = 0
        WHERE pool_id = ?
          AND card_id = ?
        `,
        [
            targetPool.id,
            Number(cardId)
        ]
    )

    return result.affectedRows > 0
}

async function enableCardInPool(
    cardId,
    poolCode,
    weight = null,
    conn = pool
) {
    return setCardPool(
        cardId,
        poolCode,
        {
            enabled: true,
            weight
        },
        conn
    )
}

async function getCardPools(cardId, conn = pool) {
    const [rows] = await conn.execute(
        `
        SELECT
            p.id,
            p.code,
            p.name,
            pc.weight,
            pc.enabled
        FROM ut_pack_pool_cards pc
        INNER JOIN ut_pack_pools p
            ON p.id = pc.pool_id
        WHERE pc.card_id = ?
        ORDER BY p.id ASC
        `,
        [Number(cardId)]
    )

    return rows
}

async function getPoolCards(
    poolCode,
    options = {},
    conn = pool
) {
    const targetPool = await getPoolByCode(poolCode, conn)

    if (!targetPool) {
        throw new Error(
            `El pool ${normalizeCode(poolCode)} no existe.`
        )
    }

    const enabledOnly =
        options.enabledOnly !== false

    const packableOnly =
        options.packableOnly !== false

    const conditions = [
        'pc.pool_id = ?',
        'c.enabled = 1'
    ]

    const params = [targetPool.id]

    if (enabledOnly) {
        conditions.push('pc.enabled = 1')
    }

    if (packableOnly) {
        conditions.push('c.packable = 1')
    }

    const [rows] = await conn.execute(
        `
        SELECT
            c.id,
            c.card_key,
            c.player_id,
            c.game_id,
            c.promo_id,
            c.family,
            c.rating,
            c.position,
            c.club,
            c.league,
            c.pack_tier,
            c.pack_weight,
            c.image_path,
            pc.weight AS pool_weight,
            pc.enabled AS pool_enabled
        FROM ut_pack_pool_cards pc
        INNER JOIN ut_cards c
            ON c.id = pc.card_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY
            c.rating DESC,
            c.id ASC
        `,
        params
    )

    return rows
}

async function assignAutomaticPools(
    cardId,
    options = {},
    conn = pool
) {
    const card = await getCardById(cardId, conn)

    if (!card) {
        throw new Error(`La carta #${cardId} no existe.`)
    }

    if (!card.enabled || !card.packable) {
        return []
    }

    const pools = new Set()

    const tier = normalizeCode(card.pack_tier)
    const family = normalizeCode(card.family)

    if (tier === 'GOLD') {
        pools.add('GOLD')
    }

    if (tier === 'SILVER') {
    pools.add('SILVER')
    }

    if (tier === 'BRONZE') {
    pools.add('BRONZE')
    }

    if (tier === 'PERFORMANCE') {
        pools.add('PERFORMANCE')
    }

    if (tier === 'SPECIAL') {
        pools.add('SPECIAL')
    }

    if (family === 'HERO') {
        pools.add('HERO')
        pools.add('SPECIAL')
    }

    if (family === 'ICON') {
        pools.add('ICON')
        pools.add('SPECIAL')
    }

    if (Array.isArray(options.additionalPools)) {
        for (const poolCode of options.additionalPools) {
            const normalized = normalizeCode(poolCode)

            if (normalized) {
                pools.add(normalized)
            }
        }
    }

    const assignments = []

    for (const poolCode of pools) {
        assignments.push(
            await setCardPool(
                card.id,
                poolCode,
                {
                    weight: card.pack_weight,
                    enabled: true
                },
                conn
            )
        )
    }

    return assignments
}

async function assignCardsToPool(
    cards,
    poolCode,
    options = {}
) {
    if (!Array.isArray(cards)) {
        throw new Error('Se esperaba un arreglo de cartas.')
    }

    const result = {
        total: cards.length,
        assigned: 0,
        failed: 0,
        assignments: [],
        errors: []
    }

    for (const card of cards) {
        try {
            let cardId = null

            if (
                typeof card === 'number' ||
                /^\d+$/.test(String(card))
            ) {
                cardId = Number(card)
            } else if (
                card &&
                typeof card === 'object' &&
                card.id
            ) {
                cardId = Number(card.id)
            } else if (
                card &&
                typeof card === 'object' &&
                card.cardId
            ) {
                cardId = Number(card.cardId)
            } else if (
                typeof card === 'string'
            ) {
                const found = await getCardByKey(card)

                if (!found) {
                    throw new Error(
                        `No existe la carta ${card}.`
                    )
                }

                cardId = found.id
            }

            if (!cardId) {
                throw new Error(
                    'No se pudo determinar cardId.'
                )
            }

            const assignment = await setCardPool(
                cardId,
                poolCode,
                options
            )

            result.assigned++
            result.assignments.push(assignment)
        } catch (error) {
            result.failed++
            result.errors.push({
                card:
                    card?.cardKey ||
                    card?.cardId ||
                    card?.id ||
                    card,
                error: error.message
            })
        }
    }

    return result
}

module.exports = {
    getPoolByCode,
    getCardById,
    getCardByKey,
    getCardPools,
    getPoolCards,
    setCardPool,
    removeCardFromPool,
    disableCardInPool,
    enableCardInPool,
    assignAutomaticPools,
    assignCardsToPool
}
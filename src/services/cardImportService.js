const crypto = require('crypto')

const { pool } = require('../database/mysql')
const {
    assignAutomaticPools
} = require('./cardPoolService')

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

function normalizeKey(value) {
    const result = clean(value)

    if (!result) return null

    return result
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

function normalizeGender(value) {
    return String(value || 'MALE').toUpperCase() === 'FEMALE'
        ? 'FEMALE'
        : 'MALE'
}

function normalizeFamily(value) {
    const family = String(value || 'PLAYER').toUpperCase()

    if (!['PLAYER', 'HERO', 'ICON'].includes(family)) {
        throw new Error(`Familia de carta inválida: ${family}`)
    }

    return family
}

function normalizeMode(value) {
    const mode = String(value || 'MAIN').toUpperCase()

    if (!['MAIN', 'WORLD_CUP'].includes(mode)) {
        throw new Error(`Modo de carta inválido: ${mode}`)
    }

    return mode
}

function normalizeOriginalSource(value) {
    const source = String(value || 'PACK').toUpperCase()

    const allowed = [
        'PACK',
        'SBC',
        'OBJECTIVE',
        'REWARD',
        'SWAPS',
        'SPECIAL',
        'OTHER'
    ]

    if (!allowed.includes(source)) {
        throw new Error(`Origen de carta inválido: ${source}`)
    }

    return source
}

function numberOrNull(value, min = 1, max = 99) {
    if (value === undefined || value === null || value === '') {
        return null
    }

    const number = Number(value)

    if (!Number.isFinite(number)) {
        return null
    }

    const integer = Math.round(number)

    if (integer < min || integer > max) {
        return null
    }

    return integer
}

function booleanValue(value, fallback = false) {
    if (value === undefined || value === null) {
        return fallback ? 1 : 0
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()

        if (['1', 'true', 'yes', 'si', 'sí'].includes(normalized)) {
            return 1
        }

        if (['0', 'false', 'no'].includes(normalized)) {
            return 0
        }
    }

    return value ? 1 : 0
}

function createPlayerKey(card) {
    if (card.playerKey) {
        return normalizeKey(card.playerKey)
    }

    if (
        card.sourcePlayerId !== undefined &&
        card.sourcePlayerId !== null &&
        String(card.sourcePlayerId).trim()
    ) {
        return normalizeKey(
            `external:${card.source}:${card.sourcePlayerId}`
        )
    }

    const name = normalizeKey(card.name)
    const nationality = normalizeKey(card.nationality)

    if (!name || !nationality) {
        return null
    }

    return normalizeKey(
        `generated:${name}:${nationality}`
    )
}

function createCardKey(card, playerKey, gameCode, promoCode) {
    if (clean(card.cardKey)) {
        return clean(card.cardKey)
    }

    const identity = [
        playerKey,
        gameCode,
        promoCode,
        normalizeFamily(card.family),
        normalizeMode(card.mode),
        clean(card.subpromo) || '',
        clean(card.designVariant) || '',
        clean(card.releaseTeam) || '',
        numberOrNull(card.rating) || '',
        clean(card.position) || ''
    ].join('|')

    return `card:${crypto
        .createHash('sha256')
        .update(identity.toLowerCase())
        .digest('hex')
        .slice(0, 40)}`
}

function validateCard(card) {
    if (!card || typeof card !== 'object') {
        throw new Error('La carta recibida no es válida.')
    }

    if (!clean(card.name)) {
        throw new Error('La carta no contiene name.')
    }

    if (!clean(card.nationality)) {
        throw new Error(`Falta nationality para ${card.name}.`)
    }

    if (!clean(card.game)) {
        throw new Error(`Falta game para ${card.name}.`)
    }

    if (!clean(card.promo)) {
        throw new Error(`Falta promo para ${card.name}.`)
    }

    const rating = numberOrNull(card.rating)

    if (!rating) {
        throw new Error(`Rating inválido para ${card.name}.`)
    }

    if (!clean(card.position)) {
        throw new Error(`Falta position para ${card.name}.`)
    }
}

async function getGame(conn, gameCode) {
    const [rows] = await conn.execute(
        `
            SELECT id, code, name
            FROM ut_games
            WHERE code = ?
              AND enabled = 1
            LIMIT 1
        `,
        [gameCode]
    )

    return rows[0] || null
}

async function getPromo(conn, promoCode) {
    const [rows] = await conn.execute(
        `
            SELECT id, code, name
            FROM ut_promos
            WHERE code = ?
              AND enabled = 1
            LIMIT 1
        `,
        [promoCode]
    )

    return rows[0] || null
}

async function findPlayerByExternalId(conn, sourceCode, externalId) {
    if (!sourceCode || !externalId) {
        return null
    }

    const [rows] = await conn.execute(
        `
            SELECT p.*
            FROM ut_player_external_ids e
            INNER JOIN ut_players p
                ON p.id = e.player_id
            WHERE e.source_code = ?
              AND e.external_id = ?
            LIMIT 1
        `,
        [sourceCode, externalId]
    )

    return rows[0] || null
}

async function findPlayerByKey(conn, playerKey) {
    if (!playerKey) {
        return null
    }

    const [rows] = await conn.execute(
        `
            SELECT *
            FROM ut_players
            WHERE player_key = ?
            LIMIT 1
        `,
        [playerKey]
    )

    return rows[0] || null
}

async function createPlayer(conn, card, playerKey) {
    const [result] = await conn.execute(
        `
            INSERT INTO ut_players (
                player_key,
                name,
                known_as,
                nationality,
                gender,
                enabled
            )
            VALUES (?, ?, ?, ?, ?, 1)
        `,
        [
            playerKey,
            clean(card.name),
            clean(card.knownAs),
            clean(card.nationality),
            normalizeGender(card.gender)
        ]
    )

    return result.insertId
}

async function updatePlayer(conn, playerId, card) {
    await conn.execute(
        `
            UPDATE ut_players
            SET
                name = ?,
                known_as = ?,
                nationality = ?,
                gender = ?,
                enabled = 1
            WHERE id = ?
        `,
        [
            clean(card.name),
            clean(card.knownAs),
            clean(card.nationality),
            normalizeGender(card.gender),
            playerId
        ]
    )
}

async function ensureExternalId(
    conn,
    playerId,
    sourceCode,
    externalId
) {
    if (!sourceCode || !externalId) {
        return
    }

    const [rows] = await conn.execute(
        `
            SELECT id, player_id
            FROM ut_player_external_ids
            WHERE source_code = ?
              AND external_id = ?
            LIMIT 1
            FOR UPDATE
        `,
        [sourceCode, externalId]
    )

    if (rows.length) {
        if (Number(rows[0].player_id) !== Number(playerId)) {
            throw new Error(
                `El identificador externo ${sourceCode}:${externalId} ya pertenece a otro jugador.`
            )
        }

        return
    }

    await conn.execute(
        `
            INSERT INTO ut_player_external_ids (
                player_id,
                source_code,
                external_id
            )
            VALUES (?, ?, ?)
        `,
        [playerId, sourceCode, externalId]
    )
}

async function ensurePlayer(conn, card) {
    const sourceCode = normalizeCode(card.source)
    const externalId = clean(card.sourcePlayerId)
    const playerKey = createPlayerKey(card)

    let player = await findPlayerByExternalId(
        conn,
        sourceCode,
        externalId
    )

    if (!player) {
        player = await findPlayerByKey(
            conn,
            playerKey
        )
    }

    let playerId

    if (player) {
        playerId = player.id

        await updatePlayer(
            conn,
            playerId,
            card
        )
    } else {
        playerId = await createPlayer(
            conn,
            card,
            playerKey
        )
    }

    await ensureExternalId(
        conn,
        playerId,
        sourceCode,
        externalId
    )

    return {
    id: playerId,
    playerKey: player?.player_key || playerKey
}
}

async function upsertCard(
    conn,
    card,
    playerId,
    playerKey,
    game,
    promo
) {
    const cardKey = createCardKey(
        card,
        playerKey,
        game.code,
        promo.code
    )

    const stats = card.stats || {}

    const values = [
        cardKey,
        playerId,
        game.id,
        promo.id,
        normalizeFamily(card.family),
        normalizeMode(card.mode),
        clean(card.subpromo),
        clean(card.designVariant),
        clean(card.releaseTeam),
        numberOrNull(card.rating),
        clean(card.position).toUpperCase(),
        clean(card.club),
        clean(card.league),
        numberOrNull(stats.pac ?? card.pac),
        numberOrNull(stats.sho ?? card.sho),
        numberOrNull(stats.pas ?? card.pas),
        numberOrNull(stats.dri ?? card.dri),
        numberOrNull(stats.def ?? card.def),
        numberOrNull(stats.phy ?? card.phy),
        numberOrNull(stats.div ?? card.divStat),
        numberOrNull(stats.han ?? card.han),
        numberOrNull(stats.kic ?? card.kic),
        numberOrNull(stats.ref ?? card.refStat),
        numberOrNull(stats.spd ?? card.spd),
        numberOrNull(stats.pos ?? card.posStat),
        numberOrNull(card.skillMoves, 1, 5),
        numberOrNull(card.weakFoot, 1, 5),
        booleanValue(card.dynamic),
        numberOrNull(card.releaseRating),
        numberOrNull(card.finalRating),
        normalizeOriginalSource(card.originalSource),
        booleanValue(card.officialCard, true),
        booleanValue(card.packable),
        clean(card.packTier),
        Number(card.packWeight) > 0
            ? Number(card.packWeight)
            : 1,
        clean(card.imagePath),
        booleanValue(card.enabled, true)
    ]

    await conn.execute(
        `
            INSERT INTO ut_cards (
                card_key,
                player_id,
                game_id,
                promo_id,
                family,
                mode,
                subpromo,
                design_variant,
                release_team,
                rating,
                position,
                club,
                league,
                pac,
                sho,
                pas,
                dri,
                def,
                phy,
                div_stat,
                han,
                kic,
                ref_stat,
                spd,
                pos_stat,
                skill_moves,
                weak_foot,
                dynamic,
                release_rating,
                final_rating,
                original_source,
                official_card,
                packable,
                pack_tier,
                pack_weight,
                image_path,
                enabled
            )
            VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?
            )
            ON DUPLICATE KEY UPDATE
                player_id = VALUES(player_id),
                game_id = VALUES(game_id),
                promo_id = VALUES(promo_id),
                family = VALUES(family),
                mode = VALUES(mode),
                subpromo = VALUES(subpromo),
                design_variant = VALUES(design_variant),
                release_team = VALUES(release_team),
                rating = VALUES(rating),
                position = VALUES(position),
                club = VALUES(club),
                league = VALUES(league),
                pac = VALUES(pac),
                sho = VALUES(sho),
                pas = VALUES(pas),
                dri = VALUES(dri),
                def = VALUES(def),
                phy = VALUES(phy),
                div_stat = VALUES(div_stat),
                han = VALUES(han),
                kic = VALUES(kic),
                ref_stat = VALUES(ref_stat),
                spd = VALUES(spd),
                pos_stat = VALUES(pos_stat),
                skill_moves = VALUES(skill_moves),
                weak_foot = VALUES(weak_foot),
                dynamic = VALUES(dynamic),
                release_rating = VALUES(release_rating),
                final_rating = VALUES(final_rating),
                original_source = VALUES(original_source),
                official_card = VALUES(official_card),
                packable = VALUES(packable),
                pack_tier = VALUES(pack_tier),
                pack_weight = VALUES(pack_weight),
                image_path = VALUES(image_path),
                enabled = VALUES(enabled)
        `,
        values
    )

    const [rows] = await conn.execute(
        `
            SELECT id, card_key
            FROM ut_cards
            WHERE card_key = ?
            LIMIT 1
        `,
        [cardKey]
    )

    return rows[0]
}

async function importCard(card) {
    validateCard(card)

    const conn = await pool.getConnection()

    try {
        await conn.beginTransaction()

        const gameCode = normalizeCode(card.game)
        const promoCode = normalizeCode(card.promo)

        const game = await getGame(
            conn,
            gameCode
        )

        if (!game) {
            throw new Error(
                `El juego ${gameCode} no existe o está deshabilitado.`
            )
        }

        const promo = await getPromo(
            conn,
            promoCode
        )

        if (!promo) {
            throw new Error(
                `La promo ${promoCode} no existe o está deshabilitada.`
            )
        }

        const player = await ensurePlayer(
            conn,
            card
        )

        const importedCard = await upsertCard(
            conn,
            card,
            player.id,
            player.playerKey,
            game,
            promo
        )

        const pools = await assignAutomaticPools(
            importedCard.id,
            {
                additionalPools: Array.isArray(
                    card.additionalPools
                )
                    ? card.additionalPools
                    : []
            },
            conn
        )

        await conn.commit()

        return {
            playerId: player.id,
            cardId: importedCard.id,
            cardKey: importedCard.card_key,
            game: game.code,
            promo: promo.code,
            pools
        }
    } catch (error) {
        try {
            await conn.rollback()
        } catch {
        }

        throw error
    } finally {
        conn.release()
    }
}

async function importCards(cards) {
    if (!Array.isArray(cards)) {
        throw new Error(
            'Se esperaba un arreglo de cartas.'
        )
    }

    const result = {
        total: cards.length,
        imported: 0,
        failed: 0,
        cards: [],
        errors: []
    }

    for (
        let index = 0;
        index < cards.length;
        index++
    ) {
        try {
            const imported = await importCard(
                cards[index]
            )

            result.imported++
            result.cards.push(imported)
        } catch (error) {
            result.failed++

            result.errors.push({
                index,
                name: cards[index]?.name || null,
                error: error.message
            })
        }
    }

    return result
}

module.exports = {
    importCard,
    importCards
}
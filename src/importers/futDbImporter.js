const {
    importJsonCard,
    importJsonCards
} = require('./jsonCardImporter')

const {
    resolveRarity
} = require('../services/futDbRarityMapper')

function clean(value) {
    if (value === undefined || value === null) return null

    const result = String(value).trim()

    return result || null
}

function firstValue(...values) {
    for (const value of values) {
        if (
            value !== undefined &&
            value !== null &&
            value !== ''
        ) {
            return value
        }
    }

    return null
}

function getPlayer(raw) {
    if (!raw || typeof raw !== 'object') {
        throw new Error(
            'La respuesta FUT-DB no es válida.'
        )
    }

    if (
        raw.player &&
        typeof raw.player === 'object'
    ) {
        return raw.player
    }

    return raw
}

function normalizeGender(value) {
    return String(value || 'male')
        .toLowerCase() === 'female'
        ? 'FEMALE'
        : 'MALE'
}

function normalizePosition(value) {
    const position = clean(value)

    return position
        ? position.toUpperCase()
        : null
}

function getRelation(map, id) {
    if (!map || typeof map.get !== 'function') {
        return null
    }

    return map.get(Number(id)) || null
}

function normalizeFutDbCard(raw, relations = {}) {
    const player = getPlayer(raw)

    const playerId = firstValue(
        player.id,
        player.resourceId
    )

    const resourceId = firstValue(
        player.resourceId,
        player.id
    )

    const resourceBaseId = firstValue(
        player.resourceBaseId,
        resourceId
    )

    if (!playerId) {
        throw new Error(
            'FUT-DB no proporcionó id para la carta.'
        )
    }

    if (!resourceBaseId) {
        throw new Error(
            `FUT-DB no proporcionó resourceBaseId para ${playerId}.`
        )
    }

    const name = clean(
        firstValue(
            player.name,
            [
                player.firstName,
                player.lastName
            ]
                .filter(Boolean)
                .join(' ')
        )
    )

    if (!name) {
        throw new Error(
            `FUT-DB no proporcionó nombre para ${playerId}.`
        )
    }

    const nation =
        relations.nation ||
        getRelation(
            relations.nations,
            player.nation
        )

    const club =
        relations.club ||
        getRelation(
            relations.clubs,
            player.club
        )

    const league =
        relations.league ||
        getRelation(
            relations.leagues,
            player.league
        )

    const rarity =
        relations.rarity ||
        getRelation(
            relations.rarities,
            player.rarity
        )

    if (!nation) {
        throw new Error(
            `No se resolvió nation ${player.nation} para ${name}.`
        )
    }

    if (!rarity) {
        throw new Error(
            `No se resolvió rarity ${player.rarity} para ${name}.`
        )
    }

    const nationality = clean(
        firstValue(
            nation.name,
            nation.shortName
        )
    )

    if (!nationality) {
        throw new Error(
            `La nación ${player.nation} no tiene nombre para ${name}.`
        )
    }

    const rarityData =
        resolveRarity(rarity)

    if (!rarityData.mapped) {
        throw new Error(
            `Rarity FUT-DB sin mapear: ${rarity.id} - ${rarity.name}`
        )
    }

    if (!rarityData.promoCode) {
        throw new Error(
            `La rarity ${rarity.id} no tiene promoCode configurado.`
        )
    }

    const position =
        normalizePosition(player.position)

    if (!position) {
        throw new Error(
            `FUT-DB no proporcionó posición para ${name}.`
        )
    }

    const rating = Number(player.rating)

    if (
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 99
    ) {
        throw new Error(
            `Rating inválido para ${name}: ${player.rating}`
        )
    }

    return {
        source: 'futdb',

        sourcePlayerId:
            String(resourceBaseId),

        cardKey:
            `futdb:fc26:${resourceId}`,

        name,

        knownAs:
            clean(player.commonName),

        nationality,

        gender:
            normalizeGender(player.gender),

        game: 'FC26',

        promo:
            rarityData.promoCode,

        family:
            rarityData.family,

        mode: 'MAIN',

        subpromo:
            clean(player.version),

        designVariant:
            clean(rarity.name),

        releaseTeam: null,

        rating,

        position,

        club:
            clean(
                firstValue(
                    club?.name,
                    club?.shortName
                )
            ),

        league:
            clean(
                firstValue(
                    league?.name,
                    league?.shortName
                )
            ),

        stats: {
            pac: player.pace,
            sho: player.shooting,
            pas: player.passing,
            dri: player.dribbling,
            def: player.defending,
            phy: player.physicality,

            div: player.diving,
            han: player.handling,
            kic: player.kicking,
            ref: player.reflexes,
            spd: player.speed,
            pos: player.positioning
        },

        skillMoves:
            player.skillMoves,

        weakFoot:
            player.weakFoot,

        dynamic: false,

        releaseRating:
            rating,

        finalRating:
            rating,

        originalSource: 'PACK',

        officialCard: true,

        packable:
            rarityData.packable,

        packTier:
            rarityData.packTier,

        packWeight: 1,

        imagePath: null,

        enabled: true,

        additionalPools:
            rarityData.additionalPools
    }
}

async function importFutDbCard(
    raw,
    relations = {}
) {
    const normalized =
        normalizeFutDbCard(
            raw,
            relations
        )

    return importJsonCard(normalized)
}

async function importFutDbCards(
    cards,
    relations = {}
) {
    if (!Array.isArray(cards)) {
        throw new Error(
            'Se esperaba un arreglo de cartas FUT-DB.'
        )
    }

    const normalized = []
    const normalizationErrors = []

    for (
        let index = 0;
        index < cards.length;
        index++
    ) {
        try {
            normalized.push(
                normalizeFutDbCard(
                    cards[index],
                    relations
                )
            )
        } catch (error) {
            normalizationErrors.push({
                index,
                id:
                    cards[index]?.id ||
                    cards[index]?.player?.id ||
                    null,
                error: error.message
            })
        }
    }

    const imported =
        await importJsonCards(normalized)

    return {
        total: cards.length,
        normalized:
            normalized.length,
        imported:
            imported.imported,
        failed:
            normalizationErrors.length +
            imported.failed,
        cards:
            imported.cards,
        errors: [
            ...normalizationErrors,
            ...imported.errors
        ]
    }
}

module.exports = {
    normalizeFutDbCard,
    importFutDbCard,
    importFutDbCards
}
const {
    importJsonCard,
    importJsonCards
} = require('./jsonCardImporter')

const {
    resolveFifa17Rarity
} = require('../services/fifa17RarityMapper')

function clean(value) {
    if (value === undefined || value === null) {
        return null
    }

    const result = String(value).trim()

    return result || null
}

function numberOrNull(value) {
    if (
        value === undefined ||
        value === null ||
        value === ''
    ) {
        return null
    }

    const number = Number(value)

    return Number.isFinite(number)
        ? number
        : null
}

function booleanValue(value, fallback = false) {
    if (value === undefined || value === null) {
        return fallback
    }

    if (typeof value === 'boolean') {
        return value
    }

    if (typeof value === 'number') {
        return value !== 0
    }

    const normalized =
        String(value)
            .trim()
            .toLowerCase()

    if (
        normalized === 'true' ||
        normalized === '1' ||
        normalized === 'yes'
    ) {
        return true
    }

    if (
        normalized === 'false' ||
        normalized === '0' ||
        normalized === 'no'
    ) {
        return false
    }

    return fallback
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

function getPlayerName(raw) {
    return clean(
        firstValue(
            raw.name,
            raw.playerName,
            raw.player_name,
            raw.displayName,
            raw.display_name,
            raw.commonName,
            raw.common_name
        )
    )
}

function getKnownAs(raw) {
    return clean(
        firstValue(
            raw.knownAs,
            raw.known_as,
            raw.commonName,
            raw.common_name
        )
    )
}

function getNationality(raw) {
    return clean(
        firstValue(
            raw.nationality,
            raw.nation?.name,
            raw.nation?.abbrName,
            raw.country,
            raw.nationName,
            raw.nation_name
        )
    )
}

function getRarityName(raw) {
    const rawColor =
        raw.color != null
            ? String(raw.color)
                .trim()
                .toLowerCase()
            : ''

    const premiumSbcCardIds = new Set([
        '67299677',    // El Shaarawy 88
        '100712665',   // Fernando Torres 91
        '100843240'    // David Luiz 90
    ])

    if (
        raw.id != null &&
        premiumSbcCardIds.has(
            String(raw.id)
        )
    ) {
        return 'SBC Premium'
    }

    const colorMappings = {
        gold: 'Non-Rare',
        silver: 'Non-Rare',
        bronze: 'Non-Rare',

        rare_gold: 'Rare',
        rare_silver: 'Rare',
        rare_bronze: 'Rare',

        totw_gold: 'Team of the Week',
        totw_silver: 'Team of the Week',
        totw_bronze: 'Team of the Week',

        tots_gold: 'Team of the Season',
        tots_silver: 'Team of the Season',
        tots_bronze: 'Team of the Season',

        toty: 'Team of the Year',
        legend: 'Legend',

        motm: 'Man of the Match',
        imotm: 'International Man of the Match',

        ones_to_watch: 'Ones to Watch',
        fut_birthday: 'FUT Birthday',
        movember: 'Movember',
        st_patricks: "St. Patrick's Day",
        record_breaker: 'Record Breaker',
        award_winner: 'Award Winner',

        halloween: 'Ultimate Scream',

        fut_champions_gold: 'FUT Champions',

        sbc_base: 'SBC',
        gotm: 'GOTM',

        confederation_champions_motm:
            'Confederation Champions MOTM',

        purple: 'Hero'
    }

    if (colorMappings[rawColor]) {
        return colorMappings[rawColor]
    }

    return clean(
        firstValue(
            raw.rarityName,
            raw.rarity_name,
            raw.rarity,
            raw.playerType,
            raw.cardType,
            raw.card_type,
            raw.version,
            raw.type
        )
    )
}

function getRating(raw) {
    return numberOrNull(
        firstValue(
            raw.rating,
            raw.overall,
            raw.ovr
        )
    )
}

function getPosition(raw) {
    return clean(
        firstValue(
            raw.position,
            raw.pos
        )
    )
}

function getSourcePlayerId(raw) {
    return clean(
        firstValue(
            raw.assetId,
            raw.asset_id,
            raw.baseId,
            raw.base_id,
            raw.playerId,
            raw.player_id
        )
    )
}

function getSourceCardId(raw) {
    return clean(
        firstValue(
            raw.resourceId,
            raw.resource_id,
            raw.definitionId,
            raw.definition_id,
            raw.cardId,
            raw.card_id,
            raw.id
        )
    )
}

function getStats(raw) {
    const stats =
        raw.stats &&
        typeof raw.stats === 'object'
            ? raw.stats
            : {}

    const attributes = Array.isArray(raw.attributes)
        ? raw.attributes
        : []

    function getAttribute(code) {
        const expected =
            `fut.attribute.${code}`.toLowerCase()

        const attribute = attributes.find(
            item =>
                item &&
                String(item.name || '')
                    .toLowerCase() === expected
        )

        return attribute
            ? numberOrNull(attribute.value)
            : null
    }

    return {
        pac: numberOrNull(
            firstValue(
                raw.pac,
                raw.pace,
                stats.pac,
                stats.pace,
                getAttribute('PAC')
            )
        ),

        sho: numberOrNull(
            firstValue(
                raw.sho,
                raw.shooting,
                stats.sho,
                stats.shooting,
                getAttribute('SHO')
            )
        ),

        pas: numberOrNull(
            firstValue(
                raw.pas,
                raw.passing,
                stats.pas,
                stats.passing,
                getAttribute('PAS')
            )
        ),

        dri: numberOrNull(
            firstValue(
                raw.dri,
                raw.dribbling,
                stats.dri,
                stats.dribbling,
                getAttribute('DRI')
            )
        ),

        def: numberOrNull(
            firstValue(
                raw.def,
                raw.defending,
                stats.def,
                stats.defending,
                getAttribute('DEF')
            )
        ),

        phy: numberOrNull(
            firstValue(
                raw.phy,
                raw.physical,
                raw.physicality,
                stats.phy,
                stats.physical,
                stats.physicality,
                getAttribute('PHY')
            )
        ),

        div: numberOrNull(
            firstValue(
                raw.div,
                raw.diving,
                stats.div,
                stats.diving,
                getAttribute('DIV')
            )
        ),

        han: numberOrNull(
            firstValue(
                raw.han,
                raw.handling,
                stats.han,
                stats.handling,
                getAttribute('HAN')
            )
        ),

        kic: numberOrNull(
            firstValue(
                raw.kic,
                raw.kicking,
                stats.kic,
                stats.kicking,
                getAttribute('KIC')
            )
        ),

        ref: numberOrNull(
            firstValue(
                raw.ref,
                raw.reflexes,
                stats.ref,
                stats.reflexes,
                getAttribute('REF')
            )
        ),

        spd: numberOrNull(
            firstValue(
                raw.spd,
                raw.speed,
                stats.spd,
                stats.speed,
                getAttribute('SPD')
            )
        ),

        pos: numberOrNull(
        firstValue(
        raw.posStat,
        stats.pos,
        getAttribute('POS'),
        raw.positioning,
        stats.positioning
    )
    )
    }
}

function normalizeFifa17Card(raw) {
    if (!raw || typeof raw !== 'object') {
        throw new Error(
            'La carta FIFA 17 no es un objeto válido.'
        )
    }

    const name = getPlayerName(raw)
    const nationality = getNationality(raw)
    const rarityName = getRarityName(raw)
    const rating = getRating(raw)
    const position = getPosition(raw)

    if (!name) {
        throw new Error(
            'La carta FIFA 17 no tiene nombre.'
        )
    }

    if (!nationality) {
        throw new Error(
            `La carta de ${name} no tiene nacionalidad.`
        )
    }

    if (!rarityName) {
        throw new Error(
            `La carta de ${name} no tiene tipo de carta.`
        )
    }

    if (
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 99
    ) {
        throw new Error(
            `La carta de ${name} tiene un rating inválido.`
        )
    }

    if (!position) {
        throw new Error(
            `La carta de ${name} no tiene posición.`
        )
    }

    const rarity =
        resolveFifa17Rarity(
            rarityName,
            rating
        )

    if (!rarity.mapped) {
        throw new Error(
            `Tipo FIFA 17 no mapeado: ${rarityName}`
        )
    }

    const sourcePlayerId =
        getSourcePlayerId(raw)

    const sourceCardId =
        getSourceCardId(raw)

    const stats =
        getStats(raw)

    return {
        source: 'EA_FIFA17',
        sourcePlayerId,
        playerKey:
            sourcePlayerId
                ? `ea:${sourcePlayerId}`
                : null,
        cardKey:
            sourceCardId
                ? `ea:fifa17:${sourceCardId}`
                : null,
        name,
        knownAs: getKnownAs(raw),
        nationality,
        gender: 'MALE',
        gameCode: 'FIFA17',
        promoCode:
            rarity.promoCode,
        family:
            rarity.family,
        mode:
            clean(raw.mode) ||
            'MAIN',
        subpromo:
            clean(
                firstValue(
                    raw.subpromo,
                    raw.subPromo
                )
            ),
        designVariant:
            rarityName,
        releaseTeam:
            clean(
                firstValue(
                    raw.releaseTeam,
                    raw.release_team
                )
            ),
        rating,
        position:
            position.toUpperCase(),
        club:
    clean(
        firstValue(
            raw.club?.name,
            raw.club?.abbrName,
            raw.clubName,
            raw.club_name,
            typeof raw.club === 'string'
                ? raw.club
                : null
        )
    ),

league:
    clean(
        firstValue(
            raw.league?.name,
            raw.league?.abbrName,
            raw.leagueName,
            raw.league_name,
            typeof raw.league === 'string'
                ? raw.league
                : null
        )
    ),
        ...stats,
        skillMoves:
            numberOrNull(
                firstValue(
                    raw.skillMoves,
                    raw.skill_moves,
                    raw.skills
                )
            ),
        weakFoot:
            numberOrNull(
                firstValue(
                    raw.weakFoot,
                    raw.weak_foot
                )
            ),
        dynamic:
            booleanValue(
                raw.dynamic,
                false
            ),
        releaseRating:
            numberOrNull(
                firstValue(
                    raw.releaseRating,
                    raw.release_rating
                )
            ),
        finalRating:
            numberOrNull(
                firstValue(
                    raw.finalRating,
                    raw.final_rating
                )
            ),
        originalSource:
    rarity.originalSource,

        officialCard: true,
        packable:
            rarity.packable,
        packTier:
            rarity.packTier,
        packWeight:
            numberOrNull(
                firstValue(
                    raw.packWeight,
                    raw.pack_weight
                )
            ) || 1,
        imagePath:
            clean(
                firstValue(
                    raw.imagePath,
                    raw.image_path
                )
            ),
        additionalPools:
            rarity.additionalPools
    }
}

async function importFifa17Card(raw) {
    const normalized =
        normalizeFifa17Card(raw)

    return importJsonCard(
        normalized
    )
}

async function importFifa17Cards(cards) {
    if (!Array.isArray(cards)) {
        throw new Error(
            'Se esperaba un arreglo de cartas FIFA 17.'
        )
    }

    const normalized = []
    const normalizationFailures = []

    for (
        let index = 0;
        index < cards.length;
        index++
    ) {
        try {
            normalized.push(
                normalizeFifa17Card(
                    cards[index]
                )
            )
        } catch (error) {
            normalizationFailures.push({
                index,
                error: error.message
            })
        }
    }

    const result =
        normalized.length > 0
            ? await importJsonCards(
                normalized
            )
            : {
                imported: 0,
                failed: 0,
                failures: []
            }

    return {
        ...result,
        normalizationFailed:
            normalizationFailures.length,
        normalizationFailures
    }
}

module.exports = {
    normalizeFifa17Card,
    importFifa17Card,
    importFifa17Cards
}
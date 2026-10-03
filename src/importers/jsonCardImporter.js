const fs = require('fs/promises')
const path = require('path')
const {
    importCard,
    importCards
} = require('../services/cardImportService')

function clean(value) {
    if (value === undefined || value === null) return null

    const result = String(value).trim()

    return result || null
}

function normalizeBoolean(value, fallback = undefined) {
    if (value === undefined || value === null || value === '') {
        return fallback
    }

    if (typeof value === 'boolean') {
        return value
    }

    if (typeof value === 'number') {
        return value !== 0
    }

    const normalized = String(value).trim().toLowerCase()

    if (['1', 'true', 'yes', 'si', 'sí'].includes(normalized)) {
        return true
    }

    if (['0', 'false', 'no'].includes(normalized)) {
        return false
    }

    return fallback
}

function normalizeNumber(value) {
    if (value === undefined || value === null || value === '') {
        return null
    }

    const number = Number(value)

    return Number.isFinite(number) ? number : null
}

function normalizeJsonCard(raw, defaults = {}) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('La entrada de carta no es un objeto válido.')
    }

    const stats = raw.stats || {}

    return {
        source:
            clean(raw.source) ||
            clean(defaults.source) ||
            'json',

        sourcePlayerId:
            clean(raw.sourcePlayerId) ||
            clean(raw.source_player_id) ||
            clean(raw.externalPlayerId) ||
            clean(raw.external_player_id),

        playerKey:
            clean(raw.playerKey) ||
            clean(raw.player_key),

        cardKey:
            clean(raw.cardKey) ||
            clean(raw.card_key),

        name:
            clean(raw.name) ||
            clean(raw.playerName) ||
            clean(raw.player_name),

        knownAs:
            clean(raw.knownAs) ||
            clean(raw.known_as),

        nationality:
            clean(raw.nationality) ||
            clean(raw.nation),

        gender:
            clean(raw.gender) ||
            clean(defaults.gender) ||
            'MALE',

        game:
            clean(raw.game) ||
            clean(raw.gameCode) ||
            clean(raw.game_code) ||
            clean(defaults.game),

        promo:
            clean(raw.promo) ||
            clean(raw.promoCode) ||
            clean(raw.promo_code) ||
            clean(defaults.promo),

        family:
            clean(raw.family) ||
            clean(defaults.family) ||
            'PLAYER',

        mode:
            clean(raw.mode) ||
            clean(defaults.mode) ||
            'MAIN',

        subpromo:
            clean(raw.subpromo),

        designVariant:
            clean(raw.designVariant) ||
            clean(raw.design_variant),

        releaseTeam:
            clean(raw.releaseTeam) ||
            clean(raw.release_team),

        rating:
            normalizeNumber(
                raw.rating ??
                raw.overall ??
                raw.ovr
            ),

        position:
            clean(raw.position) ||
            clean(raw.pos),

        club:
            clean(raw.club),

        league:
            clean(raw.league),

        stats: {
            pac: normalizeNumber(
                stats.pac ??
                stats.pace ??
                raw.pac ??
                raw.pace
            ),

            sho: normalizeNumber(
                stats.sho ??
                stats.shooting ??
                raw.sho ??
                raw.shooting
            ),

            pas: normalizeNumber(
                stats.pas ??
                stats.passing ??
                raw.pas ??
                raw.passing
            ),

            dri: normalizeNumber(
                stats.dri ??
                stats.dribbling ??
                raw.dri ??
                raw.dribbling
            ),

            def: normalizeNumber(
                stats.def ??
                stats.defending ??
                raw.def ??
                raw.defending
            ),

            phy: normalizeNumber(
                stats.phy ??
                stats.physical ??
                raw.phy ??
                raw.physical
            ),

            div: normalizeNumber(
                stats.div ??
                stats.diving ??
                raw.div ??
                raw.diving
            ),

            han: normalizeNumber(
                stats.han ??
                stats.handling ??
                raw.han ??
                raw.handling
            ),

            kic: normalizeNumber(
                stats.kic ??
                stats.kicking ??
                raw.kic ??
                raw.kicking
            ),

            ref: normalizeNumber(
                stats.ref ??
                stats.reflexes ??
                raw.ref ??
                raw.reflexes
            ),

            spd: normalizeNumber(
                stats.spd ??
                stats.speed ??
                raw.spd ??
                raw.speed
            ),

            pos: normalizeNumber(
                    stats.pos ??
                    stats.positioning ??
                    raw.posStat ??
                    raw.pos_stat ??
                    raw.pos
                )
        },

        skillMoves:
            normalizeNumber(
                raw.skillMoves ??
                raw.skill_moves
            ),

        weakFoot:
            normalizeNumber(
                raw.weakFoot ??
                raw.weak_foot
            ),

        dynamic:
            normalizeBoolean(
                raw.dynamic,
                false
            ),

        releaseRating:
            normalizeNumber(
                raw.releaseRating ??
                raw.release_rating
            ),

        finalRating:
            normalizeNumber(
                raw.finalRating ??
                raw.final_rating
            ),

        originalSource:
            clean(raw.originalSource) ||
            clean(raw.original_source) ||
            clean(defaults.originalSource) ||
            'PACK',

        officialCard:
            normalizeBoolean(
                raw.officialCard ??
                raw.official_card,
                true
            ),

        packable:
            normalizeBoolean(
                raw.packable,
                false
            ),

        packTier:
    clean(raw.packTier) ||
    clean(raw.pack_tier) ||
    clean(defaults.packTier),

additionalPools:
    Array.isArray(raw.additionalPools)
        ? raw.additionalPools
        : Array.isArray(raw.additional_pools)
            ? raw.additional_pools
            : Array.isArray(defaults.additionalPools)
                ? defaults.additionalPools
                : [],

packWeight:

            normalizeNumber(
                raw.packWeight ??
                raw.pack_weight
            ) || 1,

        imagePath:
            clean(raw.imagePath) ||
            clean(raw.image_path),

        enabled:
            normalizeBoolean(
                raw.enabled,
                true
            )
    }
}

function extractCards(data) {
    if (Array.isArray(data)) {
        return {
            defaults: {},
            cards: data
        }
    }

    if (!data || typeof data !== 'object') {
        throw new Error('El JSON no contiene una estructura válida.')
    }

    if (!Array.isArray(data.cards)) {
        throw new Error(
            'El JSON debe ser un arreglo de cartas o contener una propiedad cards.'
        )
    }

    return {
        defaults:
            data.defaults &&
            typeof data.defaults === 'object' &&
            !Array.isArray(data.defaults)
                ? data.defaults
                : {},
        cards: data.cards
    }
}

async function readJsonFile(filePath) {
    const absolutePath = path.resolve(filePath)
    const content = await fs.readFile(absolutePath, 'utf8')

    let data

    try {
        data = JSON.parse(content)
    } catch (error) {
        throw new Error(
            `JSON inválido en ${absolutePath}: ${error.message}`
        )
    }

    return {
        absolutePath,
        ...extractCards(data)
    }
}

async function importJsonCard(raw, defaults = {}) {
    const normalized = normalizeJsonCard(raw, defaults)

    return importCard(normalized)
}

async function importJsonCards(rawCards, defaults = {}) {
    if (!Array.isArray(rawCards)) {
        throw new Error('Se esperaba un arreglo de cartas.')
    }

    const normalized = []
    const normalizationErrors = []

    for (let index = 0; index < rawCards.length; index++) {
        try {
            normalized.push(
                normalizeJsonCard(
                    rawCards[index],
                    defaults
                )
            )
        } catch (error) {
            normalizationErrors.push({
                index,
                name:
                    rawCards[index]?.name ||
                    rawCards[index]?.playerName ||
                    null,
                error: error.message
            })
        }
    }

    const result = await importCards(normalized)

    return {
        total: rawCards.length,
        normalized: normalized.length,
        imported: result.imported,
        failed:
            normalizationErrors.length +
            result.failed,
        cards: result.cards,
        errors: [
            ...normalizationErrors,
            ...result.errors
        ]
    }
}

async function importJsonFile(filePath) {
    const {
        absolutePath,
        defaults,
        cards
    } = await readJsonFile(filePath)

    const result = await importJsonCards(
        cards,
        defaults
    )

    return {
        file: absolutePath,
        ...result
    }
}

module.exports = {
    normalizeJsonCard,
    readJsonFile,
    importJsonCard,
    importJsonCards,
    importJsonFile
}
const mappings = new Map()

function normalizeName(value) {
    return String(value || '')
        .trim()
        .toUpperCase()
}

function registerMapping(rarityId, config) {
    const id = Number(rarityId)

    if (!Number.isInteger(id)) {
        throw new Error(
            `ID de rarity inválido: ${rarityId}`
        )
    }

    if (!config || typeof config !== 'object') {
        throw new Error(
            `Configuración inválida para rarity ${id}`
        )
    }

    mappings.set(id, {
        promoCode: config.promoCode || null,
        family: config.family || 'PLAYER',
        packable: Boolean(config.packable),
        packTier: config.packTier || null,
        additionalPools: Array.isArray(
            config.additionalPools
        )
            ? [...config.additionalPools]
            : []
    })
}

function getMapping(rarityId) {
    return mappings.get(Number(rarityId)) || null
}

function detectFamily(rarity) {
    const name = normalizeName(rarity?.name)

    if (name.includes('ICON')) {
        return 'ICON'
    }

    if (name.includes('HERO')) {
        return 'HERO'
    }

    return 'PLAYER'
}

function resolveRarity(rarity) {
    if (!rarity) {
        throw new Error(
            'No se recibió una rarity de FUT-DB.'
        )
    }

    const registered = getMapping(rarity.id)

    if (registered) {
        return {
            rarityId: Number(rarity.id),
            rarityName: rarity.name || null,
            version: rarity.version || null,
            rarityGroups:
                rarity.rarity_groups || [],
            ...registered,
            mapped: true
        }
    }

    return {
        rarityId: Number(rarity.id),
        rarityName: rarity.name || null,
        version: rarity.version || null,
        rarityGroups:
            rarity.rarity_groups || [],
        promoCode: null,
        family: detectFamily(rarity),
        packable: false,
        packTier: null,
        additionalPools: [],
        mapped: false
    }
}

function getMappings() {
    return new Map(mappings)
}

function clearMappings() {
    mappings.clear()
}

module.exports = {
    registerMapping,
    getMapping,
    resolveRarity,
    getMappings,
    clearMappings
}
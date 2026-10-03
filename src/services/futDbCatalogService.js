const futDbService = require('./futDbService')

let cache = {
    rarities: null,
    nations: null,
    leagues: null,
    clubs: null
}

function createMap(items) {
    const map = new Map()

    for (const item of items || []) {
        if (
            item &&
            item.id !== undefined &&
            item.id !== null
        ) {
            map.set(Number(item.id), item)
        }
    }

    return map
}

async function loadRarities(force = false) {
    if (!force && cache.rarities) {
        return cache.rarities
    }

    const items =
        await futDbService.getAllRarities()

    cache.rarities = createMap(items)

    return cache.rarities
}

async function loadNations(force = false) {
    if (!force && cache.nations) {
        return cache.nations
    }

    const items =
        await futDbService.getAllNations()

    cache.nations = createMap(items)

    return cache.nations
}

async function loadLeagues(force = false) {
    if (!force && cache.leagues) {
        return cache.leagues
    }

    const items =
        await futDbService.getAllLeagues()

    cache.leagues = createMap(items)

    return cache.leagues
}

async function loadClubs(force = false) {
    if (!force && cache.clubs) {
        return cache.clubs
    }

    const items =
        await futDbService.getAllClubs()

    cache.clubs = createMap(items)

    return cache.clubs
}

async function loadCatalogs(force = false) {
    const rarities =
        await loadRarities(force)

    const nations =
        await loadNations(force)

    const leagues =
        await loadLeagues(force)

    const clubs =
        await loadClubs(force)

    return {
        rarities,
        nations,
        leagues,
        clubs
    }
}

function getRarity(id) {
    return cache.rarities?.get(Number(id)) || null
}

function getNation(id) {
    return cache.nations?.get(Number(id)) || null
}

function getLeague(id) {
    return cache.leagues?.get(Number(id)) || null
}

function getClub(id) {
    return cache.clubs?.get(Number(id)) || null
}

function getRelations() {
    return {
        rarities: cache.rarities || new Map(),
        nations: cache.nations || new Map(),
        leagues: cache.leagues || new Map(),
        clubs: cache.clubs || new Map()
    }
}

function clearCache() {
    cache = {
        rarities: null,
        nations: null,
        leagues: null,
        clubs: null
    }
}

function getCacheStatus() {
    return {
        rarities: cache.rarities?.size || 0,
        nations: cache.nations?.size || 0,
        leagues: cache.leagues?.size || 0,
        clubs: cache.clubs?.size || 0
    }
}

module.exports = {
    loadRarities,
    loadNations,
    loadLeagues,
    loadClubs,
    loadCatalogs,
    getRarity,
    getNation,
    getLeague,
    getClub,
    getRelations,
    clearCache,
    getCacheStatus
}
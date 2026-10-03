require('dotenv').config()

const BASE_URL = 'https://api.futdatabase.com/api'

function getApiKey() {
    const apiKey = process.env.FUTDB_API_KEY

    if (!apiKey) {
        throw new Error(
            'Falta FUTDB_API_KEY en el archivo .env'
        )
    }

    return apiKey
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function request(
    endpoint,
    options = {},
    attempt = 0
) {
    const url = `${BASE_URL}${endpoint}`

    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: 'application/json',
            'X-AUTH-TOKEN': getApiKey(),
            ...options.headers
        }
    })

    if (response.status === 429) {
        const maxRetries = 3

        if (attempt >= maxRetries) {
            const body = await response.text()

            throw new Error(
                `FUT-DB continúa limitando las solicitudes después de ${maxRetries} reintentos` +
                (body ? `: ${body}` : '')
            )
        }

        const retryAfter =
            response.headers.get('retry-after')

        let waitMs = 5000 * (attempt + 1)

        if (retryAfter) {
            const seconds = Number(retryAfter)

            if (Number.isFinite(seconds)) {
                waitMs = Math.max(
                    seconds * 1000,
                    1000
                )
            } else {
                const retryDate =
                    new Date(retryAfter).getTime()

                if (Number.isFinite(retryDate)) {
                    waitMs = Math.max(
                        retryDate - Date.now(),
                        1000
                    )
                }
            }
        }

        console.log(
            `FUT-DB limitó las solicitudes. Reintentando en ${Math.ceil(waitMs / 1000)} segundos...`
        )

        await sleep(waitMs)

        return request(
            endpoint,
            options,
            attempt + 1
        )
    }

    if (!response.ok) {
        const body = await response.text()

        throw new Error(
            `FUT-DB respondió ${response.status} ${response.statusText}` +
            (body ? `: ${body}` : '')
        )
    }

    return response.json()
}

async function getPage(endpoint, page = 1) {
    return request(
        `${endpoint}?page=${encodeURIComponent(page)}`
    )
}

async function getAllPages(endpoint) {
    const first = await getPage(endpoint, 1)

    const items = Array.isArray(first.items)
        ? [...first.items]
        : []

    const pageTotal =
        Number(first.pagination?.pageTotal) || 1

    for (
        let page = 2;
        page <= pageTotal;
        page++
    ) {
        const response =
            await getPage(endpoint, page)

        if (Array.isArray(response.items)) {
            items.push(...response.items)
        }
    }

    return items
}

async function getPlayers(page = 1) {
    return getPage('/players', page)
}

async function getPlayer(playerId) {
    return request(
        `/players/${encodeURIComponent(playerId)}`
    )
}

async function getRarities(page = 1) {
    return getPage('/rarities', page)
}

async function getRarity(rarityId) {
    return request(
        `/rarities/${encodeURIComponent(rarityId)}`
    )
}

async function getAllRarities() {
    return getAllPages('/rarities')
}

async function getNations(page = 1) {
    return getPage('/nations', page)
}

async function getNation(nationId) {
    return request(
        `/nations/${encodeURIComponent(nationId)}`
    )
}

async function getAllNations() {
    return getAllPages('/nations')
}

async function getLeagues(page = 1) {
    return getPage('/leagues', page)
}

async function getLeague(leagueId) {
    return request(
        `/leagues/${encodeURIComponent(leagueId)}`
    )
}

async function getAllLeagues() {
    return getAllPages('/leagues')
}

async function getClubs(page = 1) {
    return getPage('/clubs', page)
}

async function getClub(clubId) {
    return request(
        `/clubs/${encodeURIComponent(clubId)}`
    )
}

async function getAllClubs() {
    return getAllPages('/clubs')
}

module.exports = {
    request,
    getPlayers,
    getPlayer,
    getRarities,
    getRarity,
    getAllRarities,
    getNations,
    getNation,
    getAllNations,
    getLeagues,
    getLeague,
    getAllLeagues,
    getClubs,
    getClub,
    getAllClubs
}
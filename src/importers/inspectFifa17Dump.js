const fs = require('fs/promises')
const path = require('path')

function increment(map, value) {
    const key =
        value === null || value === undefined || value === ''
            ? '(VACÍO)'
            : String(value)

    map.set(key, (map.get(key) || 0) + 1)
}

function sortedEntries(map) {
    return [...map.entries()].sort((a, b) => {
        if (b[1] !== a[1]) {
            return b[1] - a[1]
        }

        return a[0].localeCompare(b[0])
    })
}

async function inspectFifa17Dump(playersDir) {
    const files = await fs.readdir(playersDir)

    const playerFiles = files
        .filter(name => /^players_\d+\.json$/i.test(name))
        .sort((a, b) => {
            const aNumber = Number(a.match(/\d+/)[0])
            const bNumber = Number(b.match(/\d+/)[0])
            return aNumber - bNumber
        })

    if (!playerFiles.length) {
        throw new Error(
            `No se encontraron archivos players_*.json en: ${playersDir}`
        )
    }

    const colors = new Map()
    const playerTypes = new Map()
    const qualities = new Map()
    const itemTypes = new Map()

    const combinations = new Map()

    const cardIds = new Set()
    const baseIds = new Set()

    let totalCards = 0
    let duplicateCardIds = 0
    let missingCardIds = 0
    let missingBaseIds = 0
    let invalidFiles = 0
    let declaredTotalResults = null
    let declaredTotalPages = null

    for (let index = 0; index < playerFiles.length; index++) {
        const fileName = playerFiles[index]
        const filePath = path.join(playersDir, fileName)

        try {
            const text = await fs.readFile(filePath, 'utf8')
            const data = JSON.parse(text)

            if (declaredTotalResults === null && data.totalResults !== undefined) {
                declaredTotalResults = Number(data.totalResults)
            }

            if (declaredTotalPages === null && data.totalPages !== undefined) {
                declaredTotalPages = Number(data.totalPages)
            }

            const items = Array.isArray(data.items) ? data.items : []

            for (const card of items) {
                totalCards++

                increment(colors, card.color)
                increment(playerTypes, card.playerType)
                increment(qualities, card.quality)
                increment(itemTypes, card.itemType)

                const combination = [
                    card.color ?? '(VACÍO)',
                    card.playerType ?? '(VACÍO)',
                    card.quality ?? '(VACÍO)'
                ].join(' | ')

                increment(combinations, combination)

                if (
                    card.id === null ||
                    card.id === undefined ||
                    card.id === ''
                ) {
                    missingCardIds++
                } else {
                    const id = String(card.id)

                    if (cardIds.has(id)) {
                        duplicateCardIds++
                    }

                    cardIds.add(id)
                }

                if (
                    card.baseId === null ||
                    card.baseId === undefined ||
                    card.baseId === ''
                ) {
                    missingBaseIds++
                } else {
                    baseIds.add(String(card.baseId))
                }
            }

            if (
                (index + 1) % 50 === 0 ||
                index === playerFiles.length - 1
            ) {
                console.log(
                    `Analizados ${index + 1}/${playerFiles.length} archivos...`
                )
            }
        } catch (error) {
            invalidFiles++

            console.error(
                `Error en ${fileName}: ${error.message}`
            )
        }
    }

    console.log('\n========================================')
    console.log('FIFA 17 DUMP - RESUMEN')
    console.log('========================================')
    console.log(`Archivos encontrados: ${playerFiles.length}`)
    console.log(`Archivos con error: ${invalidFiles}`)
    console.log(`Páginas declaradas: ${declaredTotalPages ?? 'N/D'}`)
    console.log(`Resultados declarados: ${declaredTotalResults ?? 'N/D'}`)
    console.log(`Cartas leídas: ${totalCards}`)
    console.log(`IDs de carta únicos: ${cardIds.size}`)
    console.log(`IDs de carta duplicados: ${duplicateCardIds}`)
    console.log(`Cartas sin ID: ${missingCardIds}`)
    console.log(`Futbolistas únicos por baseId: ${baseIds.size}`)
    console.log(`Cartas sin baseId: ${missingBaseIds}`)

    console.log('\n========================================')
    console.log('COLOR')
    console.log('========================================')

    for (const [value, count] of sortedEntries(colors)) {
        console.log(`${value}: ${count}`)
    }

    console.log('\n========================================')
    console.log('PLAYER TYPE')
    console.log('========================================')

    for (const [value, count] of sortedEntries(playerTypes)) {
        console.log(`${value}: ${count}`)
    }

    console.log('\n========================================')
    console.log('QUALITY')
    console.log('========================================')

    for (const [value, count] of sortedEntries(qualities)) {
        console.log(`${value}: ${count}`)
    }

    console.log('\n========================================')
    console.log('ITEM TYPE')
    console.log('========================================')

    for (const [value, count] of sortedEntries(itemTypes)) {
        console.log(`${value}: ${count}`)
    }

    console.log('\n========================================')
    console.log('COLOR | PLAYER TYPE | QUALITY')
    console.log('========================================')

    for (const [value, count] of sortedEntries(combinations)) {
        console.log(`${value}: ${count}`)
    }
}

const playersDir = process.argv[2]

if (!playersDir) {
    console.error(
        'Uso: node src/importers/inspectFifa17Dump.js "RUTA\\A\\2017\\players"'
    )

    process.exit(1)
}

inspectFifa17Dump(path.resolve(playersDir))
    .catch(error => {
        console.error('\nError:', error.message)
        process.exit(1)
    })
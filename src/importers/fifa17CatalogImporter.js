const fs = require('fs/promises')
const path = require('path')

const {
    importFifa17Cards
} = require('./fifa17Importer')

function isObject(value) {
    return (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
    )
}

function findCardArray(data) {
    if (Array.isArray(data)) {
        return data
    }

    if (!isObject(data)) {
        return null
    }

    const candidates = [
        data.items,
        data.players,
        data.cards,
        data.results,
        data.data,
        data.entries
    ]

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            return candidate
        }

        if (isObject(candidate)) {
            const nested = findCardArray(candidate)

            if (nested) {
                return nested
            }
        }
    }

    return null
}

function splitIntoBatches(items, batchSize) {
    const batches = []

    for (
        let index = 0;
        index < items.length;
        index += batchSize
    ) {
        batches.push(
            items.slice(
                index,
                index + batchSize
            )
        )
    }

    return batches
}

function mergeFailures(
    target,
    failures,
    batchIndex,
    startIndex
) {
    if (!Array.isArray(failures)) {
        return
    }

    for (const failure of failures) {
        target.push({
            ...failure,
            batchIndex,
            sourceIndex:
                Number.isInteger(failure.index)
                    ? startIndex + failure.index
                    : null
        })
    }
}

async function readCatalogFile(filePath) {
    const resolvedPath =
        path.resolve(filePath)

    const content =
        await fs.readFile(
            resolvedPath,
            'utf8'
        )

    let data

    try {
        data = JSON.parse(content)
    } catch (error) {
        throw new Error(
            `El archivo FIFA 17 no contiene JSON válido: ${error.message}`
        )
    }

    const cards = findCardArray(data)

    if (!cards) {
        throw new Error(
            'No se encontró un arreglo de cartas dentro del archivo FIFA 17.'
        )
    }

    return {
        filePath: resolvedPath,
        data,
        cards
    }
}

async function importFifa17Catalog(
    filePath,
    options = {}
) {
    const batchSize =
        Number.isInteger(options.batchSize) &&
        options.batchSize > 0
            ? options.batchSize
            : 100

    const {
        filePath: resolvedPath,
        cards
    } = await readCatalogFile(
        filePath
    )

    if (cards.length === 0) {
        return {
            filePath: resolvedPath,
            total: 0,
            processed: 0,
            imported: 0,
            failed: 0,
            normalizationFailed: 0,
            batches: 0,
            failures: [],
            normalizationFailures: []
        }
    }

    const batches =
        splitIntoBatches(
            cards,
            batchSize
        )

    const summary = {
        filePath: resolvedPath,
        total: cards.length,
        processed: 0,
        imported: 0,
        failed: 0,
        normalizationFailed: 0,
        batches: batches.length,
        failures: [],
        normalizationFailures: []
    }

    for (
        let batchIndex = 0;
        batchIndex < batches.length;
        batchIndex++
    ) {
        const batch =
            batches[batchIndex]

        const startIndex =
            batchIndex * batchSize

        let result

        try {
            result =
                await importFifa17Cards(
                    batch
                )
        } catch (error) {
            summary.failed +=
                batch.length

            summary.processed +=
                batch.length

            summary.failures.push({
                batchIndex,
                sourceIndex: startIndex,
                batchSize: batch.length,
                error: error.message
            })

            continue
        }

        summary.processed +=
            batch.length

        summary.imported +=
            Number(result.imported) || 0

        summary.failed +=
            Number(result.failed) || 0

        summary.normalizationFailed +=
            Number(
                result.normalizationFailed
            ) || 0

        mergeFailures(
            summary.failures,
            result.failures,
            batchIndex,
            startIndex
        )

        mergeFailures(
            summary.normalizationFailures,
            result.normalizationFailures,
            batchIndex,
            startIndex
        )
    }

    return summary
}

async function inspectFifa17Catalog(
    filePath
) {
    const {
        filePath: resolvedPath,
        cards
    } = await readCatalogFile(
        filePath
    )

    const rarityCounts = {}

    for (const card of cards) {
        const rarity =
            card.rarityName ||
            card.rarity_name ||
            card.rarity ||
            card.cardType ||
            card.card_type ||
            card.version ||
            card.type ||
            'UNKNOWN'

        const key =
            String(rarity).trim() ||
            'UNKNOWN'

        rarityCounts[key] =
            (rarityCounts[key] || 0) + 1
    }

    return {
        filePath: resolvedPath,
        total: cards.length,
        rarityCounts,
        sample:
            cards.slice(0, 5)
    }
}

module.exports = {
    findCardArray,
    readCatalogFile,
    inspectFifa17Catalog,
    importFifa17Catalog
}
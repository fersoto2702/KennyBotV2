const fs = require('fs')
const path = require('path')

const {
    normalizeFifa17Card
} = require('./src/importers/fifa17Importer')

const {
    pool
} = require('./src/database/mysql')

const PLAYERS_DIR =
    'C:\\Users\\Ferna\\OneDrive\\Desktop\\Nueva Carpeta\\data-master\\2017\\players'

async function main() {
    const [promos] = await pool.execute(`
        SELECT code, enabled
        FROM ut_promos
    `)

    const [dbPools] = await pool.execute(`
        SELECT code, enabled
        FROM ut_pack_pools
    `)

    const promoMap = new Map(
        promos.map(row => [
            String(row.code).toUpperCase(),
            Boolean(row.enabled)
        ])
    )

    const poolMap = new Map(
        dbPools.map(row => [
            String(row.code).toUpperCase(),
            Boolean(row.enabled)
        ])
    )

    const files = fs
        .readdirSync(PLAYERS_DIR)
        .filter(file =>
            /^players_\d+\.json$/i.test(file)
        )
        .sort((a, b) =>
            Number(a.match(/\d+/)[0]) -
            Number(b.match(/\d+/)[0])
        )

    let filesProcessed = 0
    let cardsFound = 0
    let cardsReady = 0

    const errors = []

    const promoUsage = {}
    const poolUsage = {}

    for (const file of files) {
        const filePath = path.join(
            PLAYERS_DIR,
            file
        )

        const json = JSON.parse(
            fs.readFileSync(
                filePath,
                'utf8'
            )
        )

        if (!Array.isArray(json.items)) {
            errors.push({
                file,
                type: 'INVALID_FILE',
                details:
                    'El archivo no contiene items[].'
            })

            continue
        }

        filesProcessed++

        for (const rawCard of json.items) {
            cardsFound++

            try {
                const card =
                    normalizeFifa17Card(
                        rawCard
                    )

                const promoCode =
                    String(
                        card.promoCode || ''
                    ).toUpperCase()

                promoUsage[promoCode] =
                    (promoUsage[promoCode] || 0) + 1

                /*
                 * Comprobar promo
                 */

                if (!promoMap.has(promoCode)) {
                    errors.push({
                        file,
                        id: rawCard.id,
                        name: card.name,
                        type: 'MISSING_PROMO',
                        details:
                            `No existe la promo ${promoCode}`
                    })

                    continue
                }

                if (!promoMap.get(promoCode)) {
                    errors.push({
                        file,
                        id: rawCard.id,
                        name: card.name,
                        type: 'DISABLED_PROMO',
                        details:
                            `La promo ${promoCode} está deshabilitada`
                    })

                    continue
                }

                /*
                 * Determinar pools que realmente
                 * necesitará assignAutomaticPools()
                 */

                const requiredPools =
                    new Set()

                if (card.packable) {
                    const tier =
                        String(
                            card.packTier || ''
                        ).toUpperCase()

                    const family =
                        String(
                            card.family || ''
                        ).toUpperCase()

                    if (
                        [
                            'GOLD',
                            'SILVER',
                            'BRONZE',
                            'PERFORMANCE',
                            'SPECIAL'
                        ].includes(tier)
                    ) {
                        requiredPools.add(tier)
                    }

                    if (family === 'HERO') {
                        requiredPools.add('HERO')
                        requiredPools.add('SPECIAL')
                    }

                    if (family === 'ICON') {
                        requiredPools.add('ICON')
                        requiredPools.add('SPECIAL')
                    }

                    if (
                        Array.isArray(
                            card.additionalPools
                        )
                    ) {
                        for (
                            const additionalPool
                            of card.additionalPools
                        ) {
                            requiredPools.add(
                                String(
                                    additionalPool
                                ).toUpperCase()
                            )
                        }
                    }
                }

                let valid = true

                for (
                    const requiredPool
                    of requiredPools
                ) {
                    poolUsage[requiredPool] =
                        (poolUsage[requiredPool] || 0) + 1

                    if (
                        !poolMap.has(
                            requiredPool
                        )
                    ) {
                        valid = false

                        errors.push({
                            file,
                            id: rawCard.id,
                            name: card.name,
                            promo: promoCode,
                            type: 'MISSING_POOL',
                            details:
                                `No existe el pool ${requiredPool}`
                        })

                        continue
                    }

                    if (
                        !poolMap.get(
                            requiredPool
                        )
                    ) {
                        valid = false

                        errors.push({
                            file,
                            id: rawCard.id,
                            name: card.name,
                            promo: promoCode,
                            type: 'DISABLED_POOL',
                            details:
                                `El pool ${requiredPool} está deshabilitado`
                        })
                    }
                }

                if (valid) {
                    cardsReady++
                }
            } catch (error) {
                errors.push({
                    file,
                    id:
                        rawCard.id ??
                        null,
                    name:
                        rawCard.name ??
                        'Desconocido',
                    type:
                        'NORMALIZATION_ERROR',
                    details:
                        error.message
                })
            }
        }
    }

    console.log('')
    console.log(
        '================================'
    )
    console.log(
        ' FIFA 17 IMPORT PREFLIGHT'
    )
    console.log(
        '================================'
    )

    console.log(
        `Archivos procesados: ${filesProcessed}`
    )

    console.log(
        `Cartas encontradas:  ${cardsFound}`
    )

    console.log(
        `Cartas preparadas:   ${cardsReady}`
    )

    console.log(
        `Errores:             ${errors.length}`
    )

    console.log(
        '================================'
    )

    console.log('')
    console.log('USO DE PROMOS:')

    console.table(
        Object.entries(promoUsage)
            .sort(
                (a, b) =>
                    b[1] - a[1]
            )
            .map(
                ([promo, count]) => ({
                    promo,
                    count
                })
            )
    )

    console.log('')
    console.log('USO DE POOLS:')

    console.table(
        Object.entries(poolUsage)
            .sort(
                (a, b) =>
                    b[1] - a[1]
            )
            .map(
                ([poolCode, count]) => ({
                    pool: poolCode,
                    count
                })
            )
    )

    if (errors.length > 0) {
        console.log('')
        console.log(
            'RESUMEN DE ERRORES:'
        )

        const summary = {}

        for (const error of errors) {
            summary[error.type] =
                (summary[error.type] || 0) + 1
        }

        console.table(
            Object.entries(summary)
                .map(
                    ([type, count]) => ({
                        type,
                        count
                    })
                )
        )

        console.log('')
        console.log(
            'PRIMEROS 20 ERRORES:'
        )

        console.table(
            errors.slice(0, 20)
        )

        const errorFile = path.join(
            __dirname,
            'fifa17-preflight-errors.json'
        )

        fs.writeFileSync(
            errorFile,
            JSON.stringify(
                errors,
                null,
                2
            ),
            'utf8'
        )

        console.log('')
        console.log(
            `Errores guardados en: ${errorFile}`
        )
    } else {
        console.log('')
        console.log(
            'OK - Las 15768 cartas están preparadas para importar.'
        )
    }
}

main()
    .catch(error => {
        console.error('')
        console.error(
            'ERROR GENERAL DEL PREFLIGHT:'
        )
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await pool.end()
    })
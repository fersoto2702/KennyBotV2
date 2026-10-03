const fs = require('fs')
const path = require('path')

const {
    normalizeFifa17Card
} = require('./src/importers/fifa17Importer')

const PLAYERS_DIR =
    'C:\\Users\\Ferna\\OneDrive\\Desktop\\Nueva Carpeta\\data-master\\2017\\players'

let filesProcessed = 0
let cardsFound = 0
let normalized = 0
let failed = 0

let goalkeepers = 0
let fieldPlayers = 0

const failures = []
const warnings = []

const files = fs
    .readdirSync(PLAYERS_DIR)
    .filter(file =>
        /^players_\d+\.json$/i.test(file)
    )
    .sort((a, b) => {
        const numberA = Number(
            a.match(/\d+/)[0]
        )

        const numberB = Number(
            b.match(/\d+/)[0]
        )

        return numberA - numberB
    })

function isValidStat(value) {
    return (
        value !== null &&
        value !== undefined &&
        Number.isFinite(Number(value)) &&
        Number(value) >= 1 &&
        Number(value) <= 99
    )
}

function addWarning(
    file,
    rawCard,
    card,
    type,
    details
) {
    warnings.push({
        file,
        id:
            rawCard.id ??
            null,
        name:
            card.name ||
            rawCard.name ||
            'Desconocido',
        rating:
            card.rating ??
            rawCard.rating ??
            null,
        position:
            card.position ??
            rawCard.position ??
            null,
        type,
        details
    })
}

function auditCard(
    file,
    rawCard,
    card
) {
    const position =
        String(card.position || '')
            .trim()
            .toUpperCase()

    /*
     * Validaciones generales
     */

    if (
        !Number.isInteger(card.rating) ||
        card.rating < 1 ||
        card.rating > 99
    ) {
        addWarning(
            file,
            rawCard,
            card,
            'INVALID_RATING',
            `Rating inválido: ${card.rating}`
        )
    }

    if (!card.name) {
        addWarning(
            file,
            rawCard,
            card,
            'MISSING_NAME',
            'La carta no tiene nombre.'
        )
    }

    if (!card.nationality) {
        addWarning(
            file,
            rawCard,
            card,
            'MISSING_NATIONALITY',
            'La carta no tiene nacionalidad.'
        )
    }

    if (!card.club) {
        addWarning(
            file,
            rawCard,
            card,
            'MISSING_CLUB',
            'La carta no tiene club.'
        )
    }

    if (!card.league) {
        addWarning(
            file,
            rawCard,
            card,
            'MISSING_LEAGUE',
            'La carta no tiene liga.'
        )
    }

    /*
     * Porteros
     */

    if (position === 'GK') {
        goalkeepers++

        const goalkeeperStats = {
            DIV: card.div,
            HAN: card.han,
            KIC: card.kic,
            REF: card.ref,
            SPD: card.spd,
            POS: card.pos
        }

        const missing = Object
            .entries(goalkeeperStats)
            .filter(
                ([, value]) =>
                    !isValidStat(value)
            )
            .map(([stat]) => stat)

        if (missing.length > 0) {
            addWarning(
                file,
                rawCard,
                card,
                'GK_MISSING_STATS',
                `Faltan o son inválidos: ${missing.join(', ')}`
            )
        }

        return
    }

    /*
     * Jugadores de campo
     */

    fieldPlayers++

    const fieldStats = {
        PAC: card.pac,
        SHO: card.sho,
        PAS: card.pas,
        DRI: card.dri,
        DEF: card.def,
        PHY: card.phy
    }

    const missing = Object
        .entries(fieldStats)
        .filter(
            ([, value]) =>
                !isValidStat(value)
        )
        .map(([stat]) => stat)

    if (missing.length > 0) {
        addWarning(
            file,
            rawCard,
            card,
            'FIELD_MISSING_STATS',
            `Faltan o son inválidos: ${missing.join(', ')}`
        )
    }
}

for (const file of files) {
    const filePath = path.join(
        PLAYERS_DIR,
        file
    )

    try {
        const content = fs.readFileSync(
            filePath,
            'utf8'
        )

        const json = JSON.parse(content)

        if (!Array.isArray(json.items)) {
            failures.push({
                file,
                name: null,
                error:
                    'El archivo no contiene items[]'
            })

            failed++
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

                normalized++

                auditCard(
                    file,
                    rawCard,
                    card
                )
            } catch (error) {
                failed++

                failures.push({
                    file,
                    name:
                        rawCard.name ||
                        rawCard.commonName ||
                        'Desconocido',
                    rating:
                        rawCard.rating ??
                        null,
                    id:
                        rawCard.id ??
                        null,
                    playerType:
                        rawCard.playerType ??
                        null,
                    color:
                        rawCard.color ??
                        null,
                    error:
                        error.message
                })
            }
        }
    } catch (error) {
        failed++

        failures.push({
            file,
            name: null,
            error: error.message
        })
    }
}

console.log('')
console.log('================================')
console.log(' FIFA 17 DATA AUDIT')
console.log('================================')
console.log(
    `Archivos procesados:     ${filesProcessed}`
)
console.log(
    `Cartas encontradas:      ${cardsFound}`
)
console.log(
    `Normalizadas:            ${normalized}`
)
console.log(
    `Fallidas:                ${failed}`
)
console.log(
    `Jugadores de campo:      ${fieldPlayers}`
)
console.log(
    `Porteros:                ${goalkeepers}`
)
console.log(
    `Advertencias de datos:   ${warnings.length}`
)
console.log('================================')

if (failures.length === 0) {
    console.log('')
    console.log(
        'OK - Todas las cartas se normalizaron correctamente.'
    )
} else {
    console.log('')
    console.log('ERRORES DE NORMALIZACIÓN:')
    console.table(failures)

    const errorFile = path.join(
        __dirname,
        'fifa17-normalization-errors.json'
    )

    fs.writeFileSync(
        errorFile,
        JSON.stringify(
            failures,
            null,
            2
        ),
        'utf8'
    )

    console.log('')
    console.log(
        `Errores guardados en: ${errorFile}`
    )
}

if (warnings.length > 0) {
    const warningFile = path.join(
        __dirname,
        'fifa17-data-warnings.json'
    )

    fs.writeFileSync(
        warningFile,
        JSON.stringify(
            warnings,
            null,
            2
        ),
        'utf8'
    )

    console.log('')
    console.log(
        'Se encontraron advertencias de datos.'
    )

    console.log(
        `Advertencias guardadas en: ${warningFile}`
    )

    /*
     * Resumen por tipo
     */

    const warningSummary = {}

    for (const warning of warnings) {
        warningSummary[warning.type] =
            (warningSummary[warning.type] || 0) + 1
    }

    console.log('')
    console.log('RESUMEN DE ADVERTENCIAS:')
    console.table(
        Object.entries(warningSummary)
            .map(([type, count]) => ({
                type,
                count
            }))
    )

    console.log('')
    console.log(
        'Primeras 20 advertencias:'
    )

    console.table(
        warnings.slice(0, 20)
    )
} else {
    console.log('')
    console.log(
        'OK - No se detectaron advertencias de datos.'
    )
}
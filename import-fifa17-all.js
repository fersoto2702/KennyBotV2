const fs = require('fs')
const path = require('path')

const {
    importFifa17Cards
} = require('./src/importers/fifa17Importer')

const {
    pool
} = require('./src/database/mysql')

const PLAYERS_DIR =
    'C:\\Users\\Ferna\\OneDrive\\Desktop\\Nueva Carpeta\\data-master\\2017\\players'

const ERROR_FILE = path.join(
    __dirname,
    'fifa17-import-errors.json'
)

function getPageNumber(file) {
    const match = file.match(
        /^players_(\d+)\.json$/i
    )

    return match
        ? Number(match[1])
        : null
}

async function main() {
    const files = fs
        .readdirSync(PLAYERS_DIR)
        .filter(file =>
            /^players_\d+\.json$/i.test(file)
        )
        .sort(
            (a, b) =>
                getPageNumber(a) -
                getPageNumber(b)
        )

    console.log('')
    console.log(
        '========================================'
    )
    console.log(
        ' FIFA 17 - IMPORTACIÓN COMPLETA'
    )
    console.log(
        '========================================'
    )
    console.log(
        `Archivos encontrados: ${files.length}`
    )
    console.log('')

    if (files.length !== 657) {
        throw new Error(
            `Se esperaban 657 archivos y se encontraron ${files.length}.`
        )
    }

    let totalFound = 0
    let totalNormalized = 0
    let totalImported = 0
    let totalFailed = 0
    let totalNormalizationFailed = 0

    const errors = []

    const startedAt = Date.now()

    for (
        let fileIndex = 0;
        fileIndex < files.length;
        fileIndex++
    ) {
        const file = files[fileIndex]

        const filePath = path.join(
            PLAYERS_DIR,
            file
        )

        const pageNumber =
            getPageNumber(file)

        try {
            const json = JSON.parse(
                fs.readFileSync(
                    filePath,
                    'utf8'
                )
            )

            if (!Array.isArray(json.items)) {
                throw new Error(
                    `${file} no contiene items[].`
                )
            }

            totalFound +=
                json.items.length

            const result =
                await importFifa17Cards(
                    json.items
                )

            totalNormalized +=
                Number(
                    result.normalized || 0
                )

            totalImported +=
                Number(
                    result.imported || 0
                )

            totalFailed +=
                Number(
                    result.failed || 0
                )

            totalNormalizationFailed +=
                Number(
                    result.normalizationFailed || 0
                )

            if (
                Array.isArray(result.errors) &&
                result.errors.length > 0
            ) {
                for (
                    const error
                    of result.errors
                ) {
                    errors.push({
                        file,
                        page: pageNumber,
                        stage: 'IMPORT',
                        ...error
                    })
                }
            }

            if (
                Array.isArray(
                    result.normalizationFailures
                ) &&
                result.normalizationFailures.length > 0
            ) {
                for (
                    const error
                    of result.normalizationFailures
                ) {
                    errors.push({
                        file,
                        page: pageNumber,
                        stage: 'NORMALIZATION',
                        ...error
                    })
                }
            }

            const processed =
                fileIndex + 1

            const elapsedSeconds =
                (Date.now() - startedAt) /
                1000

            const averagePerFile =
                elapsedSeconds /
                processed

            const remainingFiles =
                files.length -
                processed

            const etaSeconds =
                averagePerFile *
                remainingFiles

            const etaMinutes =
                etaSeconds / 60

            console.log(
                `[${String(processed).padStart(3, '0')}/${files.length}] ` +
                `${file} | ` +
                `cartas: ${json.items.length} | ` +
                `importadas: ${result.imported || 0} | ` +
                `errores: ${
                    Number(result.failed || 0) +
                    Number(
                        result.normalizationFailed || 0
                    )
                } | ` +
                `total: ${totalImported} | ` +
                `ETA: ${etaMinutes.toFixed(1)} min`
            )
        } catch (error) {
            totalFailed++

            errors.push({
                file,
                page: pageNumber,
                stage: 'FILE',
                error: error.message
            })

            console.error(
                `[ERROR] ${file}: ${error.message}`
            )
        }
    }

    const elapsedSeconds =
        (Date.now() - startedAt) /
        1000

    console.log('')
    console.log(
        '========================================'
    )
    console.log(
        ' RESULTADO FINAL'
    )
    console.log(
        '========================================'
    )

    console.log(
        `Archivos procesados:        ${files.length}`
    )

    console.log(
        `Cartas encontradas:         ${totalFound}`
    )

    console.log(
        `Normalizadas:               ${totalNormalized}`
    )

    console.log(
        `Importadas:                 ${totalImported}`
    )

    console.log(
        `Fallos de importación:      ${totalFailed}`
    )

    console.log(
        `Fallos de normalización:    ${totalNormalizationFailed}`
    )

    console.log(
        `Errores registrados:        ${errors.length}`
    )

    console.log(
        `Tiempo total:               ${(elapsedSeconds / 60).toFixed(2)} min`
    )

    console.log(
        '========================================'
    )

    if (errors.length > 0) {
        fs.writeFileSync(
            ERROR_FILE,
            JSON.stringify(
                errors,
                null,
                2
            ),
            'utf8'
        )

        console.log('')
        console.log(
            `Se guardó el registro de errores en:`
        )

        console.log(
            ERROR_FILE
        )
    } else {
        if (
            fs.existsSync(ERROR_FILE)
        ) {
            fs.unlinkSync(
                ERROR_FILE
            )
        }

        console.log('')
        console.log(
            'OK - Importación FIFA 17 completada sin errores.'
        )
    }
}

main()
    .catch(error => {
        console.error('')
        console.error(
            'ERROR GENERAL DE IMPORTACIÓN:'
        )
        console.error(error)

        process.exitCode = 1
    })
    .finally(async () => {
        await pool.end()
    })
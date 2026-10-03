const fs = require('fs')

const {
    importFifa17Cards
} = require('./src/importers/fifa17Importer')

const {
    pool
} = require('./src/database/mysql')

const FILE =
    'C:\\Users\\Ferna\\OneDrive\\Desktop\\Nueva Carpeta\\data-master\\2017\\players\\players_1.json'

async function main() {
    console.log('')
    console.log('================================')
    console.log(' FIFA 17 PAGE IMPORT TEST')
    console.log('================================')
    console.log(`Archivo: ${FILE}`)

    const json = JSON.parse(
        fs.readFileSync(
            FILE,
            'utf8'
        )
    )

    if (!Array.isArray(json.items)) {
        throw new Error(
            'players_1.json no contiene items[].'
        )
    }

    console.log(
        `Cartas encontradas: ${json.items.length}`
    )

    console.log('')
    console.log(
        'Importando players_1.json...'
    )

    const result =
        await importFifa17Cards(
            json.items
        )

    console.log('')
    console.log('================================')
    console.log(' RESULTADO')
    console.log('================================')

    console.dir(
        result,
        {
            depth: null,
            colors: true
        }
    )

    console.log('================================')

    if (
        result.failed === 0 &&
        result.normalizationFailed === 0
    ) {
        console.log('')
        console.log(
            'OK - El lote se importó sin errores.'
        )
    } else {
        console.log('')
        console.log(
            'ATENCIÓN - El lote presentó errores.'
        )
    }
}

main()
    .catch(error => {
        console.error('')
        console.error(
            'ERROR GENERAL:'
        )

        console.error(error)

        process.exitCode = 1
    })
    .finally(async () => {
        await pool.end()
    })
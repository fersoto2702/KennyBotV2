const fs = require('fs')
const path = require('path')

const {
    importFifa17Card,
    normalizeFifa17Card
} = require('./src/importers/fifa17Importer')

const PLAYERS_DIR =
    'C:\\Users\\Ferna\\OneDrive\\Desktop\\Nueva Carpeta\\data-master\\2017\\players'

async function main() {
    const files = fs
        .readdirSync(PLAYERS_DIR)
        .filter(file =>
            /^players_\d+\.json$/i.test(file)
        )
        .sort((a, b) => {
            const numberA = Number(a.match(/\d+/)[0])
            const numberB = Number(b.match(/\d+/)[0])

            return numberA - numberB
        })

    let neuer = null
    let sourceFile = null

    for (const file of files) {
        const filePath = path.join(
            PLAYERS_DIR,
            file
        )

        const json = JSON.parse(
            fs.readFileSync(filePath, 'utf8')
        )

        if (!Array.isArray(json.items)) {
            continue
        }

        neuer = json.items.find(card =>
            String(card.id) === '50499143'
        )

        if (neuer) {
            sourceFile = file
            break
        }
    }

    if (!neuer) {
        throw new Error(
            'No se encontró Neuer TOTY 98.'
        )
    }

    console.log('')
    console.log('Carta encontrada:')
    console.log(`Archivo:  ${sourceFile}`)
    console.log(`Nombre:   ${neuer.name}`)
    console.log(`Rating:   ${neuer.rating}`)
    console.log(`Position: ${neuer.position}`)
    console.log(`Color:    ${neuer.color}`)
    console.log(`ID:       ${neuer.id}`)

    const normalized =
        normalizeFifa17Card(neuer)

    console.log('')
    console.log('STATS NORMALIZADOS:')
    console.log({
    pac: normalized.pac,
    sho: normalized.sho,
    pas: normalized.pas,
    dri: normalized.dri,
    def: normalized.def,
    phy: normalized.phy,

    div: normalized.div,
    han: normalized.han,
    kic: normalized.kic,
    ref: normalized.ref,
    spd: normalized.spd,
    pos: normalized.pos
})

    console.log('')
    console.log('Importando...')

    const result =
        await importFifa17Card(neuer)

    console.log('')
    console.log('================================')
    console.log(' IMPORTACIÓN FIFA 17')
    console.log('================================')
    console.log(result)
    console.log('================================')
}

main()
    .then(() => {
        console.log('')
        console.log('OK - Prueba terminada.')
        process.exit(0)
    })
    .catch(error => {
        console.error('')
        console.error('ERROR:')
        console.error(error)
        process.exit(1)
    })
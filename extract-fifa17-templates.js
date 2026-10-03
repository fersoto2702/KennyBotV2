const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const FUTGUI_DIR = path.join(
    __dirname,
    'fifa17-futgui-reference',
    'images',
    'cards'
)

const CARDS_JSON = path.join(
    FUTGUI_DIR,
    'cards_big.json'
)

const OUTPUT_DIR = path.join(
    __dirname,
    'fifa17-templates'
)

async function main() {
    console.log('')
    console.log('====================================')
    console.log(' FIFA 17 - TEMPLATE EXTRACTOR')
    console.log('====================================')
    console.log('')

    if (!fs.existsSync(CARDS_JSON)) {
        throw new Error(
            `No existe cards_big.json: ${CARDS_JSON}`
        )
    }

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, {
            recursive: true
        })
    }

    const cards = JSON.parse(
        fs.readFileSync(CARDS_JSON, 'utf8')
    )

    const entries = Object.entries(cards)
        .filter(([cardType]) => String(cardType).trim())

    console.log(
        `Plantillas encontradas: ${entries.length}`
    )

    console.log('')

    let extracted = 0
    let failed = 0

    for (const [cardType, config] of entries) {
        try {
            const imageGroup = config.image
            const position = Number(config.position)
            const width = Number(config.width)
            const height = Number(config.height)

            if (
                !imageGroup ||
                !Number.isFinite(position) ||
                !Number.isFinite(width) ||
                !Number.isFinite(height)
            ) {
                throw new Error(
                    'Configuración inválida'
                )
            }

            const spriteFile = path.join(
                FUTGUI_DIR,
                `${imageGroup}.png`
            )

            if (!fs.existsSync(spriteFile)) {
                throw new Error(
                    `No existe ${imageGroup}.png`
                )
            }

            const outputFile = path.join(
                OUTPUT_DIR,
                `fifa17-${cardType}-template.png`
            )

            await sharp(spriteFile)
                .extract({
                    left: 0,
                    top: position,
                    width,
                    height
                })
                .png()
                .toFile(outputFile)

            extracted++

            console.log(
                `[OK] ${cardType.padEnd(24)} ` +
                `${imageGroup} ` +
                `y=${position} ` +
                `${width}x${height}`
            )
        } catch (error) {
            failed++

            console.error(
                `[ERROR] ${cardType}: ${error.message}`
            )
        }
    }

    console.log('')
    console.log('====================================')
    console.log(' EXTRACCIÓN FINALIZADA')
    console.log('====================================')
    console.log(`Extraídas: ${extracted}`)
    console.log(`Fallidas:  ${failed}`)
    console.log(`Total:     ${entries.length}`)
    console.log('')
    console.log(`Carpeta: ${OUTPUT_DIR}`)
    console.log('')
}

main().catch(error => {
    console.error('')
    console.error('ERROR GENERAL:')
    console.error(error)
    process.exitCode = 1
})
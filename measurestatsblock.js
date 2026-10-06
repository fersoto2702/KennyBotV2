const sharp = require('sharp')

// Uso:
//   node .\measure-stats-block.js movember
//   node .\measure-stats-block.js .\mi-plantilla.png
//
// Mide, a tamaño de carta (227 x 346), dónde empieza y termina el bloque
// oscuro de stats en una plantilla, para ponerlo en el estilo como statsBlock.

const CARD_WIDTH = 227
const CARD_HEIGHT = Math.round(355 * (227 / 233))

const target = process.argv[2]

if (!target) {
    console.error('')
    console.error('Indica el nombre del estilo o la ruta de un PNG.')
    console.error('Ejemplo: node .\\measure-stats-block.js movember')
    process.exit(1)
}

function resolveTemplate(value) {
    if (/\.png$/i.test(value)) {
        return value
    }

    const { getFifa17CardStyle } = require('./src/services/fifa17CardStyle')

    return getFifa17CardStyle(value).template
}

async function main() {
    const template = resolveTemplate(target)

    const { data, info } =
        await sharp(template)
            .resize(
                CARD_WIDTH,
                CARD_HEIGHT,
                {
                    fit: 'fill'
                }
            )
            .removeAlpha()
            .raw()
            .toBuffer({
                resolveWithObject: true
            })

    const luminance = (x, y) => {
        const index = (y * info.width + x) * info.channels

        return (
            data[index] +
            data[index + 1] +
            data[index + 2]
        ) / 3
    }

    // Columnas dentro del bloque pero a la izquierda del texto de stats
    const columns = [26, 30, 34]

    const results = []

    for (const x of columns) {
        let bestStart = null
        let bestEnd = null
        let runStart = null

        for (let y = 165; y < CARD_HEIGHT; y++) {
            const isDark = luminance(x, y) < 110

            if (isDark && runStart === null) {
                runStart = y
            }

            if (!isDark && runStart !== null) {
                if (
                    bestStart === null ||
                    y - runStart > bestEnd - bestStart
                ) {
                    bestStart = runStart
                    bestEnd = y
                }

                runStart = null
            }
        }

        if (bestStart !== null) {
            results.push({
                x,
                top: bestStart,
                bottom: bestEnd
            })
        }
    }

    console.log('')
    console.log(`Plantilla: ${template}`)
    console.log('')

    if (results.length === 0) {
        console.log(
            'No encontré un bloque oscuro. Mándame una captura de la carta y lo mido.'
        )

        return
    }

    for (const result of results) {
        console.log(
            `x=${result.x}: bloque de y=${result.top} a y=${result.bottom}`
        )
    }

    const middle = results[Math.floor(results.length / 2)]

    console.log('')
    console.log('Pon esto dentro de condensedText en tu estilo:')
    console.log('')
    console.log('statsBlock: {')
    console.log(`    top: ${middle.top},`)
    console.log(`    bottom: ${middle.bottom}`)
    console.log('},')
    console.log('')
    console.log(
        'Si los tres valores de x no coinciden, o el bloque medido te parece raro, avísame.'
    )
}

main().catch(error => {
    console.error('')
    console.error('ERROR MIDIENDO LA PLANTILLA:')
    console.error(error)
    process.exitCode = 1
})
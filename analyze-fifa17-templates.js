const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const TEMPLATES_DIR = path.join(
    __dirname,
    'fifa17-templates'
)

async function getRegionSignature(file, region) {
    const { data, info } = await sharp(file)
        .extract(region)
        .removeAlpha()
        .raw()
        .toBuffer({
            resolveWithObject: true
        })

    let r = 0
    let g = 0
    let b = 0

    const pixels = info.width * info.height

    for (let i = 0; i < data.length; i += 3) {
        r += data[i]
        g += data[i + 1]
        b += data[i + 2]
    }

    return {
        r: Math.round(r / pixels),
        g: Math.round(g / pixels),
        b: Math.round(b / pixels)
    }
}

function distance(a, b) {
    return Math.sqrt(
        Math.pow(a.r - b.r, 2) +
        Math.pow(a.g - b.g, 2) +
        Math.pow(a.b - b.b, 2)
    )
}

async function analyzeTemplate(file) {
    const metadata = await sharp(file).metadata()

    const nameBand = await getRegionSignature(
        file,
        {
            left: 0,
            top: 158,
            width: metadata.width,
            height: 29
        }
    )

    const rightBorder = await getRegionSignature(
        file,
        {
            left: metadata.width - 10,
            top: 110,
            width: 10,
            height: 85
        }
    )

    const center = await getRegionSignature(
        file,
        {
            left: 70,
            top: 90,
            width: 62,
            height: 68
        }
    )

    return {
        nameBand,
        rightBorder,
        center
    }
}

async function main() {
    console.log('')
    console.log('==========================================')
    console.log(' FIFA 17 - TEMPLATE FAMILY ANALYZER')
    console.log('==========================================')
    console.log('')

    const files = fs
        .readdirSync(TEMPLATES_DIR)
        .filter(file =>
            file.endsWith('.png')
        )
        .sort()

    console.log(`Plantillas: ${files.length}`)
    console.log('')

    const analyses = {}

    for (const file of files) {
        const fullPath = path.join(
            TEMPLATES_DIR,
            file
        )

        analyses[file] =
            await analyzeTemplate(fullPath)

        console.log(`[OK] ${file}`)
    }

    console.log('')
    console.log('==========================================')
    console.log(' SIMILITUD ESTRUCTURAL')
    console.log('==========================================')
    console.log('')

    const referenceTypes = [
        'fifa17-gold-template.png',
        'fifa17-rare_gold-template.png',
        'fifa17-silver-template.png',
        'fifa17-toty-template.png'
    ]

    for (const file of files) {
        const current = analyses[file]

        const comparisons = []

        for (const reference of referenceTypes) {
            if (!analyses[reference]) {
                continue
            }

            const ref =
                analyses[reference]

            const score =
                distance(
                    current.nameBand,
                    ref.nameBand
                ) +
                distance(
                    current.rightBorder,
                    ref.rightBorder
                ) +
                distance(
                    current.center,
                    ref.center
                )

            comparisons.push({
                reference,
                score
            })
        }

        comparisons.sort(
            (a, b) => a.score - b.score
        )

        const best = comparisons[0]

        const type = file
            .replace('fifa17-', '')
            .replace('-template.png', '')

        const family = best.reference
            .replace('fifa17-', '')
            .replace('-template.png', '')

        console.log(
            `${type.padEnd(24)} -> ` +
            `${family.padEnd(12)} ` +
            `score=${best.score.toFixed(2)}`
        )
    }

    console.log('')
    console.log('==========================================')
    console.log(' ANÁLISIS FINALIZADO')
    console.log('==========================================')
    console.log('')
}

main().catch(error => {
    console.error('')
    console.error('ERROR:')
    console.error(error)
    process.exitCode = 1
})
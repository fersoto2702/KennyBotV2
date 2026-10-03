const sharp = require('sharp')

async function main() {
    const TEMPLATE =
        'fifa17-rare-gold-template.png'

    const metadata =
        await sharp(TEMPLATE).metadata()

    const edgeWidth = 10

    await sharp(TEMPLATE)
        .extract({
            left: metadata.width - edgeWidth,
            top: 110,
            width: edgeWidth,
            height: 85
        })
        .resize({
            width: 100,
            height: 850,
            fit: 'fill'
        })
        .png()
        .toFile(
            'rare-gold-right-border-zoom.png'
        )

    await sharp(TEMPLATE)
        .extract({
            left: metadata.width - edgeWidth,
            top: 110,
            width: edgeWidth,
            height: 85
        })
        .png()
        .toFile(
            'rare-gold-right-border.png'
        )

    console.log('')
    console.log('Borde extraído:')
    console.log(
        'rare-gold-right-border.png'
    )
    console.log(
        'rare-gold-right-border-zoom.png'
    )
}

main().catch(console.error)
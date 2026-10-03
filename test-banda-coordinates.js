const sharp = require('sharp')

async function main() {
    const banda = await sharp('fifa17-rare-gold-template.png')
        .extract({
            left: 0,
            top: 158,
            width: 202,
            height: 29
        })
        .png()
        .toFile('fifa17-rare-gold-name-band.png')

    console.log(banda)
}

main().catch(console.error)
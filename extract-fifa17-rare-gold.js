const path = require('path')
const sharp = require('sharp')

const INPUT = path.join(
    __dirname,
    'fifa17-futgui-reference',
    'images',
    'cards',
    'group0.png'
)

const OUTPUT = path.join(
    __dirname,
    'fifa17-rare-gold-template.png'
)

async function main() {
    await sharp(INPUT)
        .extract({
            left: 0,
            top: 1264,
            width: 202,
            height: 316
        })
        .png()
        .toFile(OUTPUT)

    console.log('')
    console.log('Rare Gold extraída correctamente:')
    console.log(OUTPUT)
}

main().catch(error => {
    console.error('')
    console.error('ERROR:')
    console.error(error)
    process.exitCode = 1
})
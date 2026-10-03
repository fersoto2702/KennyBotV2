const sharp = require('sharp')
const path = require('path')

const INPUT = path.join(
    __dirname,
    'fifa17-basic-reference.png'
)

const OUTPUT = path.join(
    __dirname,
    'fifa17-basic-icon-crop.png'
)

async function main() {
    await sharp(INPUT)
        .extract({
            left: 101,
            top: 319,
            width: 27,
            height: 28
        })
        .png()
        .toFile(OUTPUT)

    console.log('')
    console.log('Recorte generado:')
    console.log(OUTPUT)
}

main().catch(error => {
    console.error(error)
    process.exitCode = 1
})
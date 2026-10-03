const fs = require('fs')
const path = require('path')
const { PNG } = require('pngjs')

const sourcePath = path.join(
    __dirname,
    'fifa17-futgui-reference',
    'images',
    'cards',
    'group1.png'
)

const outputPath = path.join(
    __dirname,
    'fifa17-toty-template.png'
)

const CARD_WIDTH = 202
const CARD_HEIGHT = 316
const TOTY_Y = 5688

fs.createReadStream(sourcePath)
    .pipe(new PNG())
    .on('parsed', function () {
        console.log(
            `Sprite: ${this.width}x${this.height}`
        )

        const card = new PNG({
            width: CARD_WIDTH,
            height: CARD_HEIGHT
        })

        PNG.bitblt(
            this,
            card,
            0,
            TOTY_Y,
            CARD_WIDTH,
            CARD_HEIGHT,
            0,
            0
        )

        card.pack()
            .pipe(
                fs.createWriteStream(
                    outputPath
                )
            )
            .on('finish', () => {
                console.log(
                    'TOTY extraída correctamente:'
                )

                console.log(
                    outputPath
                )
            })
    })
    .on('error', error => {
        console.error(
            'Error leyendo el sprite:',
            error
        )
    })
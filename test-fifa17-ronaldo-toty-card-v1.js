const fs = require('fs')
const path = require('path')
const { Jimp, loadFont } = require('jimp')

const DATA_FILE =
    'C:\\Users\\Ferna\\OneDrive\\Desktop\\Nueva Carpeta\\data-master\\2017\\players\\players_1.json'

const TEMPLATE_FILE = path.join(
    __dirname,
    'fifa17-toty-template.png'
)

const OUTPUT_FILE = path.join(
    __dirname,
    'ronaldo-toty-99-fifa17.png'
)

const RONALDO_CARD_ID = '117461313'

// Colores aproximados utilizados por el proyecto
const TOTY_GOLD = 0xffea80ff

async function loadRemoteImage(url) {
    if (!url) {
        throw new Error(
            'Se intentó cargar una URL de imagen vacía.'
        )
    }

    return Jimp.read(url)
}

async function main() {
    console.log('')
    console.log('==============================')
    console.log(' FIFA 17 - RONALDO TOTY TEST')
    console.log('==============================')

    const json = JSON.parse(
        fs.readFileSync(
            DATA_FILE,
            'utf8'
        )
    )

    const player = json.items.find(
        item =>
            String(item.id) ===
            RONALDO_CARD_ID
    )

    if (!player) {
        throw new Error(
            'No se encontró Ronaldo TOTY 99.'
        )
    }

    console.log(
        `Carta encontrada: ${player.name} ${player.rating}`
    )

    const card = await Jimp.read(
        TEMPLATE_FILE
    )

    const headshotUrl =
        player.specialImages
            ?.largeTOTWImgUrl ||
        player.headshot
            ?.largeImgUrl ||
        player.headshotImgUrl

    console.log(
        'Descargando imagen de Ronaldo...'
    )

    const headshot =
        await loadRemoteImage(
            headshotUrl
        )

    card.composite(
        headshot,
        card.bitmap.width -
            headshot.bitmap.height -
            7,
        40
    )

    console.log(
        'Descargando escudo del Real Madrid...'
    )

    const club =
        await loadRemoteImage(
            player.club
                .imageUrls
                .normal
                .large
        )

    card.composite(
        club,
        35,
        85
    )

    console.log(
        'Descargando bandera de Portugal...'
    )

    const nation =
        await loadRemoteImage(
            player.nation
                .imageUrls
                .large
        )

    card.composite(
        nation,
        35,
        130
    )

    const fontLarge = await loadFont(
    path.join(
        __dirname,
        'node_modules',
        '@jimp',
        'plugin-print',
        'fonts',
        'open-sans',
        'open-sans-32-white',
        'open-sans-32-white.fnt'
    )
)

const fontSmall = await loadFont(
    path.join(
        __dirname,
        'node_modules',
        '@jimp',
        'plugin-print',
        'fonts',
        'open-sans',
        'open-sans-16-white',
        'open-sans-16-white.fnt'
    )
)

    card.print({
        font: fontLarge,
        x: 38,
        y: 25,
        text: '99'
    })

    card.print({
        font: fontSmall,
        x: 42,
        y: 61,
        text: 'LW'
    })

    card.print({
        font: fontSmall,
        x: 67,
        y: 162,
        text: 'RONALDO'
    })

    const stats = [
        ['98', 'PAC', 40, 188],
        ['99', 'SHO', 40, 213],
        ['92', 'PAS', 40, 238],

        ['98', 'DRI', 105, 188],
        ['50', 'DEF', 105, 213],
        ['94', 'PHY', 105, 238]
    ]

    for (
        const [
            value,
            label,
            x,
            y
        ] of stats
    ) {
        card.print({
            font: fontSmall,
            x,
            y,
            text:
                `${value} ${label}`
        })
    }

    card.print({
        font: fontSmall,
        x: 77,
        y: 267,
        text: 'BASIC'
    })

    await card.write(
        OUTPUT_FILE
    )

    console.log('')
    console.log(
        'Carta generada correctamente:'
    )

    console.log(
        OUTPUT_FILE
    )

    console.log(
        '=============================='
    )
}

main().catch(error => {
    console.error('')
    console.error(
        'ERROR GENERANDO LA CARTA:'
    )

    console.error(error)

    process.exitCode = 1
})
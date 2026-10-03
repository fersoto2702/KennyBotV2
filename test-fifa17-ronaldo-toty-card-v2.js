const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const DATA_FILE =
    'C:\\Users\\Ferna\\OneDrive\\Desktop\\Nueva Carpeta\\data-master\\2017\\players\\players_1.json'

const TEMPLATE_FILE = path.join(
    __dirname,
    'fifa17-toty-template.png'
)

const OUTPUT_FILE = path.join(
    __dirname,
    'ronaldo-toty-99-fifa17-v2.png'
)

const FONT_DIR = path.join(
    __dirname,
    'fifa17-futgui-reference',
    'fonts'
)

const RONALDO_CARD_ID = '117461313'

const CARD_WIDTH = 202
const CARD_HEIGHT = 316

function fontToBase64(filename) {
    return fs.readFileSync(
        path.join(FONT_DIR, filename)
    ).toString('base64')
}

async function downloadBuffer(url) {
    if (!url) {
        throw new Error('URL de imagen vacía.')
    }

    const response = await fetch(url)

    if (!response.ok) {
        throw new Error(
            `HTTP ${response.status}: ${url}`
        )
    }

    return Buffer.from(
        await response.arrayBuffer()
    )
}

function escapeXml(text) {
    return String(text)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;')
}

async function main() {
    console.log('')
    console.log('=================================')
    console.log(' FIFA 17 - RONALDO TOTY TEST V2')
    console.log('=================================')

    const data = JSON.parse(
        fs.readFileSync(DATA_FILE, 'utf8')
    )

    const player = data.items.find(
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
        `Carta: ${player.name} ${player.rating} ${player.position}`
    )

    const specialUrl =
        player.specialImages?.largeTOTWImgUrl ||
        player.headshot?.largeImgUrl ||
        player.headshotImgUrl

    console.log('Descargando imagen de Ronaldo...')
    const playerBuffer =
        await downloadBuffer(specialUrl)

    console.log('Descargando escudo...')
    const clubBuffer =
        await downloadBuffer(
            player.club.imageUrls.normal.large
        )

    console.log('Descargando bandera...')
    const nationBuffer =
        await downloadBuffer(
            player.nation.imageUrls.large
        )

    const extraBold =
        fontToBase64('OpenSans-ExtraBold.ttf')

    const bold =
        fontToBase64('OpenSans-Bold.ttf')

    const regular =
        fontToBase64('OpenSans-Regular.ttf')

    const gold = '#FFEA80'

    const svg = Buffer.from(`
        <svg
            width="${CARD_WIDTH}"
            height="${CARD_HEIGHT}"
            xmlns="http://www.w3.org/2000/svg"
        >
            <style>
                @font-face {
                    font-family: 'FUTExtraBold';
                    src: url(data:font/ttf;base64,${extraBold});
                    font-weight: 800;
                }

                @font-face {
                    font-family: 'FUTBold';
                    src: url(data:font/ttf;base64,${bold});
                    font-weight: 700;
                }

                @font-face {
                    font-family: 'FUTRegular';
                    src: url(data:font/ttf;base64,${regular});
                    font-weight: 400;
                }

                .gold {
                    fill: ${gold};
                }

                .rating {
                    font-family: 'FUTExtraBold';
                    font-size: 25px;
                    font-weight: 800;
                }

                .position {
                    font-family: 'FUTExtraBold';
                    font-size: 16px;
                    font-weight: 800;
                }

                .name {
                    font-family: 'FUTExtraBold';
                    font-size: 16px;
                    font-weight: 800;
                }

                .statValue {
                    font-family: 'FUTExtraBold';
                    font-size: 16px;
                    font-weight: 800;
                }

                .statName {
                    font-family: 'FUTRegular';
                    font-size: 16px;
                    font-weight: 400;
                }

                .chemistry {
                    font-family: 'FUTBold';
                    font-size: 14px;
                    font-weight: 700;
                }
            </style>

            <!-- Rating -->
            <text
                x="42"
                y="52"
                class="gold rating"
            >99</text>

            <!-- Position -->
            <text
                x="42"
                y="76"
                class="gold position"
            >LW</text>

            <!-- Nombre -->
            <text
                x="101"
                y="178"
                text-anchor="middle"
                class="gold name"
            >${escapeXml('RONALDO')}</text>

            <!-- Columna izquierda -->
            <text x="40" y="204" class="gold statValue">98</text>
            <text x="65" y="204" class="gold statName">PAC</text>

            <text x="40" y="229" class="gold statValue">99</text>
            <text x="65" y="229" class="gold statName">SHO</text>

            <text x="40" y="254" class="gold statValue">92</text>
            <text x="65" y="254" class="gold statName">PAS</text>

            <!-- Columna derecha -->
            <text x="105" y="204" class="gold statValue">98</text>
            <text x="130" y="204" class="gold statName">DRI</text>

            <text x="105" y="229" class="gold statValue">50</text>
            <text x="130" y="229" class="gold statName">DEF</text>

            <text x="105" y="254" class="gold statValue">94</text>
            <text x="130" y="254" class="gold statName">PHY</text>

            <!-- Estilo de química -->
            <text
                x="101"
                y="281"
                text-anchor="middle"
                class="gold chemistry"
            >BASIC</text>
        </svg>
    `)

    const playerImage =
        await sharp(playerBuffer)
            .png()
            .toBuffer()

    const playerMetadata =
        await sharp(playerImage)
            .metadata()

    const playerX =
        CARD_WIDTH -
        playerMetadata.height -
        7

    const club =
        await sharp(clubBuffer)
            .png()
            .toBuffer()

    const nation =
        await sharp(nationBuffer)
            .png()
            .toBuffer()

    await sharp(TEMPLATE_FILE)
        .ensureAlpha()
        .composite([
            {
                input: playerImage,
                left: Math.round(playerX),
                top: 40
            },
            {
                input: club,
                left: 35,
                top: 85
            },
            {
                input: nation,
                left: 35,
                top: 130
            },
            {
                input: svg,
                left: 0,
                top: 0
            }
        ])
        .png()
        .toFile(OUTPUT_FILE)

    console.log('')
    console.log('V2 generada correctamente:')
    console.log(OUTPUT_FILE)
    console.log('=================================')
}

main().catch(error => {
    console.error('')
    console.error('ERROR GENERANDO V2:')
    console.error(error)
    process.exitCode = 1
})
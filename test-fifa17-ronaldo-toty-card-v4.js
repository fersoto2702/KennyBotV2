const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const DATA_FILE =
    'C:\\Users\\Ferna\\OneDrive\\Desktop\\Nueva Carpeta\\data-master\\2017\\players\\players_1.json'

const TEMPLATE_FILE = path.join(
    __dirname,
    'wefut-fifa17-gold5.png'
)

const OUTPUT_FILE = path.join(
    __dirname,
    'ronaldo-toty-99-fifa17-v4.png'
)

const FONT_DIR = path.join(
    __dirname,
    'fifa17-futgui-reference',
    'fonts'
)

const RONALDO_CARD_ID = '117461313'

const CARD_WIDTH = 227
const CARD_HEIGHT = Math.round(355 * (227 / 233))

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
    console.log(' FIFA 17 - RONALDO TOTY TEST V4')
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

    const playerBuffer =
        await downloadBuffer(specialUrl)

    const clubBuffer =
        await downloadBuffer(
            player.club.imageUrls.normal.large
        )

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

    const gold = '#F9E99E'

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
                    font-family: 'FUTBold';
                    font-size: 31px;
                    font-weight: 700;
                }

                .position {
                    font-family: 'FUTBold';
                    font-size: 18px;
                    font-weight: 700;
                }

                .name {
                    font-family: 'FUTBold';
                    font-size: 19px;
                    font-weight: 700;
                    letter-spacing: 0.2px;
                }

                .statValue {
                    font-family: 'FUTBold';
                    font-size: 18px;
                    font-weight: 700;
                }

                .statName {
                    font-family: 'FUTRegular';
                    font-size: 17px;
                    font-weight: 400;
                }

                .chemistry {
                    font-family: 'FUTBold';
                    font-size: 17px;
                    font-weight: 700;
                }
            </style>

            <text
                x="39"
                y="61"
                class="gold rating"
            >99</text>

            <text
                x="55"
                y="81"
                text-anchor="middle"
                class="gold position"
            >LW</text>

            <text
                x="113.5"
                y="193"
                text-anchor="middle"
                class="gold name"
            >${escapeXml('RONALDO')}</text>

            <text
                x="32"
                y="222"
                class="gold statValue"
            >98</text>

            <text
                x="59"
                y="222"
                class="gold statName"
            >PAC</text>

            <text
                x="32"
                y="248"
                class="gold statValue"
            >99</text>

            <text
                x="59"
                y="248"
                class="gold statName"
            >SHO</text>

            <text
                x="32"
                y="274"
                class="gold statValue"
            >92</text>

            <text
                x="59"
                y="274"
                class="gold statName"
            >PAS</text>

            <text
                x="130"
                y="222"
                class="gold statValue"
            >98</text>

            <text
                x="157"
                y="222"
                class="gold statName"
            >DRI</text>

            <text
                x="130"
                y="248"
                class="gold statValue"
            >50</text>

            <text
                x="157"
                y="248"
                class="gold statName"
            >DEF</text>

            <text
                x="130"
                y="274"
                class="gold statValue"
            >94</text>

            <text
                x="157"
                y="274"
                class="gold statName"
            >PHY</text>

            <text
                x="113.5"
                y="313"
                text-anchor="middle"
                class="gold chemistry"
            >BASIC</text>
        </svg>
    `)

    const PLAYER_WIDTH = 143
    const PLAYER_HEIGHT = 143
    const PLAYER_X = 82
    const PLAYER_Y = 37

    const playerImage =
        await sharp(playerBuffer)
            .resize(
                PLAYER_WIDTH,
                PLAYER_HEIGHT,
                {
                    fit: 'contain',
                    position: 'bottom'
                }
            )
            .png()
            .toBuffer()

    const club =
        await sharp(clubBuffer)
            .resize(
                43,
                43,
                {
                    fit: 'contain'
                }
            )
            .png()
            .toBuffer()

    const nation =
        await sharp(nationBuffer)
            .resize({
                width: 32,
                fit: 'contain'
            })
            .png()
            .toBuffer()

    await sharp(TEMPLATE_FILE)
        .resize(
            CARD_WIDTH,
            CARD_HEIGHT,
            {
                fit: 'fill'
            }
        )
        .ensureAlpha()
        .composite([
            {
                input: playerImage,
                left: PLAYER_X,
                top: PLAYER_Y
            },
            {
                input: club,
                left: 40,
                top: 91
            },
            {
                input: nation,
                left: 46,
                top: 139
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
    console.log('V4 generada correctamente:')
    console.log(OUTPUT_FILE)
    console.log('=================================')
}

main().catch(error => {
    console.error('')
    console.error('ERROR GENERANDO V4:')
    console.error(error)
    process.exitCode = 1
})
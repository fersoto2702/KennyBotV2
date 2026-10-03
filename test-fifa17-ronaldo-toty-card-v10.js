const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const DATA_FILE =
    'C:\\Users\\Ferna\\OneDrive\\Desktop\\Nueva Carpeta\\data-master\\2017\\players\\players_3.json'

const TEMPLATE_FILE = path.join(
    __dirname,
    'wefut-fifa17-gold5.png'
)

const BASIC_ICON_FILE = path.join(
    __dirname,
    'fifa17-basic-icon-transparent.png'
)

const OUTPUT_FILE = path.join(
    __dirname,
    'ronaldo-toty-99-fifa17-v10.png'
)

const FONT_DIR = path.join(
    __dirname,
    'fifa17-futgui-reference',
    'fonts'
)

const RONALDO_CARD_ID = '20801'

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
    console.log(' FIFA 17 - RONALDO TOTY TEST V10')
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

    console.log('Atributos:')
    console.log(player.attributes)

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

    const attributes = Object.fromEntries(
        player.attributes.map(attribute => [
            attribute.name.replace(
                'fut.attribute.',
                ''
            ),
            attribute.value
        ])
    )

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
                    font-size: 34px;
                    font-weight: 700;
                }

                .position {
                    font-family: 'FUTBold';
                    font-size: 20px;
                    font-weight: 700;
                }

                .name {
                    font-family: 'FUTBold';
                    font-size: 20px;
                    font-weight: 700;
                    letter-spacing: 0.3px;
                }

                .statValue {
                    font-family: 'FUTBold';
                    font-size: 20px;
                    font-weight: 700;
                }

                .statName {
                    font-family: 'FUTRegular';
                    font-size: 18px;
                    font-weight: 400;
                }

                .chemistry {
                    font-family: 'FUTBold';
                    font-size: 18px;
                    font-weight: 700;
                }
            </style>

            <text
                x="41"
                y="63"
                class="gold rating"
            >${player.rating}</text>

            <text
                x="58"
                y="85"
                text-anchor="middle"
                class="gold position"
            >${escapeXml(player.position)}</text>

            <text
                x="113.5"
                y="195"
                text-anchor="middle"
                class="gold name"
            >${escapeXml(
                String(player.name)
                    .split(' ')
                    .pop()
                    .toUpperCase()
            )}</text>

            <text
                x="31"
                y="223"
                class="gold statValue"
            >${attributes.PAC}</text>

            <text
                x="59"
                y="223"
                class="gold statName"
            >PAC</text>

            <text
                x="31"
                y="249"
                class="gold statValue"
            >${attributes.SHO}</text>

            <text
                x="59"
                y="249"
                class="gold statName"
            >SHO</text>

            <text
                x="31"
                y="275"
                class="gold statValue"
            >${attributes.PAS}</text>

            <text
                x="59"
                y="275"
                class="gold statName"
            >PAS</text>

            <text
                x="130"
                y="223"
                class="gold statValue"
            >${attributes.DRI}</text>

            <text
                x="158"
                y="223"
                class="gold statName"
            >DRI</text>

            <text
                x="130"
                y="249"
                class="gold statValue"
            >${attributes.DEF}</text>

            <text
                x="158"
                y="249"
                class="gold statName"
            >DEF</text>

            <text
                x="130"
                y="275"
                class="gold statValue"
            >${attributes.PHY}</text>

            <text
                x="158"
                y="275"
                class="gold statName"
            >PHY</text>

            <text
                x="128"
                y="314"
                text-anchor="middle"
                class="gold chemistry"
            >BASIC</text>
        </svg>
    `)

    const PLAYER_HEIGHT = 143
    const PLAYER_X = 100
    const PLAYER_Y = 37

    const trimmedPlayer =
        await sharp(playerBuffer)
            .trim({
                background: {
                    r: 0,
                    g: 0,
                    b: 0,
                    alpha: 0
                }
            })
            .png()
            .toBuffer()

    const resizedPlayer =
        await sharp(trimmedPlayer)
            .resize({
                height: PLAYER_HEIGHT,
                fit: 'contain'
            })
            .png()
            .toBuffer()

    const playerMetadata =
        await sharp(resizedPlayer)
            .metadata()

    const PLAYER_VISIBLE_BOTTOM = 174

    const playerVisibleHeight =
        PLAYER_VISIBLE_BOTTOM - PLAYER_Y

    const playerImage =
        await sharp(resizedPlayer)
            .extract({
                left: 0,
                top: 0,
                width: playerMetadata.width,
                height: Math.min(
                    playerMetadata.height,
                    playerVisibleHeight
                )
            })
            .png()
            .toBuffer()

    const club =
        await sharp(clubBuffer)
            .resize(
                46,
                46,
                {
                    fit: 'contain'
                }
            )
            .png()
            .toBuffer()

    const nation =
        await sharp(nationBuffer)
            .resize({
                width: 36,
                fit: 'contain'
            })
            .png()
            .toBuffer()

    const basicIcon =
        await sharp(BASIC_ICON_FILE)
            .resize({
                height: 22,
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
                left: 39,
                top: 91
            },
            {
                input: nation,
                left: 44,
                top: 140
            },
            {
                input: basicIcon,
                left: 80,
                top: 296
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
    console.log('V10 generada correctamente:')
    console.log(OUTPUT_FILE)
    console.log('=================================')
}

main().catch(error => {
    console.error('')
    console.error('ERROR GENERANDO V10:')
    console.error(error)
    process.exitCode = 1
})
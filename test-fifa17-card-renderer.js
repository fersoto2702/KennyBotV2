const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const {
    getFifa17CardStyle
} = require('./src/services/fifa17CardStyle')

const PLAYERS_DIR =
    'C:\\Users\\Ferna\\OneDrive\\Desktop\\Nueva Carpeta\\data-master\\2017\\players'

const BASIC_ICON_FILE = path.join(
    __dirname,
    'fifa17-basic-icon-transparent.png'
)

const FONT_DIR = path.join(
    __dirname,
    'fifa17-futgui-reference',
    'fonts'
)

const CARD_ID = process.argv[2]

if (!CARD_ID) {
    console.error('')
    console.error('Debes indicar el ID de una carta.')
    console.error('')
    console.error('Ejemplo:')
    console.error('node .\\test-fifa17-card-renderer.js 20801')
    process.exit(1)
}

const CARD_WIDTH = 227
const CARD_HEIGHT = Math.round(355 * (227 / 233))

// Idioma de las etiquetas de la carta: 'es' o 'en'
const CARD_LANGUAGE = 'es'

// Abreviaturas de posición en español (FIFA 17).
// Las posiciones que no estén aquí se muestran tal cual vienen en los datos.
const POSITIONS_ES = {
    GK: 'POR',
    RB: 'LD',
    LB: 'LI',
    CB: 'DFC',
    RWB: 'CAD',
    LWB: 'CAI',
    CDM: 'MCD',
    CM: 'MC',
    CAM: 'MCO',
    RM: 'MD',
    LM: 'MI',
    RW: 'ED',
    LW: 'EI',
    RF: 'SDD',
    LF: 'SDI',
    CF: 'MP',
    ST: 'DC'
}

function getDisplayPosition(position) {
    const key = String(position ?? '')
        .trim()
        .toUpperCase()

    if (CARD_LANGUAGE !== 'es') {
        return key
    }

    return POSITIONS_ES[key] ?? key
}

// Etiquetas de stats en español (las claves siguen siendo las de los datos).
const STAT_LABELS_ES = {
    PAC: 'RIT',
    SHO: 'TIR',
    PAS: 'PAS',
    DRI: 'REG',
    DEF: 'DEF',
    PHY: 'FÍS',
    DIV: 'EST',
    HAN: 'PAR',
    KIC: 'SAQ',
    REF: 'REF',
    SPD: 'VEL',
    POS: 'COL'
}

function getStatLabel(statName) {
    if (CARD_LANGUAGE !== 'es') {
        return statName
    }

    return STAT_LABELS_ES[statName] ?? statName
}

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

function getDisplayName(player) {
    if (String(player.baseId) === '20801') {
        return 'RONALDO'
    }

    return String(
        player.name ||
        player.commonName ||
        player.lastName ||
        ''
    )
        .trim()
        .toUpperCase()
}

// =====================================================
// TEXTO CONDENSADO (opcional por estilo: cardStyle.condensedText)
// El texto se convierte en trazos vectoriales con opentype.js, así no
// depende de las fuentes instaladas en el sistema.
// Requiere: npm i opentype.js @fontsource/barlow-condensed
// =====================================================

let opentypeModule = null

function getOpentype() {
    if (!opentypeModule) {
        try {
            opentypeModule = require('opentype.js')
        } catch {
            throw new Error(
                'Falta opentype.js. Instálalo con: npm i opentype.js @fontsource/barlow-condensed'
            )
        }
    }

    return opentypeModule
}

const CONDENSED_FONT_CANDIDATES = {

    bold: [
        'DINPro-CondBold.otf',
        'D-DINCondensed-Bold.otf',
        '@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff'
    ],

    regular: [
        'DINPro-CondMedium.otf',
        'D-DINCondensed.otf',
        '@fontsource/barlow-condensed/files/barlow-condensed-latin-500-normal.woff'
    ],

    // Dígitos grandes (valoración): la original los tiene más anchos y redondos
    display: [
        'DINPro-CondBold.otf',
        'D-DINCondensed-Bold.otf',
        '@fontsource/barlow/files/barlow-latin-700-normal.woff'
    ],

    // Peso normal y ancho normal (por ejemplo el nombre de la carta Movember)
    wide: [
        'DINPro-Medium.otf',
        'D-DIN.otf',
        '@fontsource/barlow/files/barlow-latin-500-normal.woff'
    ]

}

const condensedFontCache = new Map()

function resolveFontFile(candidate) {
    const searchDirs = [
        FONT_DIR,
        path.join(__dirname, 'fonts'),
        path.join(__dirname, 'node_modules'),
        __dirname
    ]

    for (const dir of searchDirs) {
        const filePath = path.join(dir, candidate)

        if (fs.existsSync(filePath)) {
            return filePath
        }
    }

    return null
}

function loadCondensedFont(kind) {
    if (condensedFontCache.has(kind)) {
        return condensedFontCache.get(kind)
    }

    const chain = []

    for (const candidate of CONDENSED_FONT_CANDIDATES[kind]) {
        const filePath = resolveFontFile(candidate)

        if (!filePath) {
            continue
        }

        const buffer = fs.readFileSync(filePath)

        const arrayBuffer = buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength
        )

        chain.push(
            getOpentype().parse(arrayBuffer)
        )
    }

    if (chain.length === 0 && (kind === 'display' || kind === 'wide')) {
        const fallbackChain = loadCondensedFont(
            kind === 'display' ? 'bold' : 'regular'
        )

        condensedFontCache.set(kind, fallbackChain)

        return fallbackChain
    }

    if (chain.length === 0) {
        throw new Error(
            `No se encontró ninguna fuente condensada (${kind}). Instala: npm i @fontsource/barlow-condensed`
        )
    }

    condensedFontCache.set(kind, chain)

    return chain
}

function pickCondensedFont(chain, text) {
    const characters = [...String(text)].filter(
        character => character.trim() !== ''
    )

    return chain.find(font =>
        characters.every(
            character => font.charToGlyphIndex(character) !== 0
        )
    ) || chain[0]
}
function commandsToPathData(commands) {
    const round = value =>
        (Math.round(value * 100) / 100).toString()

    return commands
        .map(command => {
            if (command.type === 'M' || command.type === 'L') {
                return `${command.type}${round(command.x)} ${round(command.y)}`
            }

            if (command.type === 'Q') {
                return `Q${round(command.x1)} ${round(command.y1)} ${round(command.x)} ${round(command.y)}`
            }

            if (command.type === 'C') {
                return `C${round(command.x1)} ${round(command.y1)} ${round(command.x2)} ${round(command.y2)} ${round(command.x)} ${round(command.y)}`
            }

            return 'Z'
        })
        .join('')
}

function textToPath({ chain, text, x, y, size, fill, anchor = 'start', letterSpacing = 0 }) {
    const value = String(text ?? '')

    const font = pickCondensedFont(chain, value)

    const spacing = letterSpacing / size

    const width = font.getAdvanceWidth(
        value,
        size,
        {
            letterSpacing: spacing
        }
    )

    let startX = x

    if (anchor === 'middle') {
        startX = x - width / 2
    }

    if (anchor === 'end') {
        startX = x - width
    }

    const glyphPath = font.getPath(
        value,
        startX,
        y,
        size,
        {
            letterSpacing: spacing
        }
    )

    return `<path d="${commandsToPathData(glyphPath.commands)}" fill="${fill}"/>`
}

// Valores por defecto = calibrados con la Müller de Halloween.
// Cada estilo los puede sobrescribir en cardStyle.condensedText.
function buildCondensedSvg({ player, attributes, statNames, colors, config }) {
    const bold = loadCondensedFont('bold')
    const regular = loadCondensedFont('regular')
    const display = loadCondensedFont('display')
    const wide = loadCondensedFont('wide')

    const rating = {
        x: 65,
        y: 71,
        size: 35.2,
        ...(config.rating || {})
    }

    const position = {
        x: 65.5,
        y: 90,
        size: 22.9,
        ...(config.position || {})
    }

    const name = {
        x: 113.5,
        y: 196.4,
        size: 21.5,
        letterSpacing: 0,
        weight: 'bold',
        ...(config.name || {})
    }

    const statsDefaults = {
        valueCenterX: [52, 141.6],
        labelX: [68, 156.8],
        rowsY: [224.7, 250.1, 275.5],
        valueSize: 21.4,
        labelSize: 21.4
    }

    // Centrado automático: si el estilo define statsBlock { top, bottom, centerX? }
    // (los bordes del bloque de stats en ESA plantilla, a tamaño de carta),
    // las 3 filas y las 2 columnas se centran solas dentro del bloque.
    // Lo que se escriba en condensedText.stats tiene prioridad sobre esto.
    let statsAuto = {}

    if (config.statsBlock) {
        const valueSize = config.stats?.valueSize ?? statsDefaults.valueSize

        const digitHeight = valueSize * 0.678

        const blockHeight =
            config.statsBlock.bottom -
            config.statsBlock.top

        const margin = blockHeight * 0.085

        const pitch =
            (blockHeight - margin * 2 - digitHeight) / 2

        const firstBaseline =
            config.statsBlock.top + margin + digitHeight

        const centerX = config.statsBlock.centerX ?? 113.5

        statsAuto = {
            rowsY: [
                firstBaseline,
                firstBaseline + pitch,
                firstBaseline + pitch * 2
            ],
            valueCenterX: [
                centerX - 58.5,
                centerX + 20.9
            ],
            labelX: [
                centerX - 40.1,
                centerX + 39.3
            ]
        }
    }

    const stats = {
        ...statsDefaults,
        ...statsAuto,
        ...(config.stats || {})
    }

    const chemistry = {
        x: 123,
        y: 306,
        size: 22,
        ...(config.chemistry || {})
    }

    const paths = []

    paths.push(
        textToPath({
            chain: display,
            text: player.rating,
            x: rating.x,
            y: rating.y,
            size: rating.size,
            fill: colors.ratingPosition,
            anchor: 'middle'
        })
    )

    paths.push(
        textToPath({
            chain: bold,
            text: getDisplayPosition(player.position),
            x: position.x,
            y: position.y,
            size: position.size,
            fill: colors.ratingPosition,
            anchor: 'middle'
        })
    )

    paths.push(
        textToPath({
            chain: name.weight === 'wide'
                ? wide
                : name.weight === 'regular'
                    ? regular
                    : bold,
            text: getDisplayName(player),
            x: name.x,
            y: name.y,
            size: name.size,
            fill: colors.text,
            anchor: 'middle',
            letterSpacing: name.letterSpacing
        })
    )

    statNames.forEach((statName, index) => {
        const column = Math.floor(index / 3)
        const row = index % 3

        paths.push(
            textToPath({
                chain: bold,
                text: attributes[statName] ?? '--',
                x: stats.valueCenterX[column],
                y: stats.rowsY[row],
                size: stats.valueSize,
                fill: colors.stats,
                anchor: 'middle'
            })
        )

        paths.push(
            textToPath({
                chain: regular,
                text: getStatLabel(statName),
                x: stats.labelX[column],
                y: stats.rowsY[row],
                size: stats.labelSize,
                fill: colors.stats
            })
        )
    })

    paths.push(
        textToPath({
            chain: bold,
            text: 'KENNYBOT',
            x: chemistry.x,
            y: chemistry.y,
            size: chemistry.size,
            fill: colors.text,
            anchor: 'middle'
        })
    )

    return Buffer.from(`
        <svg
            width="${CARD_WIDTH}"
            height="${CARD_HEIGHT}"
            xmlns="http://www.w3.org/2000/svg"
        >
            ${paths.join('')}
        </svg>
    `)
}
// FIN TEXTO CONDENSADO

function findPlayerByCardId(cardId) {
    const files = fs.readdirSync(PLAYERS_DIR)
        .filter(file => /^players_\d+\.json$/i.test(file))
        .sort((a, b) => {
            const aNumber = Number(a.match(/\d+/)[0])
            const bNumber = Number(b.match(/\d+/)[0])

            return aNumber - bNumber
        })

    for (const file of files) {
        const filePath = path.join(
            PLAYERS_DIR,
            file
        )

        const data = JSON.parse(
            fs.readFileSync(filePath, 'utf8')
        )

        const player = data.items?.find(
            item =>
                String(item.id) ===
                String(cardId)
        )

        if (player) {
            return {
                player,
                file,
                filePath
            }
        }
    }

    return null
}

async function main() {
    console.log('')
    console.log('=================================')
    console.log(' FIFA 17 - CARD RENDERER ')
    console.log('=================================')

    const result = findPlayerByCardId(CARD_ID)

    if (!result) {
        throw new Error(
            `No se encontró la carta con ID ${CARD_ID}.`
        )
    }

    const player = result.player

    const safePlayerName = String(player.name)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()

    const safeColor = String(player.color)
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .toLowerCase()

    const OUTPUT_FILE = path.join(
        __dirname,
        `fifa17-${player.id}-${safePlayerName}-${player.rating}-${safeColor}.png`
    )

    console.log('')
    console.log(`Carta encontrada en: ${result.file}`)

    const cardStyle =
        getFifa17CardStyle(player.color)

    console.log('')
    console.log('Estilo de carta:')
    console.log(`Color EA: ${player.color}`)
    console.log(`Plantilla: ${cardStyle.template}`)
    console.log(`Texto: ${cardStyle.textColor}`)
    console.log(`Química: ${cardStyle.chemistryColor}`)

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
        fontToBase64(
            'OpenSans-ExtraBold.ttf'
        )

    const bold =
        fontToBase64(
            'OpenSans-Bold.ttf'
        )

    const regular =
        fontToBase64(
            'OpenSans-Regular.ttf'
        )

    const gold = cardStyle.textColor

    const statsColor =
        cardStyle.statsColor ??
        cardStyle.textColor

    const ratingPositionColor =
        cardStyle.ratingPositionColor ??
        cardStyle.textColor

    const attributes = Object.fromEntries(
        player.attributes.map(attribute => [
            attribute.name.replace(
                'fut.attribute.',
                ''
            ),
            attribute.value
        ])
    )

    const statNames = player.isGK
    ? ['DIV', 'HAN', 'KIC', 'REF', 'SPD', 'POS']
    : ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY']

    const nameStyle = {
    x: 113.5,
    y: 195,
    size: 20,
    letterSpacing: 0.3,
    ...(cardStyle.name || {})
}

    const statsStyle = {
    row1Y: 223,
    row2Y: 249,
    row3Y: 275,
    ...(cardStyle.stats || {})
}

    const chemistryStyle = {
    textX: 128,
    textY: 314,
    iconX: 70,
    iconY: 296,
    ...(cardStyle.chemistry || {})
}

    const ratingStyle = {
    x: 41,
    y: 63,
    size: 34,
    ...(cardStyle.rating || {})
}

    const positionStyle = {
    x: 58,
    y: 85,
    size: 20,
    ...(cardStyle.position || {})
}

    const textSvg = Buffer.from(`
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
                
                .ratingPositionColor {
                    fill: ${ratingPositionColor};
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
                    fill: ${statsColor};
                }

                .statName {
                    font-family: 'FUTRegular';
                    font-size: 18px;
                    font-weight: 400;
                    fill: ${statsColor};
                }

                .chemistry {
                    font-family: 'FUTBold';
                    font-size: 18px;
                    font-weight: 700;
                }
            </style>

            <text
                x="${ratingStyle.x}"
                y="${ratingStyle.y}"
                style="font-size: ${ratingStyle.size}px"
                class="ratingPositionColor rating"
            >${player.rating}</text>

            <text
                x="${positionStyle.x}"
                y="${positionStyle.y}"
                text-anchor="middle"
                style="font-size: ${positionStyle.size}px"
                class="ratingPositionColor position"
            >${escapeXml(getDisplayPosition(player.position))}</text>

            <text
                x="${nameStyle.x}"
                y="${nameStyle.y}"
                text-anchor="middle"
                style="font-size: ${nameStyle.size}px; letter-spacing: ${nameStyle.letterSpacing}px"
                class="gold name"
            >${escapeXml(getDisplayName(player))}</text>

            <text
                x="31"
                y="${statsStyle.row1Y}"
                class="gold statValue"
            >${attributes[statNames[0]]}</text>

            <text
                x="59"
                y="${statsStyle.row1Y}"
                class="gold statName"
            >${getStatLabel(statNames[0])}</text>

            <text
                x="31"
                y="${statsStyle.row2Y}"
                class="gold statValue"
            >${attributes[statNames[1]]}</text>

            <text
                x="59"
                y="${statsStyle.row2Y}"
                class="gold statName"
            >${getStatLabel(statNames[1])}</text>

            <text
                x="31"
                y="${statsStyle.row3Y}"
                class="gold statValue"
            >${attributes[statNames[2]]}</text>

            <text
                x="59"
                y="${statsStyle.row3Y}"
                class="gold statName"
            >${getStatLabel(statNames[2])}</text>

            <text
                x="130"
                y="${statsStyle.row1Y}"
                class="gold statValue"
            >${attributes[statNames[3]]}</text>

            <text
                x="158"
                y="${statsStyle.row1Y}"
                class="gold statName"
            >${getStatLabel(statNames[3])}</text>

            <text
                x="130"
                y="${statsStyle.row2Y}"
                class="gold statValue"
            >${attributes[statNames[4]]}</text>

            <text
                x="158"
                y="${statsStyle.row2Y}"
                class="gold statName"
            >${getStatLabel(statNames[4])}</text>

            <text
                x="130"
                y="${statsStyle.row3Y}"
                class="gold statValue"
            >${attributes[statNames[5]]}</text>

            <text
                x="158"
                y="${statsStyle.row3Y}"
                class="gold statName"
            >${getStatLabel(statNames[5])}</text>

            <text
                x="${chemistryStyle.textX}"
                y="${chemistryStyle.textY}"
                text-anchor="middle"
                class="gold chemistry"
            >KENNYBOT</text>
        </svg>
    `)

    const svg = cardStyle.condensedText
        ? buildCondensedSvg({
            player,
            attributes,
            statNames,
            colors: {
                text: gold,
                stats: statsColor,
                ratingPosition: ratingPositionColor
            },
            config: cardStyle.condensedText
        })
        : textSvg

    const PLAYER_HEIGHT =
    cardStyle.playerImage?.height

    const PLAYER_X =
    cardStyle.playerImage?.x

    const PLAYER_RIGHT_LIMIT =
    CARD_WIDTH -
    (cardStyle.playerImage.rightInset ?? 0)


    const PLAYER_Y =
    cardStyle.playerImage?.y

    const trimmedPlayer =
        await sharp(playerBuffer)
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
    
    const playerVisibleWidth =
    Math.min(
        playerMetadata.width,
        PLAYER_RIGHT_LIMIT - PLAYER_X
    )

    const PLAYER_VISIBLE_BOTTOM =
        cardStyle.playerImage?.visibleBottom

    const playerVisibleHeight =
        PLAYER_VISIBLE_BOTTOM - PLAYER_Y

    const playerImage =
    await sharp(resizedPlayer)
        .extract({
            left: 0,
            top: 0,
            width: playerVisibleWidth,
            height: Math.min(
                playerMetadata.height,
                playerVisibleHeight
            )
        })
        .png()
        .toBuffer()

    const templateMetadata =
        await sharp(cardStyle.template)
            .metadata()

    const templateScaleX =
    CARD_WIDTH / templateMetadata.width

    const templateScaleY =
    CARD_HEIGHT / templateMetadata.height

    let nameBand = null
let nameBandTop = 0

if (cardStyle.nameBand) {
    nameBandTop =
        Math.round(
            cardStyle.nameBand.top *
            templateScaleY
        )

    const nameBandHeight =
        Math.round(
            cardStyle.nameBand.height *
            templateScaleY
        )

    nameBand =
        await sharp(cardStyle.template)
            .extract({
                left: 0,
                top: cardStyle.nameBand.top,
                width: templateMetadata.width,
                height: cardStyle.nameBand.height
            })
            .resize({
                width: CARD_WIDTH,
                height: nameBandHeight,
                fit: 'fill'
            })
            .png()
            .toBuffer()
}
    
    let rightBorder = null
    let rightBorderWidth = 0
    let rightBorderTop = 0

    if (cardStyle.rightBorder) {
    const rightBorderOriginalWidth =
        cardStyle.rightBorder.width

    const rightBorderOriginalTop =
        cardStyle.rightBorder.top

    const rightBorderOriginalHeight =
        cardStyle.rightBorder.height

    rightBorderWidth =
        Math.round(
            rightBorderOriginalWidth *
            templateScaleX
        )

    rightBorderTop =
        Math.round(
            rightBorderOriginalTop *
            templateScaleY
        )

    const rightBorderHeight =
        Math.round(
            rightBorderOriginalHeight *
            templateScaleY
        )

    rightBorder =
        await sharp(cardStyle.template)
            .extract({
                left:
                    templateMetadata.width -
                    rightBorderOriginalWidth,
                top: rightBorderOriginalTop,
                width: rightBorderOriginalWidth,
                height: rightBorderOriginalHeight
            })
            .resize({
                width: rightBorderWidth,
                height: rightBorderHeight,
                fit: 'fill'
            })
            .png()
            .toBuffer()
}
    const clubStyle = {
    size: 46,
    x: 39,
    y: 91,
    ...(cardStyle.club || {})
}

    const nationStyle = {
    width: 36,
    x: 44,
    y: 140,
    ...(cardStyle.nation || {})
}

    const club =
        await sharp(clubBuffer)
            .resize(
                clubStyle.size,
                clubStyle.size,
                {
                    fit: 'contain'
                }
            )
            .png()
            .toBuffer()

    const nation =
        await sharp(nationBuffer)
            .resize({
                width: nationStyle.width,
                fit: 'contain'
            })
            .png()
            .toBuffer()

    const basicIconMask =
        await sharp(BASIC_ICON_FILE)
            .resize({
                height: 22,
                fit: 'contain'
            })
            .ensureAlpha()
            .extractChannel('alpha')
            .png()
            .toBuffer()

    const basicIconMetadata =
        await sharp(basicIconMask)
            .metadata()

    const basicIcon =
        await sharp({
            create: {
                width:
                    basicIconMetadata.width,
                height:
                    basicIconMetadata.height,
                channels: 3,
                background:
                    cardStyle.chemistryColor
            }
        })
            .joinChannel(
                basicIconMask
            )
            .png()
            .toBuffer()

    await sharp(cardStyle.template)
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
            ...(nameBand
            ? [{
                input: nameBand,
                left: 0,
                top: nameBandTop
            }]
            : []),
            ...(rightBorder
            ? [{
                input: rightBorder,
                left: CARD_WIDTH - rightBorderWidth,
                top: rightBorderTop
             }]
            : []),
            {
                input: club,
                left: clubStyle.x,
                top: clubStyle.y
            },
            {
                input: nation,
                left: nationStyle.x,
                top: nationStyle.y,
            },
            {
                input: basicIcon,
                left: chemistryStyle.iconX,
                top: chemistryStyle.iconY
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
    console.log(
        'Carta generada correctamente:'
    )
    console.log(OUTPUT_FILE)
    console.log(
        '================================='
    )
}

main().catch(error => {
    console.error('')
    console.error(
        'ERROR GENERANDO CARTA:'
    )
    console.error(error)
    process.exitCode = 1
})
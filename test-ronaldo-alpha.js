const fs = require('fs')
const sharp = require('sharp')

const DATA_FILE =
    'C:\\Users\\Ferna\\OneDrive\\Desktop\\Nueva Carpeta\\data-master\\2017\\players\\players_1.json'

const RONALDO_CARD_ID = '117461313'

async function downloadBuffer(url) {
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

async function main() {
    const data = JSON.parse(
        fs.readFileSync(DATA_FILE, 'utf8')
    )

    const player = data.items.find(
        item =>
            String(item.id) ===
            RONALDO_CARD_ID
    )

    const url =
        player.specialImages?.largeTOTWImgUrl ||
        player.headshot?.largeImgUrl ||
        player.headshotImgUrl

    const buffer = await downloadBuffer(url)

    const original =
        await sharp(buffer).metadata()

    const {
        data: trimmedBuffer,
        info
    } =
        await sharp(buffer)
            .trim({
                background: {
                    r: 0,
                    g: 0,
                    b: 0,
                    alpha: 0
                }
            })
            .png()
            .toBuffer({
                resolveWithObject: true
            })

    const trimmed =
        await sharp(trimmedBuffer).metadata()

    console.log('')
    console.log('ORIGINAL')
    console.log({
        width: original.width,
        height: original.height,
        hasAlpha: original.hasAlpha
    })

    console.log('')
    console.log('ÁREA VISIBLE')
    console.log({
        width: trimmed.width,
        height: trimmed.height,
        trimOffsetLeft: info.trimOffsetLeft,
        trimOffsetTop: info.trimOffsetTop
    })

    await sharp(buffer)
        .png()
        .toFile('ronaldo-original.png')

    await sharp(trimmedBuffer)
        .png()
        .toFile('ronaldo-trimmed.png')

    console.log('')
    console.log('ronaldo-original.png')
    console.log('ronaldo-trimmed.png')
}

main().catch(error => {
    console.error(error)
    process.exitCode = 1
})
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const PLAYERS_DIR =
    'C:\\Users\\Ferna\\OneDrive\\Desktop\\Nueva Carpeta\\data-master\\2017\\players'

const PLAYER_HEIGHT = 143

async function downloadBuffer(url) {
    const response = await fetch(url)

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${url}`)
    }

    return Buffer.from(await response.arrayBuffer())
}

async function main() {
    const files = fs.readdirSync(PLAYERS_DIR)
        .filter(file => /^players_\d+\.json$/i.test(file))
        .sort((a, b) => {
            return Number(a.match(/\d+/)[0]) -
                   Number(b.match(/\d+/)[0])
        })

    const players = []

    for (const file of files) {
        const data = JSON.parse(
            fs.readFileSync(path.join(PLAYERS_DIR, file), 'utf8')
        )

        for (const player of data.items || []) {
            if (
                player.color === 'rare_gold' &&
                player.headshot?.largeImgUrl
            ) {
                players.push(player)
            }

            if (players.length === 20) {
                break
            }
        }

        if (players.length === 20) {
            break
        }
    }

    for (const player of players) {
        try {
            const buffer =
                await downloadBuffer(player.headshot.largeImgUrl)

            const trimmedResult =
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

const trimmed = trimmedResult.data

const trimOffsetLeft =
    trimmedResult.info.trimOffsetLeft ?? 0

const trimOffsetTop =
    trimmedResult.info.trimOffsetTop ?? 0
            const trimMetadata =
                await sharp(trimmed).metadata()

            const resized =
                await sharp(trimmed)
                    .resize({
                        height: PLAYER_HEIGHT,
                        fit: 'contain'
                    })
                    .png()
                    .toBuffer()

            const resizedMetadata =
                await sharp(resized).metadata()

            console.log(
            `${String(player.id).padEnd(10)} ` +
            `${String(player.name).padEnd(22)} ` +
            `trim=${trimMetadata.width}x${trimMetadata.height} ` +
            `offset=${trimOffsetLeft},${trimOffsetTop} ` +
            `render=${resizedMetadata.width}x${resizedMetadata.height}`
        )
        } catch (error) {
            console.log(
                `${player.id} ${player.name}: ERROR`
            )
        }
    }
}

main().catch(console.error)
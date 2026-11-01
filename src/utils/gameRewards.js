const fs =

    require('fs')

const path =

    require('path')

const logger =

    require('./logger')

const levelsPath =

    path.join(

        __dirname,

        '../../database/levels.json'

    )

const economyPath =

    path.join(

        __dirname,

        '../../database/economy.json'

    )

const inventoryPath =

    path.join(

        __dirname,

        '../../database/inventory.json'

    )

const MAX_LEVELS_PER_GAME =

    5

function normalizeJid(

    jid

) {

    if (!jid) {

        return null

    }

    return String(

        jid

    )

        .trim()

        .replace(

            /:\d+@/,

            '@'

        )

}

function ensureDirectory(

    file

) {

    const directory =

        path.dirname(

            file

        )

    if (

        !fs.existsSync(

            directory

        )

    ) {

        fs.mkdirSync(

            directory,

            {

                recursive:

                    true

            }

        )

    }

}

function ensureDatabases() {

    const databases = [

        [

            levelsPath,

            {}

        ],

        [

            economyPath,

            {}

        ],

        [

            inventoryPath,

            {}

        ]

    ]

    for (

        const [

            file,

            defaultValue

        ]

        of databases

    ) {

        try {

            ensureDirectory(

                file

            )

            if (

                !fs.existsSync(

                    file

                )

            ) {

                fs.writeFileSync(

                    file,

                    JSON.stringify(

                        defaultValue,

                        null,

                        2

                    ),

                    'utf8'

                )

            }

        } catch (err) {

            logger.error(

                `GameRewards DB Init Error (${path.basename(file)}): ${err.stack || err.message}`

            )

        }

    }

}

function readJson(

    file,

    fallback = {}

) {

    try {

        const raw =

            fs.readFileSync(

                file,

                'utf8'

            )

        const parsed =

            JSON.parse(

                raw

            )

        if (

            !parsed ||

            typeof parsed !==

                'object' ||

            Array.isArray(

                parsed

            )

        ) {

            return fallback

        }

        return parsed

    } catch (err) {

        logger.error(

            `GameRewards DB Read Error (${path.basename(file)}): ${err.stack || err.message}`

        )

        return fallback

    }

}

function writeJson(file, data) {
    const tempFile = `${file}.${process.pid}.tmp`
    const backupFile = `${file}.bak`

    try {
        ensureDirectory(file)
        const serialized = JSON.stringify(data, null, 2)
        fs.writeFileSync(tempFile, serialized, 'utf8')

        if (fs.existsSync(file)) {
            try {
                fs.copyFileSync(file, backupFile)
            } catch {}
        }

        fs.renameSync(tempFile, file)
        return true
    } catch (err) {
        try {
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
        } catch {}

        logger.error(`GameRewards DB Write Error (${path.basename(file)}): ${err.stack || err.message}`)
        return false
    }
}

function ensureUserData(

    sender,

    levels,

    economy,

    inventory

) {

    if (

        !levels[sender] ||

        typeof levels[sender] !==

            'object' ||

        Array.isArray(

            levels[sender]

        )

    ) {

        levels[sender] = {

            xp:

                0,

            level:

                1

        }

    }

    if (

        !Number.isFinite(

            Number(

                levels[sender].xp

            )

        )

    ) {

        levels[sender].xp =

            0

    } else {

        levels[sender].xp =

            Number(

                levels[sender].xp

            )

    }

    if (

        !Number.isFinite(

            Number(

                levels[sender].level

            )

        ) ||

        Number(

            levels[sender].level

        ) < 1

    ) {

        levels[sender].level =

            1

    } else {

        levels[sender].level =

            Math.floor(

                Number(

                    levels[sender].level

                )

            )

    }

    if (

        !economy[sender] ||

        typeof economy[sender] !==

            'object' ||

        Array.isArray(

            economy[sender]

        )

    ) {

        economy[sender] = {

            coins:

                0,

            bank:

                0

        }

    }

    if (

        !Number.isFinite(

            Number(

                economy[sender].coins

            )

        )

    ) {

        economy[sender].coins =

            0

    } else {

        economy[sender].coins =

            Number(

                economy[sender].coins

            )

    }

    if (

        !Number.isFinite(

            Number(

                economy[sender].bank

            )

        )

    ) {

        economy[sender].bank =

            0

    } else {

        economy[sender].bank =

            Number(

                economy[sender].bank

            )

    }

    if (

        !Array.isArray(

            inventory[sender]

        )

    ) {

        inventory[sender] =

            []

    }

}

function getSenderFromMessage(

    sock,

    msg

) {

    return normalizeJid(

        msg?.key?.fromMe

            ? (

                sock?.user?.lid ||

                sock?.user?.id

            )

            : (

                msg?.key?.participant ||

                msg?.participant ||

                msg?.key?.remoteJid

            )

    )

}

function getGameRewardPreview(

    baseXp,

    baseCoins,

    hasBoost = false

) {

    const xp =

        Math.max(

            0,

            Math.floor(

                Number(

                    baseXp

                ) ||

                0

            )

        )

    const coins =

        Math.floor(

            Number(

                baseCoins

            ) ||

            0

        )

    return {

        xp:

            hasBoost

                ? xp *

                    2

                : xp,

        coins

    }

}

function applyGameReward({ sender, xp = 0, coins = 0, applyXpBoost = true }) {
    try {
        sender = normalizeJid(sender)

        if (!sender) {
            return { success: false, error: 'INVALID_SENDER' }
        }

        ensureDatabases()

        const levels = readJson(levelsPath, {})
        const economy = readJson(economyPath, {})
        const inventory = readJson(inventoryPath, {})

        ensureUserData(sender, levels, economy, inventory)

        let baseXp = Number(xp)
        let baseCoins = Number(coins)

        if (!Number.isFinite(baseXp)) baseXp = 0
        if (!Number.isFinite(baseCoins)) baseCoins = 0

        baseXp = Math.floor(baseXp)
        baseCoins = Math.floor(baseCoins)

        if (baseXp < 0) baseXp = 0

        const hasBoost = Boolean(applyXpBoost) && inventory[sender].includes('🚀 XP Boost')
        const gainedXp = hasBoost ? baseXp * 2 : baseXp
        let gainedCoins = baseCoins

        if (gainedCoins < 0) {
            const maximumLoss = Math.max(0, Number(economy[sender].coins) || 0)
            gainedCoins = Math.max(gainedCoins, -maximumLoss)
        }

        levels[sender].xp += gainedXp
        economy[sender].coins += gainedCoins

        let levelsGained = 0
        let levelRewards = 0

        while (levelsGained < MAX_LEVELS_PER_GAME) {
            const neededXp = levels[sender].level * 100
            if (levels[sender].xp < neededXp) break

            levels[sender].xp -= neededXp
            levels[sender].level += 1
            levelsGained++

            const levelReward = levels[sender].level * 200
            levelRewards += levelReward
            economy[sender].coins += levelReward
        }

        let levelsSaved = writeJson(levelsPath, levels)
        let economySaved = writeJson(economyPath, economy)

        if (!levelsSaved) levelsSaved = writeJson(levelsPath, levels)
        if (!economySaved) economySaved = writeJson(economyPath, economy)

        if (!levelsSaved || !economySaved) {
            return { success: false, error: 'SAVE_ERROR' }
        }

        return {
            success: true,
            sender,
            baseXp,
            baseCoins,
            gainedXp,
            gainedCoins,
            hasBoost,
            levelsGained,
            levelRewards,
            currentXp: levels[sender].xp,
            currentLevel: levels[sender].level,
            currentCoins: economy[sender].coins,
            currentBank: economy[sender].bank
        }
    } catch (err) {
        logger.error(`GameRewards Error: ${err.stack || err.message}`)
        return { success: false, error: err.message }
    }
}

module.exports = {

    normalizeJid,

    getSenderFromMessage,

    getGameRewardPreview,

    applyGameReward

}
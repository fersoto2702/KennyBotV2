const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../utils/logger')

const ui =
    require('../utils/ui')

const {
    isEnabled
} = require('../utils/toggles')

const {
    checkLimited
} = require('../system/rateLimiter')

const economyPath =
    path.join(
        __dirname,
        '../../database/economy.json'
    )

const levelsPath =
    path.join(
        __dirname,
        '../../database/levels.json'
    )

const inventoryPath =
    path.join(
        __dirname,
        '../../database/inventory.json'
    )

const xpCooldown =
    new Map()

const XP_COOLDOWN =
    60 * 1000

const MAX_LEVELS_PER_MESSAGE =
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

function getBotProfileId(
    sock
) {

    return String(
        sock?.botProfile?.id ||
        sock?.botProfileId ||
        'main'
    )
        .trim()
        .toLowerCase()

}

function getBotName(
    sock
) {

    return String(
        sock?.botProfile?.name ||
        'KennyBot'
    )
        .trim()

}

function buildCooldownKey(
    sock,
    sender
) {

    return [
        getBotProfileId(
            sock
        ),
        sender
    ]
        .join(':')

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
            inventoryPath,
            {}
        ],

        [
            economyPath,
            {}
        ]

    ]

    for (
        const [
            file,
            def
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
                        def,
                        null,
                        2
                    ),
                    'utf8'
                )

            }

        } catch (err) {

            logger.error(
                `Level DB Init Error (${path.basename(file)}): ${err.stack || err.message}`
            )

        }

    }

}

function readJson(
    file,
    fallback
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
            Array.isArray(parsed)
        ) {

            return fallback

        }

        return parsed

    } catch (err) {

        logger.error(
            `Level DB Read Error (${path.basename(file)}): ${err.stack || err.message}`
        )

        return fallback

    }

}

function writeJson(
    file,
    data
) {

    try {

        fs.writeFileSync(
            file,
            JSON.stringify(
                data,
                null,
                2
            ),
            'utf8'
        )

        return true

    } catch (err) {

        logger.error(
            `Level DB Write Error (${path.basename(file)}): ${err.stack || err.message}`
        )

        return false

    }

}

setInterval(
    () => {

        try {

            const now =
                Date.now()

            for (
                const [
                    key,
                    expiration
                ]
                of xpCooldown
            ) {

                if (
                    now >=
                    expiration
                ) {

                    xpCooldown.delete(
                        key
                    )

                }

            }

        } catch {}

    },
    60000
)

module.exports =
    async (
        sock,
        msg,
        from
    ) => {

        try {

            if (
                !from ||
                typeof from !==
                'string'
            ) {

                return false

            }

            if (
                !from.endsWith(
                    '@g.us'
                )
            ) {

                return false

            }

            if (
                !msg?.message
            ) {

                return false

            }

            if (
                msg.key?.fromMe
            ) {

                return false

            }

            if (
                !isEnabled(
                    from,
                    'autolevelup'
                )
            ) {

                return false

            }

            const sender =
                normalizeJid(

                    msg.key?.participant ||

                    msg.participant ||

                    msg.key?.remoteJid

                )

            if (
                !sender
            ) {

                return false

            }

            const botProfileId =
                getBotProfileId(
                    sock
                )

            const botName =
                getBotName(
                    sock
                )

            if (
                checkLimited(
                    sender,
                    'flood',
                    botProfileId
                )
            ) {

                return false

            }

            const cooldownKey =
                buildCooldownKey(
                    sock,
                    sender
                )

            const now =
                Date.now()

            const expiration =
                xpCooldown.get(
                    cooldownKey
                )

            if (
                expiration &&
                now <
                expiration
            ) {

                return false

            }

            xpCooldown.set(
                cooldownKey,
                now +
                XP_COOLDOWN
            )

            ensureDatabases()

            const levels =
                readJson(
                    levelsPath,
                    {}
                )

            const inventory =
                readJson(
                    inventoryPath,
                    {}
                )

            const economy =
                readJson(
                    economyPath,
                    {}
                )

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
                ) <
                1
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
                !Array.isArray(
                    inventory[sender]
                )
            ) {

                inventory[sender] =
                    []

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

            let xp =
                Math.floor(
                    Math.random() *
                    15
                ) +
                5

            const hasBoost =
                inventory[sender].includes(
                    '🚀 XP Boost'
                )

            if (
                hasBoost
            ) {

                xp *=
                    2

            }

            levels[sender].xp +=
                xp

            let leveledUp =
                false

            let levelsGained =
                0

            let rewards =
                0

            while (
                levelsGained <
                MAX_LEVELS_PER_MESSAGE
            ) {

                const neededXp =
                    levels[sender].level *
                    100

                if (
                    levels[sender].xp <
                    neededXp
                ) {

                    break

                }

                levels[sender].xp -=
                    neededXp

                levels[sender].level +=
                    1

                levelsGained++

                leveledUp =
                    true

                const reward =
                    levels[sender].level *
                    200

                rewards +=
                    reward

                economy[sender].coins +=
                    reward

            }

            writeJson(
                levelsPath,
                levels
            )

            writeJson(
                economyPath,
                economy
            )

            if (
                !leveledUp
            ) {

                return true

            }

            logger.event(
                `${botName} | LevelUp: ${sender.split('@')[0]} +${levelsGained}`
            )

            if (
                checkLimited(
                    sender,
                    'commands',
                    botProfileId
                )
            ) {

                return true

            }

            await sock.safeSendMessage(
                from,
                {
                    text:
                        ui.success(
                            '¡LEVEL UP!',
                            [
                                [
                                    'Usuario',
                                    `@${sender.split('@')[0]}`
                                ],
                                [
                                    'Nivel',
                                    `⭐ ${levels[sender].level}`
                                ],
                                [
                                    'Subiste',
                                    `⬆️ +${levelsGained}`
                                ],
                                [
                                    'Premio',
                                    `🪙 +${rewards.toLocaleString()}`
                                ],
                                [
                                    'XP',
                                    `✨ ${levels[sender].xp}`
                                ]
                            ]
                        ),

                    mentions:
                        [
                            sender
                        ]
                }
            )

            return true

        } catch (err) {

            logger.error(
                `LevelHandler Error: ${err.stack || err.message}`
            )

            return false

        }

    }
const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../utils/logger')

const economyPath =
    path.join(
        __dirname,
        '../../database/economy.json'
    )

const passiveCooldown =
    new Map()

const PASSIVE_COOLDOWN =
    60 * 1000

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

function ensureEconomyDb() {

    try {

        const directory =
            path.dirname(
                economyPath
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

        if (
            !fs.existsSync(
                economyPath
            )
        ) {

            fs.writeFileSync(
                economyPath,
                JSON.stringify(
                    {},
                    null,
                    2
                ),
                'utf8'
            )

        }

        return true

    } catch (err) {

        logger.error(
            `Economy DB Init Error: ${err.stack || err.message}`
        )

        return false

    }

}

function readEconomy() {

    try {

        ensureEconomyDb()

        const raw =
            fs.readFileSync(
                economyPath,
                'utf8'
            )

        const data =
            JSON.parse(
                raw
            )

        if (
            !data ||
            typeof data !==
            'object' ||
            Array.isArray(
                data
            )
        ) {

            return {}

        }

        return data

    } catch (err) {

        logger.error(
            `Economy DB Read Error: ${err.stack || err.message}`
        )

        return {}

    }

}

function saveEconomy(
    economy
) {

    try {

        fs.writeFileSync(
            economyPath,
            JSON.stringify(
                economy,
                null,
                2
            ),
            'utf8'
        )

        return true

    } catch (err) {

        logger.error(
            `Economy DB Write Error: ${err.stack || err.message}`
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
                of passiveCooldown
            ) {

                if (
                    now >=
                    expiration
                ) {

                    passiveCooldown.delete(
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

            const botName =
                getBotName(
                    sock
                )

            const cooldownKey =
                buildCooldownKey(
                    sock,
                    sender
                )

            const now =
                Date.now()

            const expiration =
                passiveCooldown.get(
                    cooldownKey
                )

            if (
                expiration &&
                now <
                expiration
            ) {

                return false

            }

            passiveCooldown.set(
                cooldownKey,
                now +
                PASSIVE_COOLDOWN
            )

            const economy =
                readEconomy()

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

            const amount =
                Math.floor(
                    Math.random() *
                    10
                ) +
                1

            economy[sender].coins +=
                amount

            saveEconomy(
                economy
            )

            logger.event(
                `${botName} | PassiveCoins: ${sender.split('@')[0]} +${amount}`
            )

            return true

        } catch (err) {

            logger.error(
                `Error EconomyHandler: ${err.stack || err.message}`
            )

            return false

        }

    }
const fs   = require('fs')
const path = require('path')

const logger =
    require('../utils/logger')

const economyPath =
    path.join(
        __dirname,
        '../../database/economy.json'
    )

const passiveCooldown =
    new Map()

module.exports = async (
    sock,
    msg,
    from
) => {

    try {

        if (!from.endsWith('@g.us'))
            return

        if (!fs.existsSync(economyPath)) {

            fs.writeFileSync(
                economyPath,
                JSON.stringify({}, null, 2)
            )

        }

        const economy =
            JSON.parse(
                fs.readFileSync(economyPath)
            )

        const sender =
            msg.key.participant ||
            msg.key.remoteJid

        if (!economy[sender]) {

            economy[sender] = {

                coins: 0,
                bank: 0

            }

        }

        if (
            economy[sender].bank === undefined
        ) {

            economy[sender].bank = 0

        }

        const now =
            Date.now()

        const cooldown =
            60 * 1000 // 1 minuto

        const expiration =
            passiveCooldown.get(sender)

        if (
            expiration &&
            now < expiration
        ) {

            return

        }

        passiveCooldown.set(
            sender,
            now + cooldown
        )

        const amount =
            Math.floor(
                Math.random() * 10
            ) + 1

        economy[sender].coins += amount

        fs.writeFileSync(

            economyPath,

            JSON.stringify(
                economy,
                null,
                2
            )

        )

        logger.event(
            `PassiveCoins: ${sender.split('@')[0]} +${amount}`
        )

    } catch (err) {

        logger.error(
            `Error EconomyHandler: ${err.message}`
        )

    }

}
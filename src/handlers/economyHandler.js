const fs   = require('fs')
const path = require('path')

const logger =
    require('../utils/logger')

const economyPath =
    path.join(
        __dirname,
        '../../database/economy.json'
    )

// =========================
// COOLDOWN
// =========================

const passiveCooldown =
    new Map()

// =========================
// HANDLER
// =========================

module.exports = async (
    sock,
    msg,
    from
) => {

    try {

        // =========================
        // SOLO GRUPOS
        // =========================

        if (!from.endsWith('@g.us'))
            return

        // =========================
        // DB
        // =========================

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

        // =========================
        // USER
        // =========================

        const sender =
            msg.key.participant ||
            msg.key.remoteJid

        // =========================
        // CREAR USER
        // =========================

        if (!economy[sender]) {

            economy[sender] = {

                coins: 0,
                bank: 0

            }

        }

        // Fix users viejos
        if (
            economy[sender].bank === undefined
        ) {

            economy[sender].bank = 0

        }

        // =========================
        // COOLDOWN
        // =========================

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

        // =========================
        // MONEDAS
        // =========================

        const amount =
            Math.floor(
                Math.random() * 10
            ) + 1

        economy[sender].coins += amount

        // =========================
        // GUARDAR
        // =========================

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
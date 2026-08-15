const fs = require('fs')
const path = require('path')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

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

const ensureFile = file => {

    if (!fs.existsSync(file)) {

        fs.writeFileSync(
            file,
            JSON.stringify({}, null, 2)
        )

    }

}

const readJson = file => {

    try {

        ensureFile(file)

        return JSON.parse(
            fs.readFileSync(
                file,
                'utf8'
            )
        )

    } catch {

        return {}

    }

}

const saveJson = (
    file,
    data
) => {

    fs.writeFileSync(
        file,
        JSON.stringify(
            data,
            null,
            2
        )
    )

}

module.exports = {

    name: 'open',

    aliases: [
        'box',
        'caja',
        'lootbox'
    ],

    description:
        'Abre una caja misteriosa',

    category:
        'economia',

    async execute({
        sock,
        from,
        msg
    }) {

        try {

            const sender =
                msg.key.participant ||
                msg.key.remoteJid

            const economy =
                readJson(
                    economyPath
                )

            const levels =
                readJson(
                    levelsPath
                )

            if (!economy[sender]) {

                economy[sender] = {
                    coins: 0,
                    bank: 0
                }

            }

            if (!levels[sender]) {

                levels[sender] = {
                    xp: 0,
                    level: 1
                }

            }

            if (
                typeof economy[sender].coins !==
                'number'
            ) {

                economy[sender].coins = 0

            }

            if (
                typeof economy[sender].bank !==
                'number'
            ) {

                economy[sender].bank = 0

            }

            if (
                typeof levels[sender].xp !==
                'number'
            ) {

                levels[sender].xp = 0

            }

            const chance =
                Math.random()

            let result

            if (chance < 0.02) {

                const amount =
                    Math.floor(
                        Math.random() * 15001
                    ) + 15000

                economy[sender].coins +=
                    amount

                result =
                    ui.success(
                        '🎰 JACKPOT',
                        [
                            [
                                'Recompensa',
                                `🪙 +${amount.toLocaleString()} monedas`
                            ]
                        ],
                        '¡Has encontrado una recompensa legendaria!'
                    )

                logger.event(
                    `Open JACKPOT: ${sender.split('@')[0]} +${amount}`
                )

            }

            else if (
                chance < 0.67
            ) {

                const amount =
                    Math.floor(
                        Math.random() * 3000
                    ) + 500

                economy[sender].coins +=
                    amount

                result =
                    ui.success(
                        '🎁 CAJA MISTERIOSA',
                        [
                            [
                                'Recompensa',
                                `🪙 +${amount.toLocaleString()} monedas`
                            ]
                        ]
                    )

                logger.event(
                    `Open: ${sender.split('@')[0]} +${amount} monedas`
                )

            }

            else if (
                chance < 0.92
            ) {

                const amount =
                    Math.floor(
                        Math.random() * 500
                    ) + 100

                levels[sender].xp +=
                    amount

                result =
                    ui.success(
                        '🎁 CAJA MISTERIOSA',
                        [
                            [
                                'Recompensa',
                                `✨ +${amount} XP`
                            ]
                        ]
                    )

                logger.event(
                    `Open: ${sender.split('@')[0]} +${amount} XP`
                )

            }

            else {

                result =
                    ui.warn(
                        '🎁 CAJA MISTERIOSA',
                        'La caja estaba vacía... 💀'
                    )

                logger.event(
                    `Open: ${sender.split('@')[0]} → vacía`
                )

            }

            saveJson(
                economyPath,
                economy
            )

            saveJson(
                levelsPath,
                levels
            )

            return await sock.sendMessage(
                from,
                {
                    text: result
                }
            )

        } catch (err) {

            logger.error(
                `Error open: ${err.message}`
            )

            try {

                await sock.sendMessage(
                    from,
                    {
                        text:
                            ui.error(
                                'ERROR',
                                'No se pudo abrir la caja.'
                            )
                    }
                )

            } catch {}

        }

    }

}
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

const inventoryPath =
    path.join(
        __dirname,
        '../../database/inventory.json'
    )

const levelsPath =
    path.join(
        __dirname,
        '../../database/levels.json'
    )

const random =
    arr =>
        arr[
            Math.floor(
                Math.random() * arr.length
            )
        ]

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
        'Abre una o varias cajas misteriosas',

    category:
        'economia',

    cooldown: 5,

    async execute({
        sock,
        from,
        args,
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

            const inventory =
                readJson(
                    inventoryPath
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

            if (!inventory[sender]) {

                inventory[sender] = []

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

            if (
                !Array.isArray(
                    inventory[sender]
                )
            ) {

                inventory[sender] = []

            }

            const boxCount =
                inventory[sender]
                    .filter(
                        item =>
                            item ===
                            '🎁 Caja misteriosa'
                    )
                    .length

            if (boxCount <= 0) {

                return await sock.sendMessage(
                    from,
                    {
                        text:
                            ui.error(
                                'SIN CAJAS',
                                'No tienes cajas misteriosas.\n\nCómpralas usando /shop.'
                            )
                    }
                )

            }

            const requested =
                String(
                    args?.[0] || ''
                )
                    .toLowerCase()
                    .trim()

            let amount = 1

            if (
                requested === 'all' ||
                requested === 'todo' ||
                requested === 'todas'
            ) {

                amount = boxCount

            } else if (requested) {

                const parsed =
                    Number(
                        requested
                    )

                if (
                    !Number.isInteger(parsed) ||
                    parsed <= 0
                ) {

                    return await sock.sendMessage(
                        from,
                        {
                            text:
                                ui.warn(
                                    'CANTIDAD INVÁLIDA',
                                    'Usa /open, /open 5 o /open all.'
                                )
                        }
                    )

                }

                amount =
                    Math.min(
                        parsed,
                        boxCount
                    )

            }

            let coinsWon = 0
            let xpWon = 0
            let nothing = 0

            const rewards = [
                'coins',
                'xp',
                'nothing'
            ]

            for (
                let i = 0;
                i < amount;
                i++
            ) {

                const boxIndex =
                    inventory[sender]
                        .indexOf(
                            '🎁 Caja misteriosa'
                        )

                if (
                    boxIndex === -1
                ) {

                    break

                }

                inventory[sender]
                    .splice(
                        boxIndex,
                        1
                    )

                const reward =
                    random(
                        rewards
                    )

                if (
                    reward === 'coins'
                ) {

                    const rewardAmount =
                        Math.floor(
                            Math.random() *
                            3000
                        ) + 500

                    economy[sender]
                        .coins +=
                        rewardAmount

                    coinsWon +=
                        rewardAmount

                }

                else if (
                    reward === 'xp'
                ) {

                    const rewardAmount =
                        Math.floor(
                            Math.random() *
                            500
                        ) + 100

                    levels[sender]
                        .xp +=
                        rewardAmount

                    xpWon +=
                        rewardAmount

                }

                else {

                    nothing++

                }

            }

            saveJson(
                economyPath,
                economy
            )

            saveJson(
                inventoryPath,
                inventory
            )

            saveJson(
                levelsPath,
                levels
            )

            const remaining =
                inventory[sender]
                    .filter(
                        item =>
                            item ===
                            '🎁 Caja misteriosa'
                    )
                    .length

            logger.event(
                `Caja: ${sender.split('@')[0]} abrió ${amount} caja(s) → ${coinsWon} monedas / ${xpWon} XP / ${nothing} vacías`
            )

            const fields = [

                [
                    'Cajas abiertas',
                    `${amount}`
                ],

                [
                    '🪙 Monedas',
                    `+${coinsWon.toLocaleString()}`
                ],

                [
                    '✨ XP',
                    `+${xpWon.toLocaleString()}`
                ],

                [
                    '💀 Vacías',
                    `${nothing}`
                ],

                [
                    '📦 Restantes',
                    `${remaining}`
                ]

            ]

            return await sock.sendMessage(
                from,
                {
                    text:
                        ui.success(
                            '🎁 CAJAS ABIERTAS',
                            fields
                        )
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
                                'No se pudieron abrir las cajas.'
                            )
                    }
                )

            } catch {}

        }

    }

}
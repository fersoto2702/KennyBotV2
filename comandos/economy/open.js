const fs =
    require('fs')

const path =
    require('path')

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

// =========================
// ITEMS
// =========================

const ITEMS = [

    '🛡️ Chaleco',

    '⚔️ Espada',

    '🚀 XP Boost'

]

// =========================
// RANDOM
// =========================

const random = arr =>

    arr[
        Math.floor(
            Math.random() * arr.length
        )
    ]

module.exports = {

    name:
        'open',

    aliases: [

        'box',
        'caja',
        'lootbox'

    ],

    description:
        'Abre una caja misteriosa',

    category:
        'economia',

    cooldown: 5,

    async execute({

        sock,
        from,
        msg

    }) {

        try {

            // =========================
            // USER
            // =========================

            const sender =

                msg.key.participant ||

                msg.key.remoteJid

            // =========================
            // CREATE FILES
            // =========================

            for (const file of [

                economyPath,
                inventoryPath,
                levelsPath

            ]) {

                if (
                    !fs.existsSync(file)
                ) {

                    fs.writeFileSync(

                        file,

                        JSON.stringify(
                            {},
                            null,
                            2
                        )

                    )

                }

            }

            // =========================
            // READ DB
            // =========================

            let economy = {}
            let inventory = {}
            let levels = {}

            try {

                economy =
                    JSON.parse(

                        fs.readFileSync(
                            economyPath
                        )

                    )

            } catch {

                economy = {}

            }

            try {

                inventory =
                    JSON.parse(

                        fs.readFileSync(
                            inventoryPath
                        )

                    )

            } catch {

                inventory = {}

            }

            try {

                levels =
                    JSON.parse(

                        fs.readFileSync(
                            levelsPath
                        )

                    )

            } catch {

                levels = {}

            }

            // =========================
            // CREATE USER
            // =========================

            if (
                !economy[sender]
            ) {

                economy[sender] = {

                    coins: 0,

                    bank: 0

                }

            }

            if (
                !inventory[sender]
            ) {

                inventory[sender] = []

            }

            if (
                !levels[sender]
            ) {

                levels[sender] = {

                    xp: 0,

                    level: 1

                }

            }

            // =========================
            // FIX VALUES
            // =========================

            if (
                typeof economy[sender].coins !== 'number'
            ) {

                economy[sender].coins = 0

            }

            if (
                typeof economy[sender].bank !== 'number'
            ) {

                economy[sender].bank = 0

            }

            if (
                typeof levels[sender].xp !== 'number'
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

            // =========================
            // FIND BOX
            // =========================

            const boxIndex =

                inventory[sender].indexOf(
                    '🎁 Caja misteriosa'
                )

            if (
                boxIndex === -1
            ) {

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

            // =========================
            // REMOVE BOX
            // =========================

            inventory[sender].splice(
                boxIndex,
                1
            )

            // =========================
            // REWARDS
            // =========================

            const rewards = [

                'coins',
                'xp',
                'item',
                'nothing'

            ]

            const reward =
                random(rewards)

            // =========================
            // COINS
            // =========================

            if (
                reward === 'coins'
            ) {

                const amount =

                    Math.floor(
                        Math.random() * 3000
                    ) + 500

                economy[sender].coins +=
                    amount

                // SAVE

                fs.writeFileSync(

                    economyPath,

                    JSON.stringify(
                        economy,
                        null,
                        2
                    )

                )

                fs.writeFileSync(

                    inventoryPath,

                    JSON.stringify(
                        inventory,
                        null,
                        2
                    )

                )

                logger.event(

                    `Caja: ${sender.split('@')[0]} +${amount}`

                )

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.success(

                                'CAJA MISTERIOSA',

                                [

                                    [

                                        'Recompensa',

                                        `🪙 +${amount.toLocaleString()} monedas`

                                    ]

                                ]

                            )

                    }

                )

            }

            // =========================
            // XP
            // =========================

            if (
                reward === 'xp'
            ) {

                const amount =

                    Math.floor(
                        Math.random() * 500
                    ) + 100

                levels[sender].xp +=
                    amount

                // SAVE

                fs.writeFileSync(

                    levelsPath,

                    JSON.stringify(
                        levels,
                        null,
                        2
                    )

                )

                fs.writeFileSync(

                    inventoryPath,

                    JSON.stringify(
                        inventory,
                        null,
                        2
                    )

                )

                logger.event(

                    `Caja: ${sender.split('@')[0]} +${amount} XP`

                )

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.success(

                                'CAJA MISTERIOSA',

                                [

                                    [

                                        'Recompensa',

                                        `✨ +${amount} XP`

                                    ]

                                ]

                            )

                    }

                )

            }

            // =========================
            // ITEM
            // =========================

            if (
                reward === 'item'
            ) {

                const item =
                    random(ITEMS)

                inventory[sender].push(
                    item
                )

                // SAVE

                fs.writeFileSync(

                    inventoryPath,

                    JSON.stringify(
                        inventory,
                        null,
                        2
                    )

                )

                logger.event(

                    `Caja: ${sender.split('@')[0]} → ${item}`

                )

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.success(

                                'CAJA MISTERIOSA',

                                [

                                    [

                                        'Recompensa',

                                        item

                                    ]

                                ]

                            )

                    }

                )

            }

            // =========================
            // NOTHING
            // =========================

            fs.writeFileSync(

                inventoryPath,

                JSON.stringify(
                    inventory,
                    null,
                    2
                )

            )

            logger.event(

                `Caja: ${sender.split('@')[0]} → vacía`

            )

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.warn(

                            'CAJA MISTERIOSA',

                            'La caja estaba vacía... 💀'

                        )

                }

            )

        } catch (err) {

            logger.error(
                `Error open: ${err.message}`
            )

        }

    }

}
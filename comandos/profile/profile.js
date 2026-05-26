const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../../src/utils/logger')

const getRank =
    require('../../src/utils/getRank')

const ui =
    require('../../src/utils/ui')

const badgesPath =
    path.join(

        __dirname,

        '../../database/badges.json'

    )

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

module.exports = {

    name:
        'profile',

    aliases: [

        'perfil',
        'me',
        'stats'

    ],

    description:
        'Muestra tu perfil completo',

    category:
        'perfil',

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

            for (

                const file of [

                    economyPath,
                    levelsPath,
                    inventoryPath,
                    badgesPath

                ]

            ) {

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
            // SAFE READ
            // =========================

            const safeRead = file => {

                try {

                    return JSON.parse(
                        fs.readFileSync(file)
                    )

                } catch {

                    return {}

                }

            }

            const economy =
                safeRead(economyPath)

            const levels =
                safeRead(levelsPath)

            const inventory =
                safeRead(inventoryPath)

            const badges =
                safeRead(badgesPath)

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
                !levels[sender]
            ) {

                levels[sender] = {

                    xp: 0,
                    level: 1

                }

            }

            if (
                !inventory[sender]
            ) {

                inventory[sender] = []

            }

            if (
                !badges[sender]
            ) {

                badges[sender] = []

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
                typeof levels[sender].level !== 'number'
            ) {

                levels[sender].level = 1

            }

            if (
                !Array.isArray(inventory[sender])
            ) {

                inventory[sender] = []

            }

            if (
                !Array.isArray(badges[sender])
            ) {

                badges[sender] = []

            }

            // =========================
            // DATA
            // =========================

            const wallet =
                economy[sender].coins

            const bank =
                economy[sender].bank

            const total =
                wallet + bank

            const level =
                levels[sender].level

            const xp =
                levels[sender].xp

            const rankName =
                getRank(level)

            // =========================
            // RANK
            // =========================

            let users =
                Object.entries(levels)

            users.sort(

                (a, b) =>

                    (b[1]?.xp || 0) -

                    (a[1]?.xp || 0)

            )

            const rankPos =

                users.findIndex(

                    ([id]) =>
                        id === sender

                ) + 1

            // =========================
            // INVENTORY
            // =========================

            const invText =

                inventory[sender].length > 0

                    ? inventory[sender].join(', ')

                    : 'Vacío'

            // =========================
            // BADGES
            // =========================

            const badgeText =

                badges[sender].length > 0

                    ? badges[sender].join(', ')

                    : 'Sin logros'

            // =========================
            // SAVE
            // =========================

            fs.writeFileSync(

                economyPath,

                JSON.stringify(
                    economy,
                    null,
                    2
                )

            )

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

            fs.writeFileSync(

                badgesPath,

                JSON.stringify(
                    badges,
                    null,
                    2
                )

            )

            logger.event(

                `Profile check: ${sender.split('@')[0]}`

            )

            // =========================
            // SEND
            // =========================

            await sock.sendMessage(

                from,

                {

                    text: [

                        `👤 PERFIL GLOBAL`,

                        ui.divider,

                        `Usuario   @${sender.split('@')[0]}`,

                        ui.divider,

                        `Nivel     ⭐ ${level}`,

                        `XP        ✨ ${Number(xp).toLocaleString()}`,

                        `Rango     👑 ${rankName}`,

                        `Global    🏆 #${rankPos} de ${users.length}`,

                        ui.divider,

                        `Wallet    🪙 ${wallet.toLocaleString()}`,

                        `Banco     🏦 ${bank.toLocaleString()}`,

                        `Total     💸 ${total.toLocaleString()}`,

                        ui.divider,

                        `Items     ${invText}`,

                        `Badges    ${badgeText}`,

                        ui.divider

                    ].join('\n'),

                    mentions: [

                        sender

                    ]

                }

            )

        } catch (err) {

            logger.error(
                `Error profile: ${err.message}`
            )

        }

    }

}
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

// =========================
// COOLDOWNS
// =========================

const cooldowns =
    new Map()

module.exports = {

    name:
        'daily',

    aliases: [

        'diario',
        'reward'

    ],

    description:
        'Reclama tu recompensa diaria',

    category:
        'economia',

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
            // TIME
            // =========================

            const now =
                Date.now()

            const cooldownTime =
                24 * 60 * 60 * 1000

            // =========================
            // COOLDOWN
            // =========================

            if (
                cooldowns.has(sender)
            ) {

                const expires =
                    cooldowns.get(sender)

                if (
                    now < expires
                ) {

                    const hours =
                        Math.floor(
                            (expires - now) /
                            (60 * 60 * 1000)
                        )

                    const mins =
                        Math.floor(

                            (
                                (expires - now) %

                                (60 * 60 * 1000)

                            ) / 60000

                        )

                    return await sock.sendMessage(

                        from,

                        {

                            text:
                                ui.warn(

                                    'YA RECLAMASTE HOY',

                                    `Vuelve en ${hours}h ${mins}m.`

                                )

                        }

                    )

                }

            }

            cooldowns.set(

                sender,

                now + cooldownTime

            )

            // =========================
            // DB
            // =========================

            if (
                !fs.existsSync(economyPath)
            ) {

                fs.writeFileSync(

                    economyPath,

                    JSON.stringify(
                        {},
                        null,
                        2
                    )

                )

            }

            // =========================
            // READ DB
            // =========================

            let economy = {}

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

            // =========================
            // REWARD
            // =========================

            const reward =

                Math.floor(
                    Math.random() * 2000
                ) + 500

            economy[sender].coins +=
                reward

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

            logger.event(

                `Daily: ${sender.split('@')[0]} +${reward}`

            )

            // =========================
            // SEND
            // =========================

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            'DAILY REWARD',

                            [

                                [

                                    'Usuario',

                                    `@${sender.split('@')[0]}`

                                ],

                                [

                                    'Recompensa',

                                    `🪙 +${reward.toLocaleString()}`

                                ],

                                [

                                    'Wallet',

                                    `🪙 ${economy[sender].coins.toLocaleString()}`

                                ]

                            ]

                        ),

                    mentions: [

                        sender

                    ]

                }

            )

        } catch (err) {

            logger.error(
                `Error daily: ${err.message}`
            )

        }

    }

}
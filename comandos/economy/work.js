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

// =========================
// JOBS
// =========================

const JOBS = [

    'Programador 💻',

    'Taxista 🚕',

    'Doctor 🩺',

    'Policía 👮',

    'Chef 👨‍🍳',

    'Streamer 🎮',

    'Youtuber 📹',

    'Hacker 🖥️'

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
        'work',

    aliases: [

        'trabajar',
        'job'

    ],

    description:
        'Trabaja para ganar monedas',

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
            // COOLDOWN
            // =========================

            const now =
                Date.now()

            const cooldownTime =
                60 * 60 * 1000

            if (
                cooldowns.has(sender)
            ) {

                const expires =
                    cooldowns.get(sender)

                if (
                    now < expires
                ) {

                    const mins =
                        Math.ceil(
                            (expires - now) / 60000
                        )

                    return await sock.sendMessage(

                        from,

                        {

                            text:
                                ui.warn(

                                    'YA TRABAJASTE',

                                    `Vuelve en ${mins} minutos.`

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
            // JOB
            // =========================

            const job =
                random(JOBS)

            const amount =

                Math.floor(
                    Math.random() * 500
                ) + 100

            // =========================
            // ADD MONEY
            // =========================

            economy[sender].coins +=
                amount

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

                `Work: ${sender.split('@')[0]} +${amount} (${job})`

            )

            // =========================
            // SEND
            // =========================

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            'TRABAJO COMPLETADO',

                            [

                                [

                                    'Usuario',

                                    `@${sender.split('@')[0]}`

                                ],

                                [

                                    'Trabajo',

                                    job

                                ],

                                [

                                    'Ganaste',

                                    `🪙 +${amount.toLocaleString()}`

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
                `Error work: ${err.message}`
            )

        }

    }

}
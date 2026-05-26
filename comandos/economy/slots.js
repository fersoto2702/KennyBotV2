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
// EMOJIS
// =========================

const EMOJIS = [

    '🍎',
    '🍌',
    '🍇',
    '💎',
    '7️⃣',
    '🍒'

]

// =========================
// RANDOM
// =========================

const spin = () =>

    EMOJIS[
        Math.floor(
            Math.random() * EMOJIS.length
        )
    ]

module.exports = {

    name:
        'slots',

    aliases: [

        'slot',
        'tragamonedas'

    ],

    description:
        'Juega a las tragamonedas',

    category:
        'economia',

    cooldown: 10,

    async execute({

        sock,
        from,
        msg,
        args

    }) {

        try {

            // =========================
            // BET
            // =========================

            const bet =
                parseInt(args[0])

            if (

                isNaN(bet) ||

                bet <= 0

            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'APUESTA INVÁLIDA',

                                'Uso: /slots cantidad'

                            )

                    }

                )

            }

            // =========================
            // USER
            // =========================

            const sender =

                msg.key.participant ||

                msg.key.remoteJid

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
            // CHECK MONEY
            // =========================

            if (

                economy[sender].coins < bet

            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'FONDOS INSUFICIENTES',

                                `Solo tienes 🪙 ${economy[sender].coins.toLocaleString()}.`

                            )

                    }

                )

            }

            // =========================
            // REMOVE BET
            // =========================

            economy[sender].coins -=
                bet

            // =========================
            // SPIN
            // =========================

            const a = spin()
            const b = spin()
            const c = spin()

            // =========================
            // REWARD
            // =========================

            let reward = 0

            if (
                a === b &&
                b === c
            ) {

                reward = bet * 5

            }

            else if (

                a === b ||

                b === c ||

                a === c

            ) {

                reward = bet * 2

            }

            // =========================
            // WIN
            // =========================

            if (
                reward > 0
            ) {

                economy[sender].coins +=
                    reward

                // SAVE

                fs.writeFileSync(

                    economyPath,

                    JSON.stringify(
                        economy,
                        null,
                        2
                    )

                )

                logger.event(

                    `Slots: ${sender.split('@')[0]} +${reward}`

                )

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.success(

                                'SLOTS · GANASTE',

                                [

                                    [

                                        'Resultado',

                                        `${a} ${b} ${c}`

                                    ],

                                    [

                                        'Premio',

                                        `🪙 +${reward.toLocaleString()}`

                                    ],

                                    [

                                        'Wallet',

                                        `🪙 ${economy[sender].coins.toLocaleString()}`

                                    ]

                                ]

                            )

                    }

                )

            }

            // =========================
            // SAVE LOSE
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

                `Slots: ${sender.split('@')[0]} -${bet}`

            )

            // =========================
            // SEND LOSE
            // =========================

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.error(

                            'SLOTS · PERDISTE',

                            [

                                ui.divider,

                                `Resultado  ${a} ${b} ${c}`,

                                `Perdiste   🪙 -${bet.toLocaleString()}`,

                                `Wallet     🪙 ${economy[sender].coins.toLocaleString()}`

                            ].join('\n')

                        )

                }

            )

        } catch (err) {

            logger.error(
                `Error slots: ${err.message}`
            )

        }

    }

}
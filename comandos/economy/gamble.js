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

module.exports = {

    name:
        'gamble',

    aliases: [

        'bet',
        'apostar'

    ],

    description:
        'Apuesta tus monedas al azar',

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
            // USER
            // =========================

            const sender =

                msg.key.participant ||

                msg.key.remoteJid

            // =========================
            // AMOUNT
            // =========================

            const amount =
                parseInt(args[0])

            if (

                isNaN(amount) ||

                amount <= 0

            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'CANTIDAD INVÁLIDA',

                                'Uso: /gamble cantidad'

                            )

                    }

                )

            }

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

                economy[sender].coins < amount

            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'FONDOS INSUFICIENTES',

                                'No tienes suficientes monedas.'

                            )

                    }

                )

            }

            // =========================
            // RESULT
            // =========================

            const win =
                Math.random() < 0.5

            // =========================
            // WIN
            // =========================

            if (win) {

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

                    `Gamble: ${sender.split('@')[0]} +${amount}`

                )

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.success(

                                'GAMBLE',

                                [

                                    [

                                        'Resultado',

                                        '🟢 GANASTE'

                                    ],

                                    [

                                        'Premio',

                                        `🪙 +${amount.toLocaleString()}`

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
            // LOSE
            // =========================

            economy[sender].coins -=
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

                `Gamble: ${sender.split('@')[0]} -${amount}`

            )

            // =========================
            // SEND
            // =========================

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.error(

                            'GAMBLE',

                            [

                                '🔴 PERDISTE',

                                ui.divider,

                                `Perdiste 🪙 -${amount.toLocaleString()}`,

                                `Wallet   🪙 ${economy[sender].coins.toLocaleString()}`

                            ].join('\n')

                        )

                }

            )

        } catch (err) {

            logger.error(
                `Error gamble: ${err.message}`
            )

        }

    }

}
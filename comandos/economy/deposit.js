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
        'deposit',

    aliases: [

        'dep',
        'bank'

    ],

    description:
        'Deposita monedas en el banco',

    category:
        'economia',

    cooldown: 5,

    async execute({

        sock,
        from,
        msg,
        args

    }) {

        try {

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

                                'Uso: /deposit cantidad'

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
            // TRANSFER
            // =========================

            economy[sender].coins -=
                amount

            economy[sender].bank +=
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

                `Deposit: ${sender.split('@')[0]} → ${amount}`

            )

            // =========================
            // SEND
            // =========================

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            'DEPÓSITO REALIZADO',

                            [

                                [

                                    'Depositado',

                                    `🪙 ${amount.toLocaleString()}`

                                ],

                                [

                                    'Wallet',

                                    `🪙 ${economy[sender].coins.toLocaleString()}`

                                ],

                                [

                                    'Banco',

                                    `🏦 ${economy[sender].bank.toLocaleString()}`

                                ]

                            ]

                        )

                }

            )

        } catch (err) {

            logger.error(
                `Error deposit: ${err.message}`
            )

        }

    }

}
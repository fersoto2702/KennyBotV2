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
        'balance',

    aliases: [

        'bal',
        'money',
        'wallet'

    ],

    description:
        'Muestra tu balance de monedas',

    category:
        'economia',

    cooldown: 3,

    async execute({

        sock,
        from,
        msg

    }) {

        try {

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
            // READ
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
            // USER
            // =========================

            const sender =

                msg.key.participant ||

                msg.key.remoteJid

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
            // VALUES
            // =========================

            const wallet =
                economy[sender].coins

            const bank =
                economy[sender].bank

            const total =
                wallet + bank

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

            // =========================
            // SEND
            // =========================

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.info(

                            'BALANCE',

                            [

                                [

                                    'Usuario',

                                    `@${sender.split('@')[0]}`

                                ],

                                [

                                    'Wallet',

                                    `🪙 ${wallet.toLocaleString()}`

                                ],

                                [

                                    'Banco',

                                    `🏦 ${bank.toLocaleString()}`

                                ],

                                [

                                    'Total',

                                    `💸 ${total.toLocaleString()}`

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
                `Error balance: ${err.message}`
            )

        }

    }

}
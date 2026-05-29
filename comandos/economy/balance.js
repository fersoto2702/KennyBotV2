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

            const sender =

                msg.key.participant ||

                msg.key.remoteJid

            if (
                !economy[sender]
            ) {

                economy[sender] = {

                    coins: 0,

                    bank: 0

                }

            }

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

            const wallet =
                economy[sender].coins

            const bank =
                economy[sender].bank

            const total =
                wallet + bank

            fs.writeFileSync(

                economyPath,

                JSON.stringify(
                    economy,
                    null,
                    2
                )

            )

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
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

            const sender =

                msg.key.participant ||

                msg.key.remoteJid

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

            const win =
                Math.random() < 0.5

            if (win) {

                economy[sender].coins +=
                    amount

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

            economy[sender].coins -=
                amount

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
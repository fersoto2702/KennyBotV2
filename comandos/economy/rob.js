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

const cooldowns =
    new Map()

module.exports = {

    name:
        'rob',

    aliases: [

        'robar',
        'steal'

    ],

    description:
        'Intenta robarle monedas a otro usuario',

    category:
        'economia',

    async execute({

        sock,
        from,
        msg

    }) {

        try {

            const target =

                msg.message
                ?.extendedTextMessage
                ?.contextInfo
                ?.mentionedJid?.[0]

            if (
                !target
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'USO INCORRECTO',

                                'Uso: /rob @usuario'

                            )

                    }

                )

            }

            const sender =

                msg.key.participant ||

                msg.key.remoteJid

            if (
                sender === target
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ACCIÓN INVÁLIDA',

                                'No puedes robarte a ti mismo.'

                            )

                    }

                )

            }

            const botNumber =
                sock.user.id.split(':')[0] + '@s.whatsapp.net'

            if (
                target === botNumber
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'ACCIÓN INVÁLIDA',

                                'No puedes robarle al bot.'

                            )

                    }

                )

            }

            const now =
                Date.now()

            const cooldownTime =
                30 * 60 * 1000

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

                                    'COOLDOWN ACTIVO',

                                    `Espera ${mins} minutos para volver a robar.`

                                )

                        }

                    )

                }

            }

            cooldowns.set(

                sender,

                now + cooldownTime

            )

            for (const file of [

                economyPath,
                inventoryPath

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

            let economy = {}
            let inventory = {}

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

            for (const user of [

                sender,
                target

            ]) {

                if (
                    !economy[user]
                ) {

                    economy[user] = {

                        coins: 0,

                        bank: 0

                    }

                }

                if (
                    !inventory[user]
                ) {

                    inventory[user] = []

                }

                if (
                    typeof economy[user].coins !== 'number'
                ) {

                    economy[user].coins = 0

                }

                if (
                    typeof economy[user].bank !== 'number'
                ) {

                    economy[user].bank = 0

                }

                if (
                    !Array.isArray(
                        inventory[user]
                    )
                ) {

                    inventory[user] = []

                }

            }

            if (

                economy[target].coins < 100

            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'OBJETIVO POBRE',

                                `@${target.split('@')[0]} tiene muy pocas monedas.`

                            ),

                        mentions: [

                            target

                        ]

                    }

                )

            }

            const hasVest =

                inventory[target]
                .includes('🛡️ Chaleco')

            const hasSword =

                inventory[sender]
                .includes('⚔️ Espada')

            let chance =

                hasVest
                    ? 0.25
                    : 0.5

            if (
                hasSword
            ) {

                chance += 0.25

            }

            const success =
                Math.random() < chance

            if (!success) {

                const fine =

                    Math.floor(
                        Math.random() * 200
                    ) + 50

                economy[sender].coins =

                    Math.max(

                        0,

                        economy[sender].coins - fine

                    )

                fs.writeFileSync(

                    economyPath,

                    JSON.stringify(
                        economy,
                        null,
                        2
                    )

                )

                logger.event(

                    `Rob fallido: ${sender.split('@')[0]} -${fine}`

                )

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ROBO FALLIDO',

                                [

                                    'Te atraparon intentando robar.',

                                    ui.divider,

                                    `Multa    🪙 -${fine.toLocaleString()}`,

                                    `Wallet   🪙 ${economy[sender].coins.toLocaleString()}`

                                ].join('\n')

                            )

                    }

                )

            }

            let amount =

                Math.floor(
                    Math.random() * 500
                ) + 100

            if (
                hasVest
            ) {

                amount =
                    Math.floor(amount / 2)

            }

            if (
                hasSword
            ) {

                amount *= 2

            }

            economy[target].coins =

                Math.max(

                    0,

                    economy[target].coins - amount

                )

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

                `Rob exitoso: ${sender.split('@')[0]} → ${target.split('@')[0]} ${amount}`

            )

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            'ROBO EXITOSO',

                            [

                                [

                                    'Víctima',

                                    `@${target.split('@')[0]}`

                                ],

                                [

                                    'Robado',

                                    `🪙 ${amount.toLocaleString()}`

                                ],

                                [

                                    'Wallet',

                                    `🪙 ${economy[sender].coins.toLocaleString()}`

                                ],

                                ...(hasVest

                                    ? [[

                                        'Escudo',

                                        '🛡️ Chaleco redujo el botín'

                                    ]]

                                    : []),

                                ...(hasSword

                                    ? [[

                                        'Espada',

                                        '⚔️ Bonus aplicado'

                                    ]]

                                    : [])

                            ]

                        ),

                    mentions: [

                        target

                    ]

                }

            )

        } catch (err) {

            logger.error(
                `Error rob: ${err.message}`
            )

        }

    }

}
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
// SUCCESS
// =========================

const CRIMES = [

    'Robaste un banco 🏦',

    'Hackeaste una empresa 💻',

    'Vendiste información secreta 🕵️',

    'Asaltaste un casino 🎰',

    'Robaste joyas 💎',

    'Interceptaste una transferencia 💳'

]

// =========================
// FAILS
// =========================

const FAILS = [

    'La policía te atrapó 🚓',

    'Te hackearon de vuelta 💀',

    'Fallaste el robo 🔒',

    'Te descubrieron 🕵️',

    'Terminaste en prisión ⛓️',

    'Activaste una alarma 🚨'

]

// =========================
// RANDOM
// =========================

const rand = arr =>

    arr[
        Math.floor(
            Math.random() * arr.length
        )
    ]

module.exports = {

    name:
        'crime',

    aliases: [

        'crimen',
        'robo'

    ],

    description:
        'Intenta cometer un crimen para ganar monedas',

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
                15 * 60 * 1000

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

                                    `Espera ${mins} minutos para volver a intentarlo.`

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

            // =========================
            // SUCCESS?
            // =========================

            const success =
                Math.random() < 0.6

            // =========================
            // SUCCESS
            // =========================

            if (success) {

                const amount =

                    Math.floor(
                        Math.random() * 2500
                    ) + 500

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

                    `Crime exitoso: ${sender.split('@')[0]} +${amount}`

                )

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.success(

                                'CRIMEN EXITOSO',

                                [

                                    [

                                        'Acción',

                                        rand(CRIMES)

                                    ],

                                    [

                                        'Ganancia',

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
            // FAIL
            // =========================

            const fine =

                Math.floor(
                    Math.random() * 1000
                ) + 200

            economy[sender].coins =

                Math.max(

                    0,

                    economy[sender].coins - fine

                )

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

                `Crime fallido: ${sender.split('@')[0]} -${fine}`

            )

            // =========================
            // SEND
            // =========================

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.error(

                            'CRIMEN FALLIDO',

                            [

                                rand(FAILS),

                                ui.divider,

                                `Multa    🪙 -${fine.toLocaleString()}`,

                                `Wallet   🪙 ${economy[sender].coins.toLocaleString()}`

                            ].join('\n')

                        )

                }

            )

        } catch (err) {

            logger.error(
                `Error crime: ${err.message}`
            )

        }

    }

}
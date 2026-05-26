const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const premiumPath =
    path.join(

        __dirname,

        '../../database/premium.json'

    )

module.exports = {

    name:
        'addpremium',

    aliases: [

        'addprem',
        'givepremium',
        'premadd'

    ],

    description:
        'Agrega un usuario a premium',

    category:
        'perfil',

    ownerOnly: true,

    async execute({

        sock,
        from,
        msg

    }) {

        try {

            // =========================
            // TARGET
            // =========================

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

                                'USUARIO REQUERIDO',

                                'Uso: /addpremium @usuario'

                            )

                    }

                )

            }

            // =========================
            // CREATE FILE
            // =========================

            if (
                !fs.existsSync(premiumPath)
            ) {

                fs.writeFileSync(

                    premiumPath,

                    JSON.stringify(
                        [],
                        null,
                        2
                    )

                )

            }

            // =========================
            // READ DB
            // =========================

            let premium = []

            try {

                premium =
                    JSON.parse(

                        fs.readFileSync(
                            premiumPath
                        )

                    )

                if (
                    !Array.isArray(premium)
                ) {

                    premium = []

                }

            } catch {

                premium = []

            }

            // =========================
            // DUPLICATE CHECK
            // =========================

            if (
                premium.includes(target)
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'YA ES PREMIUM',

                                `@${target.split('@')[0]} ya tiene premium.`

                            ),

                        mentions: [

                            target

                        ]

                    }

                )

            }

            // =========================
            // ADD
            // =========================

            premium.push(target)

            // =========================
            // SAVE
            // =========================

            fs.writeFileSync(

                premiumPath,

                JSON.stringify(
                    premium,
                    null,
                    2
                )

            )

            logger.event(

                `Premium agregado: ${target.split('@')[0]}`

            )

            // =========================
            // SEND
            // =========================

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            'PREMIUM AGREGADO',

                            [

                                [

                                    'Usuario',

                                    `@${target.split('@')[0]}`

                                ],

                                [

                                    'Estado',

                                    '💎 PREMIUM'

                                ]

                            ]

                        ),

                    mentions: [

                        target

                    ]

                }

            )

        } catch (err) {

            logger.error(
                `Error addpremium: ${err.message}`
            )

        }

    }

}
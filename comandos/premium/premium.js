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
        'premium',

    aliases: [
        'premiums',
        'premiumlist',
        'listpremium',
        'premlist'
    ],

    description:
        'Muestra la lista de usuarios premium',

    category:
        'perfil',

    ownerOnly: true,

    async execute({
        sock,
        from
    }) {

        try {

            if (!fs.existsSync(premiumPath)) {
                fs.writeFileSync(
                    premiumPath,
                    JSON.stringify([], null, 2)
                )
            }

            let premium = []

            try {

                premium =
                    JSON.parse(
                        fs.readFileSync(premiumPath)
                    )

                if (!Array.isArray(premium)) {
                    premium = []
                }

            } catch {
                premium = []
            }

            premium = [
                ...new Set(
                    premium.filter(
                        user =>
                            typeof user === 'string'
                    )
                )
            ]

            fs.writeFileSync(
                premiumPath,
                JSON.stringify(premium, null, 2)
            )

            if (premium.length === 0) {

                return await sock.sendMessage(
                    from,
                    {
                        text:
                            ui.info(
                                'USUARIOS PREMIUM',
                                [],
                                'No hay usuarios premium.'
                            )
                    }
                )

            }

            const mentions =
                [...premium]

            const rows =
                premium.map(
                    (user, i) =>
                        `│ ${i + 1}. 💎 @${user.split('@')[0]}`
                ).join('\n')

            logger.event(
                `Premium list consultada (${premium.length} usuarios)`
            )

            await sock.sendMessage(
                from,
                {
                    text: [
                        `💎 USUARIOS PREMIUM`,
                        ui.divider,
                        rows,
                        ui.divider,
                        `Total: ${premium.length} usuario${premium.length !== 1 ? 's' : ''}`
                    ].join('\n'),
                    mentions
                }
            )

        } catch (err) {

            logger.error(
                `Error premium: ${err.message}`
            )

        }

    }

}
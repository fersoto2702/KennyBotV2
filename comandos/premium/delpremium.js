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
        'delpremium',

    aliases: [
        'delprem',
        'removepremium',
        'unpremium'
    ],

    description:
        'Elimina a un usuario de premium',

    category:
        'perfil',

    ownerOnly: true,

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

            if (!target) {

                return await sock.sendMessage(
                    from,
                    {
                        text:
                            ui.warn(
                                'USUARIO REQUERIDO',
                                'Uso: /delpremium @usuario'
                            )
                    }
                )

            }

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

            if (!premium.includes(target)) {

                return await sock.sendMessage(
                    from,
                    {
                        text:
                            ui.warn(
                                'NO ES PREMIUM',
                                `@${target.split('@')[0]} no tiene premium.`
                            ),
                        mentions: [target]
                    }
                )

            }

            premium =
                premium.filter(
                    user => user !== target
                )

            fs.writeFileSync(
                premiumPath,
                JSON.stringify(premium, null, 2)
            )

            logger.event(
                `Premium eliminado: ${target.split('@')[0]}`
            )

            await sock.sendMessage(
                from,
                {
                    text:
                        ui.success(
                            'PREMIUM ELIMINADO',
                            [
                                ['Usuario', `@${target.split('@')[0]}`],
                                ['Estado', '○ Sin premium']
                            ]
                        ),
                    mentions: [target]
                }
            )

        } catch (err) {

            logger.error(
                `Error delpremium: ${err.message}`
            )

        }

    }

}
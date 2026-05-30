const isPremium =
    require('./isPremium')

const ui =
    require('./ui')

module.exports = async (

    sock,
    from,
    sender

) => {

    try {

        const premium =
            await isPremium(sender)

        if (premium)
            return true

        await sock.sendMessage(from, {

            text: ui.error(

                'EXCLUSIVO PREMIUM',

                [
                    'Este comando es solo para usuarios premium.',
                    '',
                    '💎 Beneficios premium:',
                    '• Comandos exclusivos',
                    '• Menos cooldown',
                    '• Más límites',
                    '• Funciones especiales',
                    '',
                    '📩 Contacta al owner para obtener premium.'
                ].join('\n')

            )

        })

        return false

    } catch {

        return false

    }

}
const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

function getBotName(
    sock
) {

    return String(
        sock?.botProfile?.name ||
        'KennyBot'
    )
        .trim()

}

function flipCoin() {

    return Math.random() < 0.5
        ? 'cara'
        : 'cruz'

}

async function sendMessage(
    sock,
    jid,
    content,
    options = {}
) {

    if (
        typeof sock.safeSendMessage ===
        'function'
    ) {

        return await sock.safeSendMessage(
            jid,
            content,
            options
        )

    }

    return await sock.sendMessage(
        jid,
        content,
        options
    )

}

module.exports = {

    name:
        'moneda',

    aliases: [
        'coin',
        'caraocruz',
        'flip'
    ],

    description:
        'Lanza una moneda y obtiene cara o cruz',

    category:
        'diversion',

    async execute({
        sock,
        from
    }) {

        try {

            const result =
                flipCoin()

            const botName =
                getBotName(
                    sock
                )

            const emoji =
                result === 'cara'
                    ? '🪙'
                    : '🪙'

            const label =
                result === 'cara'
                    ? 'CARA'
                    : 'CRUZ'

            const message = [

                'ㅤ۟∩　ׅ　🪙　ׅ　*MONEDA*　ׄᰙ',

                '',

                `𖣣ֶㅤ֯⌗ ${emoji}  ׄ ⬭ *Resultado:* ${label}`,

                '',

                `╰─ 𓂃 Lanzada por ${botName}`

            ]
                .join(
                    '\n'
                )

            await sendMessage(
                sock,
                from,
                {
                    text:
                        message
                }
            )

            logger.event(
                `${botName} | Moneda → ${label}`
            )

            return true

        } catch (err) {

            logger.error(
                `${getBotName(sock)} | Error moneda: ${err.stack || err.message}`
            )

            try {

                await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.error(
                                'ERROR',
                                'No se pudo lanzar la moneda.'
                            )
                    }
                )

            } catch {}

            return false

        }

    }

} 
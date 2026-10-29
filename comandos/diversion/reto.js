const logger =
    require('../../src/utils/logger')

const CHALLENGES = [

    'Manda un audio diciendo una frase romántica con voz seria.',

    'Cambia tu foto de perfil durante 10 minutos.',

    'Escribe algo bonito sobre la última persona que habló en el grupo.',

    'Manda un sticker que represente tu estado de ánimo actual.',

    'Escribe durante los próximos 3 mensajes sin usar la letra A.',

    'Manda el último meme que tengas guardado.',

    'Pon una frase vergonzosa en tu estado durante 10 minutos.',

    'Escribe un cumplido sincero para alguien del grupo.',

    'Habla como robot durante tus próximos 3 mensajes.',

    'Manda un emoji que describa a cada una de las últimas 3 personas que hablaron.',

    'Escribe una frase como si estuvieras en una novela dramática.',

    'Manda un audio cantando aunque sea durante 5 segundos.',

    'Deja que alguien del grupo elija tu foto de perfil por 10 minutos.',

    'Escribe el nombre de tu crush usando únicamente emojis.',

    'Responde el siguiente mensaje del grupo como si fueras un personaje famoso.',

    'Manda el sticker más raro que tengas.',

    'Pon un apodo divertido a la persona que habló antes que tú.',

    'Escribe una declaración de amor falsa de tres líneas.',

    'Manda un mensaje usando solamente emojis.',

    'Cuenta un chiste malo.'
]

function getBotName(
    sock
) {

    return String(
        sock?.botProfile?.name ||
        'KennyBot'
    )
        .trim()

}

function randomChallenge() {

    return CHALLENGES[
        Math.floor(
            Math.random() *
            CHALLENGES.length
        )
    ]

}

module.exports = {

    name:
        'reto',

    aliases: [
        'dare'
    ],

    description:
        'Obtén un reto aleatorio',

    category:
        'diversion',

    async execute({
        sock,
        from
    }) {

        try {

            const challenge =
                randomChallenge()

            const text = [

                'ㅤ۟∩　ׅ　🔥　ׅ　*RETO*　ׄᰙ',

                '',

                `𖣣ֶㅤ֯⌗ 🎯  ׄ ⬭ ${challenge}`,

                '',

                `╰─ 𓂃 ${getBotName(sock)}`

            ]
                .join(
                    '\n'
                )

            if (
                typeof sock.safeSendMessage ===
                'function'
            ) {

                await sock.safeSendMessage(
                    from,
                    {
                        text
                    }
                )

            } else {

                await sock.sendMessage(
                    from,
                    {
                        text
                    }
                )

            }

            return true

        } catch (err) {

            logger.error(
                `${getBotName(sock)} | Error reto: ${err.stack || err.message}`
            )

            return false

        }

    }

}
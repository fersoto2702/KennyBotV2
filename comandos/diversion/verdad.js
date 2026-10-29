const logger =
    require('../../src/utils/logger')

const QUESTIONS = [

    '¿Cuál ha sido tu momento más vergonzoso?',

    '¿Quién fue tu primer crush?',

    '¿Alguna vez has mentido para evitar salir con alguien?',

    '¿Quién del grupo crees que te conoce mejor?',

    '¿Cuál es el mensaje que más te arrepientes de haber enviado?',

    '¿Alguna vez te has enamorado de alguien que no debías?',

    '¿Cuál es tu mayor miedo?',

    '¿Qué secreto nunca le has contado a casi nadie?',

    '¿Has fingido que alguien te caía bien?',

    '¿A quién del grupo llevarías contigo a una isla desierta?',

    '¿Cuál fue la última mentira que dijiste?',

    '¿Alguna vez has revisado demasiado el perfil de alguien?',

    '¿Quién fue la última persona que te puso nervioso/a?',

    '¿Cuál ha sido tu peor cita?',

    '¿Qué cosa infantil sigues haciendo?',

    '¿Alguna vez te han descubierto mintiendo?',

    '¿Quién del grupo crees que sería peor pareja?',

    '¿Qué es lo primero que notas cuando alguien te atrae?',

    '¿Has sentido celos de alguien del grupo?',

    '¿Cuál es la cosa más impulsiva que has hecho?'

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

function randomQuestion() {

    return QUESTIONS[
        Math.floor(
            Math.random() *
            QUESTIONS.length
        )
    ]

}

module.exports = {

    name:
        'verdad',

    aliases: [
        'truth'
    ],

    description:
        'Obtén una pregunta aleatoria de verdad',

    category:
        'diversion',

    async execute({
        sock,
        from
    }) {

        try {

            const question =
                randomQuestion()

            const text = [

                'ㅤ۟∩　ׅ　👀　ׅ　*VERDAD*　ׄᰙ',

                '',

                `𖣣ֶㅤ֯⌗ ❓  ׄ ⬭ ${question}`,

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
                `${getBotName(sock)} | Error verdad: ${err.stack || err.message}`
            )

            return false

        }

    }

}
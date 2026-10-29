const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const {
    getSenderFromMessage,
    applyGameReward
} = require('../../src/utils/gameRewards')

const activeGames =
    new Map()

const QUESTIONS = [

    {
        question:
            '¿Cuál es el planeta más cercano al Sol?',

        answers: [
            'mercurio'
        ]
    },

    {
        question:
            '¿Cuántos lados tiene un hexágono?',

        answers: [
            '6',
            'seis'
        ]
    },

    {
        question:
            '¿Cuál es el océano más grande del mundo?',

        answers: [
            'pacifico',
            'pacífico',
            'oceano pacifico',
            'océano pacífico'
        ]
    },

    {
        question:
            '¿Cuál es la capital de Japón?',

        answers: [
            'tokio',
            'tokyo'
        ]
    },

    {
        question:
            '¿Cuántos días tiene una semana?',

        answers: [
            '7',
            'siete'
        ]
    },

    {
        question:
            '¿Qué animal es conocido como el rey de la selva?',

        answers: [
            'leon',
            'león'
        ]
    },

    {
        question:
            '¿Cuántos minutos tiene una hora?',

        answers: [
            '60',
            'sesenta'
        ]
    },

    {
        question:
            '¿Cuál es el satélite natural de la Tierra?',

        answers: [
            'luna',
            'la luna'
        ]
    },

    {
        question:
            '¿Qué color resulta de mezclar azul y amarillo?',

        answers: [
            'verde'
        ]
    },

    {
        question:
            '¿Cuál es el animal terrestre más rápido?',

        answers: [
            'guepardo',
            'cheetah'
        ]
    },

    {
        question:
            '¿Cuántos continentes existen normalmente en el modelo de siete continentes?',

        answers: [
            '7',
            'siete'
        ]
    },

    {
        question:
            '¿Qué instrumento tiene teclas blancas y negras?',

        answers: [
            'piano',
            'el piano'
        ]
    },

    {
        question:
            '¿Cuál es el resultado de 9 × 8?',

        answers: [
            '72',
            'setenta y dos'
        ]
    },

    {
        question:
            '¿Cuál es la capital de México?',

        answers: [
            'ciudad de mexico',
            'ciudad de méxico',
            'cdmx'
        ]
    },

    {
        question:
            '¿Cuántas horas tiene un día?',

        answers: [
            '24',
            'veinticuatro'
        ]
    }

]

function normalizeText(
    text
) {

    return String(
        text ||
        ''
    )
        .trim()
        .toLowerCase()
        .normalize(
            'NFD'
        )
        .replace(
            /[\u0300-\u036f]/g,
            ''
        )
        .replace(
           (/[^\p{L}\p{N}\s]/gu),
            ''
        )
        .replace(
            /\s+/g,
            ' '
        )
        .trim()

}

function getBotName(
    sock
) {

    return String(
        sock?.botProfile?.name ||
        'KennyBot'
    )
        .trim()

}

function getProfileId(
    sock
) {

    return String(
        sock?.botProfile?.id ||
        sock?.botProfileId ||
        'main'
    )
        .trim()
        .toLowerCase()

}

function buildGameKey(
    sock,
    from
) {

    return [
        getProfileId(
            sock
        ),
        from
    ]
        .join(
            ':'
        )

}

function getRandomQuestion() {

    return QUESTIONS[
        Math.floor(
            Math.random() *
            QUESTIONS.length
        )
    ]

}

function answerMatches(
    input,
    answers
) {

    const normalizedInput =
        normalizeText(
            input
        )

    return answers.some(
        answer =>
            normalizeText(
                answer
            ) ===
            normalizedInput
    )

}

function getMessageText(
    msg
) {

    return (
        msg?.message?.conversation ||

        msg?.message?.extendedTextMessage?.text ||

        msg?.message?.imageMessage?.caption ||

        msg?.message?.videoMessage?.caption ||

        ''
    )

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

async function startTrivia({
    sock,
    from
}) {

    const gameKey =
        buildGameKey(
            sock,
            from
        )

    if (
        activeGames.has(
            gameKey
        )
    ) {

        return await sendMessage(
            sock,
            from,
            {
                text:
                    ui.warn(
                        'TRIVIA ACTIVA',
                        'Ya hay una pregunta activa en este grupo.'
                    )
            }
        )

    }

    const question =
        getRandomQuestion()

    activeGames.set(
        gameKey,
        {
            ...question,

            startedAt:
                Date.now()
        }
    )

    return await sendMessage(
        sock,
        from,
        {
            text: [
                'ㅤ۟∩　ׅ　🧠　ׅ　*TRIVIA*　ׄᰙ',
                '',
                `𖣣ֶㅤ֯⌗ ❓  ׄ ⬭ ${question.question}`,
                '',
                '𖣣ֶㅤ֯⌗ 🎁  ׄ ⬭ *Premio:* +30 XP / +20 monedas',
                '',
                '╰─ 𓂃 Responde directamente en el chat'
            ]
                .join(
                    '\n'
                )
        }
    )

}

async function checkTriviaAnswer({
    sock,
    msg,
    from
}) {

    if (
        !from?.endsWith(
            '@g.us'
        )
    ) {

        return false

    }

    if (
        msg?.key?.fromMe
    ) {

        return false

    }

    const gameKey =
        buildGameKey(
            sock,
            from
        )

    const game =
        activeGames.get(
            gameKey
        )

    if (
        !game
    ) {

        return false

    }

    const text =
        getMessageText(
            msg
        )

    if (
        !text
    ) {

        return false

    }

    if (
        !answerMatches(
            text,
            game.answers
        )
    ) {

        return false

    }

    const sender =
        getSenderFromMessage(
            sock,
            msg
        )

    if (
        !sender
    ) {

        return false

    }

    activeGames.delete(
        gameKey
    )

    const reward =
        applyGameReward({
            sender,
            xp:
                30,
            coins:
                20
        })

    if (
        !reward.success
    ) {

        logger.error(
            `${getBotName(sock)} | Trivia reward error: ${reward.error}`
        )

        return false

    }

    const lines = [

        'ㅤ۟∩　ׅ　🏆　ׅ　*RESPUESTA CORRECTA*　ׄᰙ',

        '',

        `𖣣ֶㅤ֯⌗ 👤  ׄ ⬭ *@${sender.split('@')[0]}*`,

        `𖣣ֶㅤ֯⌗ ✅  ׄ ⬭ *Respuesta:* ${text}`,

        '',

        `𖣣ֶㅤ֯⌗ ✨  ׄ ⬭ *XP:* +${reward.gainedXp}`,

        `𖣣ֶㅤ֯⌗ 🪙  ׄ ⬭ *Monedas:* +${reward.gainedCoins}`

    ]

    if (
        reward.hasBoost
    ) {

        lines.push(
            '𖣣ֶㅤ֯⌗ 🚀  ׄ ⬭ *XP Boost:* ACTIVO'
        )

    }

    if (
        reward.levelsGained >
        0
    ) {

        lines.push(
            '',
            `𖣣ֶㅤ֯⌗ ⭐  ׄ ⬭ *Level Up:* +${reward.levelsGained}`,
            `𖣣ֶㅤ֯⌗ 🎁  ׄ ⬭ *Premio:* +${reward.levelRewards.toLocaleString()} monedas`,
            `𖣣ֶㅤ֯⌗ 📊  ׄ ⬭ *Nivel actual:* ${reward.currentLevel}`
        )

    }

    lines.push(
        '',
        `╰─ 𓂃 ${getBotName(sock)}`
    )

    await sendMessage(
        sock,
        from,
        {
            text:
                lines.join(
                    '\n'
                ),

            mentions: [
                sender
            ]
        }
    )

    logger.event(
        `${getBotName(sock)} | Trivia winner: ${sender.split('@')[0]} | +${reward.gainedXp} XP | +${reward.gainedCoins} coins`
    )

    return true

}

module.exports = {

    name:
        'trivia',

    aliases: [
        'pregunta',
        'quiz'
    ],

    description:
        'Inicia una pregunta de trivia en el grupo',

    category:
        'diversion',

    groupOnly:
        true,

    async execute({
        sock,
        from
    }) {

        try {

            return await startTrivia({
                sock,
                from
            })

        } catch (err) {

            logger.error(
                `${getBotName(sock)} | Error trivia: ${err.stack || err.message}`
            )

            return await sendMessage(
                sock,
                from,
                {
                    text:
                        ui.error(
                            'ERROR',
                            'No se pudo iniciar la trivia.'
                        )
                }
            )

        }

    },

    checkAnswer:
        checkTriviaAnswer,

    activeGames

}
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

const WIN_XP =
    30

const WIN_COINS =
    20

const RIDDLES = [

    {
        question:
            'Tengo agujas pero no sé coser, tengo números pero no sé leer. ¿Qué soy?',

        answers: [
            'reloj',
            'un reloj'
        ]
    },

    {
        question:
            'Cuanto más le quitas, más grande se vuelve. ¿Qué es?',

        answers: [
            'agujero',
            'un agujero',
            'hoyo',
            'un hoyo'
        ]
    },

    {
        question:
            'Tiene dientes pero no puede morder. ¿Qué es?',

        answers: [
            'peine',
            'un peine'
        ]
    },

    {
        question:
            'Tiene cuello pero no cabeza. ¿Qué es?',

        answers: [
            'botella',
            'una botella'
        ]
    },

    {
        question:
            'Sube llena y baja vacía. ¿Qué es?',

        answers: [
            'cubeta',
            'una cubeta',
            'balde',
            'un balde'
        ]
    },

    {
        question:
            'Tiene hojas pero no es árbol. ¿Qué es?',

        answers: [
            'libro',
            'un libro'
        ]
    },

    {
        question:
            'Mientras más seca, más mojada se pone. ¿Qué es?',

        answers: [
            'toalla',
            'una toalla'
        ]
    },

    {
        question:
            '¿Qué cosa tiene ojos pero no puede ver?',

        answers: [
            'papa',
            'una papa',
            'patata',
            'una patata'
        ]
    },

    {
        question:
            'Tiene patas pero no puede caminar. ¿Qué es?',

        answers: [
            'mesa',
            'una mesa'
        ]
    },

    {
        question:
            'Vuelo sin alas y lloro sin ojos. ¿Qué soy?',

        answers: [
            'nube',
            'una nube'
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
            /[^\p{L}\p{N}\s]/gu,
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

function getRandomRiddle() {

    return RIDDLES[
        Math.floor(
            Math.random() *
            RIDDLES.length
        )
    ]

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

function isCorrectAnswer(
    input,
    answers
) {

    const normalized =
        normalizeText(
            input
        )

    return answers.some(
        answer =>
            normalizeText(
                answer
            ) ===
            normalized
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

async function startGame({
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
                        'ADIVINANZA ACTIVA',
                        'Ya hay una adivinanza activa en este grupo.'
                    )
            }
        )

    }

    const riddle =
        getRandomRiddle()

    activeGames.set(
        gameKey,
        {
            ...riddle,

            startedAt:
                Date.now()
        }
    )

    return await sendMessage(
        sock,
        from,
        {
            text: [
                'ㅤ۟∩　ׅ　🧩　ׅ　*ADIVINANZA*　ׄᰙ',
                '',
                `𖣣ֶㅤ֯⌗ ❓  ׄ ⬭ ${riddle.question}`,
                '',
                `𖣣ֶㅤ֯⌗ ✨  ׄ ⬭ *Premio:* +${WIN_XP} XP`,
                `𖣣ֶㅤ֯⌗ 🪙  ׄ ⬭ *Premio:* +${WIN_COINS} monedas`,
                '',
                '╰─ 𓂃 Escribe la respuesta directamente en el chat'
            ]
                .join(
                    '\n'
                )
        }
    )

}

async function checkAnswer({
    sock,
    msg,
    from
}) {

    try {

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
            !isCorrectAnswer(
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
                    WIN_XP,
                coins:
                    WIN_COINS
            })

        if (
            !reward.success
        ) {

            return false

        }

        const lines = [

            'ㅤ۟∩　ׅ　🏆　ׅ　*¡RESPUESTA CORRECTA!*　ׄᰙ',

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
            `${getBotName(sock)} | Adivinanza | ${sender.split('@')[0]} ganó`
        )

        return true

    } catch (err) {

        logger.error(
            `${getBotName(sock)} | Adivinanza Check Error: ${err.stack || err.message}`
        )

        return false

    }

}

module.exports = {

    name:
        'adivinanza',

    aliases: [
        'riddle',
        'acertijo'
    ],

    description:
        'Inicia una adivinanza en el grupo',

    category:
        'diversion',

    groupOnly:
        true,

    async execute({
        sock,
        from
    }) {

        try {

            return await startGame({
                sock,
                from
            })

        } catch (err) {

            logger.error(
                `${getBotName(sock)} | Error adivinanza: ${err.stack || err.message}`
            )

            return await sendMessage(
                sock,
                from,
                {
                    text:
                        ui.error(
                            'ERROR',
                            'No se pudo iniciar la adivinanza.'
                        )
                }
            )

        }

    },

    checkAnswer,

    activeGames

}
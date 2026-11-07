const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')

const {
    getSenderFromMessage,
    applyGameReward
} = require('../../src/utils/gameRewards')

const activeGames = new Map()

const WIN_XP = 30
const WIN_COINS = 20
const GAME_TIME_MS = 60 * 1000

const CLASSIC_RIDDLES = [
    { question: 'Tengo agujas pero no sé coser, tengo números pero no sé leer. ¿Qué soy?', answers: ['reloj', 'un reloj'] },
    { question: 'Cuanto más le quitas, más grande se vuelve. ¿Qué es?', answers: ['agujero', 'un agujero', 'hoyo', 'un hoyo'] },
    { question: 'Tiene dientes pero no puede morder. ¿Qué es?', answers: ['peine', 'un peine'] },
    { question: 'Tiene cuello pero no cabeza. ¿Qué es?', answers: ['botella', 'una botella'] },
    { question: 'Sube llena y baja vacía. ¿Qué es?', answers: ['cubeta', 'una cubeta', 'balde', 'un balde'] },
    { question: 'Tiene hojas pero no es árbol. ¿Qué es?', answers: ['libro', 'un libro'] },
    { question: 'Mientras más seca, más mojada se pone. ¿Qué es?', answers: ['toalla', 'una toalla'] },
    { question: '¿Qué cosa tiene ojos pero no puede ver?', answers: ['papa', 'una papa', 'patata', 'una patata'] },
    { question: 'Tiene patas pero no puede caminar. ¿Qué es?', answers: ['mesa', 'una mesa'] },
    { question: 'Vuelo sin alas y lloro sin ojos. ¿Qué soy?', answers: ['nube', 'una nube'] },
    { question: 'Tengo llaves pero no abro puertas. ¿Qué soy?', answers: ['piano', 'un piano', 'teclado', 'un teclado'] },
    { question: 'Tengo ciudades sin casas, montañas sin árboles y agua sin peces. ¿Qué soy?', answers: ['mapa', 'un mapa'] },
    { question: 'Cuanto más grande soy, menos se ve. ¿Qué soy?', answers: ['oscuridad', 'la oscuridad'] },
    { question: 'Todos pasan por mí, pero yo nunca me muevo. ¿Qué soy?', answers: ['camino', 'un camino', 'carretera', 'una carretera'] },
    { question: 'Tengo una cara y dos manos, pero no brazos ni piernas. ¿Qué soy?', answers: ['reloj', 'un reloj'] }
]

function normalizeText(text) {
    return String(text || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
}

function getBotName(sock) {
    return String(sock?.botProfile?.name || 'KennyBot').trim()
}

function getProfileId(sock) {
    return String(sock?.botProfile?.id || sock?.botProfileId || 'main')
        .trim()
        .toLowerCase()
}

function buildGameKey(sock, from) {
    return `${getProfileId(sock)}:${from}`
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function getClassicRiddle() {
    return {
        ...CLASSIC_RIDDLES[randomInt(0, CLASSIC_RIDDLES.length - 1)],
        type: 'classic'
    }
}

function generateAdditionRiddle() {
    const answer = randomInt(10, 300)
    const add = randomInt(2, 80)
    const result = answer + add

    return {
        type: 'generated',
        question: `Estoy pensando en un número. Si le sumo ${add}, obtengo ${result}. ¿Qué número es?`,
        answers: [String(answer)]
    }
}

function generateSubtractionRiddle() {
    const answer = randomInt(20, 300)
    const subtract = randomInt(2, Math.min(80, answer - 1))
    const result = answer - subtract

    return {
        type: 'generated',
        question: `Estoy pensando en un número. Si le resto ${subtract}, obtengo ${result}. ¿Qué número es?`,
        answers: [String(answer)]
    }
}

function generateMultiplicationRiddle() {
    const answer = randomInt(2, 50)
    const multiplier = randomInt(2, 12)
    const result = answer * multiplier

    return {
        type: 'generated',
        question: `Pienso en un número. Al multiplicarlo por ${multiplier}, obtengo ${result}. ¿Cuál es?`,
        answers: [String(answer)]
    }
}

function generateMixedRiddle() {
    const answer = randomInt(2, 50)
    const multiplier = randomInt(2, 10)
    const add = randomInt(1, 30)
    const result = answer * multiplier + add

    return {
        type: 'generated',
        question: `Pienso en un número. Lo multiplico por ${multiplier} y después le sumo ${add}. El resultado es ${result}. ¿Cuál era el número?`,
        answers: [String(answer)]
    }
}

function generateSequenceRiddle() {
    const start = randomInt(1, 30)
    const step = randomInt(2, 12)
    const values = [
        start,
        start + step,
        start + step * 2,
        start + step * 3
    ]

    return {
        type: 'generated',
        question: `Completa la secuencia: ${values.join(', ')}, ... ¿qué número sigue?`,
        answers: [String(start + step * 4)]
    }
}

function getRandomRiddle() {
    if (Math.random() < 0.35) {
        return getClassicRiddle()
    }

    const generators = [
        generateAdditionRiddle,
        generateSubtractionRiddle,
        generateMultiplicationRiddle,
        generateMixedRiddle,
        generateSequenceRiddle
    ]

    return generators[randomInt(0, generators.length - 1)]()
}

function getMessageText(msg) {
    return (
        msg?.message?.conversation ||
        msg?.message?.extendedTextMessage?.text ||
        msg?.message?.imageMessage?.caption ||
        msg?.message?.videoMessage?.caption ||
        ''
    )
}

function isCorrectAnswer(input, answers) {
    const normalized = normalizeText(input)
    return answers.some(answer => normalizeText(answer) === normalized)
}

function getMainAnswer(game) {
    return String(game?.answers?.[0] || 'Desconocida')
}

async function sendMessage(sock, jid, content, options = {}) {
    if (typeof sock.safeSendMessage === 'function') {
        return await sock.safeSendMessage(jid, content, options)
    }

    return await sock.sendMessage(jid, content, options)
}

async function expireGame({
    sock,
    from,
    gameKey,
    gameId
}) {
    try {
        const current = activeGames.get(gameKey)

        if (!current || current.id !== gameId) {
            return false
        }

        activeGames.delete(gameKey)

        await sendMessage(
            sock,
            from,
            {
                text: [
                    'ㅤ۟∩　ׅ　⏰　ׅ　*TIEMPO TERMINADO*　ׄᰙ',
                    '',
                    '𖣣ֶㅤ֯⌗ ❌  ׄ ⬭ *Nadie acertó la adivinanza.*',
                    `𖣣ֶㅤ֯⌗ ✅  ׄ ⬭ *Respuesta:* ${getMainAnswer(current)}`,
                    '',
                    '╰─ 𓂃 Usa .adivinanza para iniciar otra ronda'
                ].join('\n')
            }
        )

        logger.event(
            `${getBotName(sock)} | Adivinanza | Tiempo agotado | ${from}`
        )

        return true
    } catch (err) {
        logger.error(
            `${getBotName(sock)} | Adivinanza Timeout Error: ${err.stack || err.message}`
        )

        return false
    }
}

async function startGame({
    sock,
    from
}) {
    const gameKey = buildGameKey(sock, from)

    if (activeGames.has(gameKey)) {
        return await sendMessage(
            sock,
            from,
            {
                text: ui.warn(
                    'ADIVINANZA ACTIVA',
                    'Ya hay una adivinanza activa en este grupo.'
                )
            }
        )
    }

    const riddle = getRandomRiddle()
    const gameId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

    const game = {
        ...riddle,
        id: gameId,
        startedAt: Date.now(),
        timeout: null
    }

    activeGames.set(gameKey, game)

    game.timeout = setTimeout(() => {
        expireGame({
            sock,
            from,
            gameKey,
            gameId
        }).catch(() => {})
    }, GAME_TIME_MS)

    return await sendMessage(
        sock,
        from,
        {
            text: [
                'ㅤ۟∩　ׅ　🧩　ׅ　*ADIVINANZA*　ׄᰙ',
                '',
                `𖣣ֶㅤ֯⌗ ❓  ׄ ⬭ ${riddle.question}`,
                '',
                '𖣣ֶㅤ֯⌗ ⏱️  ׄ ⬭ *Tiempo:* 1 minuto',
                `𖣣ֶㅤ֯⌗ ✨  ׄ ⬭ *Premio:* +${WIN_XP} XP`,
                `𖣣ֶㅤ֯⌗ 🪙  ׄ ⬭ *Premio:* +${WIN_COINS} monedas`,
                '',
                '╰─ 𓂃 Escribe la respuesta directamente en el chat'
            ].join('\n')
        }
    )
}

async function checkAnswer({
    sock,
    msg,
    from
}) {
    try {
        if (!from?.endsWith('@g.us') || msg?.key?.fromMe) {
            return false
        }

        const gameKey = buildGameKey(sock, from)
        const game = activeGames.get(gameKey)

        if (!game) {
            return false
        }

        const text = getMessageText(msg)

        if (!text) {
            return false
        }

        if (/^[./#!]/.test(String(text).trim())) {
            return false
        }

        const sender = getSenderFromMessage(sock, msg)

        if (!sender) {
            return false
        }

        const correct = isCorrectAnswer(text, game.answers)

        if (!correct) {
            await sendMessage(
                sock,
                from,
                {
                    text: [
                        'ㅤ۟∩　ׅ　❌　ׅ　*RESPUESTA INCORRECTA*　ׄᰙ',
                        '',
                        `𖣣ֶㅤ֯⌗ 👤  ׄ ⬭ *@${sender.split('@')[0]}*`,
                        `𖣣ֶㅤ֯⌗ 💬  ׄ ⬭ *Respuesta:* ${text}`,
                        '',
                        '𖣣ֶㅤ֯⌗ 🔄  ׄ ⬭ *Estado:* La adivinanza continúa',
                        '',
                        '╰─ 𓂃 Sigue intentando antes de que termine el minuto'
                    ].join('\n'),
                    mentions: [sender]
                }
            )

            return true
        }

        const reward = applyGameReward({
            sender,
            xp: WIN_XP,
            coins: WIN_COINS
        })

        if (!reward?.success) {
            await sendMessage(
                sock,
                from,
                {
                    text: ui.error(
                        'RESPUESTA CORRECTA',
                        'La respuesta es correcta, pero ocurrió un error al entregar la recompensa. La ronda seguirá activa.'
                    )
                }
            )

            logger.error(
                `${getBotName(sock)} | Adivinanza | Reward falló para ${sender} | ${reward?.error || 'UNKNOWN'}`
            )

            return true
        }

        if (game.timeout) {
            clearTimeout(game.timeout)
        }

        activeGames.delete(gameKey)

        const lines = [
            'ㅤ۟∩　ׅ　🏆　ׅ　*¡RESPUESTA CORRECTA!*　ׄᰙ',
            '',
            `𖣣ֶㅤ֯⌗ 👤  ׄ ⬭ *@${sender.split('@')[0]}*`,
            `𖣣ֶㅤ֯⌗ ✅  ׄ ⬭ *Respuesta:* ${text}`,
            '',
            `𖣣ֶㅤ֯⌗ ✨  ׄ ⬭ *XP:* +${reward.gainedXp}`,
            `𖣣ֶㅤ֯⌗ 🪙  ׄ ⬭ *Monedas:* +${reward.gainedCoins}`
        ]

        if (reward.hasBoost) {
            lines.push(
                '𖣣ֶㅤ֯⌗ 🚀  ׄ ⬭ *XP Boost:* ACTIVO'
            )
        }

        if (reward.levelsGained > 0) {
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
                text: lines.join('\n'),
                mentions: [sender]
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
    name: 'adivinanza',
    aliases: ['riddle', 'acertijo'],
    description: 'Inicia una adivinanza de 1 minuto en el grupo',
    category: 'diversion',
    groupOnly: true,

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
                    text: ui.error(
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
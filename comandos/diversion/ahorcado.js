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

const MAX_ERRORS =
    7

const WIN_XP =
    45

const WIN_COINS =
    30

const WORDS = [

    {
        word:
            'javascript',

        hint:
            'Lenguaje muy usado para desarrollo web'
    },

    {
        word:
            'whatsapp',

        hint:
            'Aplicación de mensajería'
    },

    {
        word:
            'instagram',

        hint:
            'Red social de Meta'
    },

    {
        word:
            'computadora',

        hint:
            'Dispositivo electrónico'
    },

    {
        word:
            'programacion',

        hint:
            'Actividad relacionada con escribir código'
    },

    {
        word:
            'videojuego',

        hint:
            'Entretenimiento digital interactivo'
    },

    {
        word:
            'internet',

        hint:
            'Red mundial de comunicación'
    },

    {
        word:
            'sinaloa',

        hint:
            'Estado de México'
    },

    {
        word:
            'mexico',

        hint:
            'País de Norteamérica'
    },

    {
        word:
            'futbol',

        hint:
            'Deporte con un balón'
    },

    {
        word:
            'musica',

        hint:
            'Arte formado por sonidos'
    },

    {
        word:
            'robot',

        hint:
            'Máquina programable'
    },

    {
        word:
            'servidor',

        hint:
            'Equipo o sistema que presta servicios en una red'
    },

    {
        word:
            'android',

        hint:
            'Sistema operativo móvil'
    },

    {
        word:
            'windows',

        hint:
            'Sistema operativo de Microsoft'
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
            /[^a-zñ]/g,
            ''
        )

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

function randomWord() {

    return WORDS[
        Math.floor(
            Math.random() *
            WORDS.length
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

function getVisibleWord(
    word,
    guessedLetters
) {

    return word
        .split(
            ''
        )
        .map(
            letter => {

                if (
                    guessedLetters.has(
                        letter
                    )
                ) {

                    return letter.toUpperCase()

                }

                return '_'

            }
        )
        .join(
            ' '
        )

}

function isWordCompleted(
    word,
    guessedLetters
) {

    return word
        .split(
            ''
        )
        .every(
            letter =>
                guessedLetters.has(
                    letter
                )
        )

}

function getUsedLetters(
    game
) {

    const letters =
        [
            ...game.guessedLetters
        ]
            .sort()

    if (
        letters.length ===
        0
    ) {

        return 'Ninguna'

    }

    return letters
        .map(
            letter =>
                letter.toUpperCase()
        )
        .join(
            ', '
        )

}

function getHangman(
    errors
) {

    const stages = [

        [
            ' ┌─────┐',
            ' │',
            ' │',
            ' │',
            ' │',
            '─┴─'
        ],

        [
            ' ┌─────┐',
            ' │     O',
            ' │',
            ' │',
            ' │',
            '─┴─'
        ],

        [
            ' ┌─────┐',
            ' │     O',
            ' │     │',
            ' │',
            ' │',
            '─┴─'
        ],

        [
            ' ┌─────┐',
            ' │     O',
            ' │    /│',
            ' │',
            ' │',
            '─┴─'
        ],

        [
            ' ┌─────┐',
            ' │     O',
            ' │    /│\\',
            ' │',
            ' │',
            '─┴─'
        ],

        [
            ' ┌─────┐',
            ' │     O',
            ' │    /│\\',
            ' │    /',
            ' │',
            '─┴─'
        ],

        [
            ' ┌─────┐',
            ' │     O',
            ' │    /│\\',
            ' │    / \\',
            ' │',
            '─┴─'
        ],

        [
            ' ┌─────┐',
            ' │     💀',
            ' │    /│\\',
            ' │    / \\',
            ' │',
            '─┴─'
        ]

    ]

    return stages[
        Math.min(
            errors,
            stages.length - 1
        )
    ]
        .join(
            '\n'
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

async function sendBoard(
    sock,
    from,
    game,
    title = 'AHORCADO'
) {

    const visibleWord =
        getVisibleWord(
            game.word,
            game.guessedLetters
        )

    const remaining =
        MAX_ERRORS -
        game.errors

    return await sendMessage(
        sock,
        from,
        {
            text: [
                `ㅤ۟∩　ׅ　🎯　ׅ　*${title}*　ׄᰙ`,
                '',
                '```',
                getHangman(
                    game.errors
                ),
                '```',
                '',
                `𖣣ֶㅤ֯⌗ 🔤  ׄ ⬭ *Palabra:* ${visibleWord}`,
                '',
                `𖣣ֶㅤ֯⌗ 💡  ׄ ⬭ *Pista:* ${game.hint}`,
                `𖣣ֶㅤ֯⌗ ❤️  ׄ ⬭ *Intentos:* ${remaining}`,
                `𖣣ֶㅤ֯⌗ 📝  ׄ ⬭ *Letras usadas:* ${getUsedLetters(game)}`,
                '',
                '╰─ 𓂃 Envía una letra o intenta escribir la palabra completa'
            ]
                .join(
                    '\n'
                )
        }
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
                        'AHORCADO ACTIVO',
                        'Ya existe una partida de ahorcado en este grupo.'
                    )
            }
        )

    }

    const selected =
        randomWord()

    const word =
        normalizeText(
            selected.word
        )

    const game = {

        word,

        hint:
            selected.hint,

        guessedLetters:
            new Set(),

        errors:
            0,

        attempts:
            0,

        startedAt:
            Date.now()

    }

    activeGames.set(
        gameKey,
        game
    )

    logger.event(
        `${getBotName(sock)} | Ahorcado iniciado | ${from}`
    )

    return await sendBoard(
        sock,
        from,
        game
    )

}

async function winGame({
    sock,
    msg,
    from,
    game,
    gameKey
}) {

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

        logger.error(
            `${getBotName(sock)} | Ahorcado reward error: ${reward.error}`
        )

        return false

    }

    const lines = [

        'ㅤ۟∩　ׅ　🏆　ׅ　*¡AHORCADO COMPLETADO!*　ׄᰙ',

        '',

        `𖣣ֶㅤ֯⌗ 👤  ׄ ⬭ *@${sender.split('@')[0]}*`,

        `𖣣ֶㅤ֯⌗ 🔤  ׄ ⬭ *Palabra:* ${game.word.toUpperCase()}`,

        `𖣣ֶㅤ֯⌗ 🎯  ׄ ⬭ *Intentos:* ${game.attempts}`,

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
        `${getBotName(sock)} | Ahorcado | ${sender.split('@')[0]} ganó | ${game.word}`
    )

    return true

}

async function checkAnswer({
    sock,
    msg,
    from
}) {

    try {

        if (
            !from ||
            !from.endsWith(
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

        const rawText =
            getMessageText(
                msg
            )

        const text =
            normalizeText(
                rawText
            )

        if (
            !text
        ) {

            return false

        }

        if (
            text.length >
            game.word.length &&
            text.length >
            20
        ) {

            return false

        }

        game.attempts++
        
        if (
            text.length >
            1
        ) {

            if (
                text ===
                game.word
            ) {

                for (
                    const letter
                    of game.word
                ) {

                    game.guessedLetters.add(
                        letter
                    )

                }

                return await winGame({
                    sock,
                    msg,
                    from,
                    game,
                    gameKey
                })

            }

            game.errors++

            if (
                game.errors >=
                MAX_ERRORS
            ) {

                activeGames.delete(
                    gameKey
                )

                await sendMessage(
                    sock,
                    from,
                    {
                        text: [
                            'ㅤ۟∩　ׅ　💀　ׅ　*FIN DEL JUEGO*　ׄᰙ',
                            '',
                            '```',
                            getHangman(
                                MAX_ERRORS
                            ),
                            '```',
                            '',
                            `𖣣ֶㅤ֯⌗ 🔤  ׄ ⬭ *La palabra era:* ${game.word.toUpperCase()}`,
                            '',
                            '╰─ 𓂃 Nadie logró completar el ahorcado'
                        ]
                            .join(
                                '\n'
                            )
                    }
                )

                return true

            }

            await sendMessage(
                sock,
                from,
                {
                    text: [
                        'ㅤ۟∩　ׅ　❌　ׅ　*PALABRA INCORRECTA*　ׄᰙ',
                        '',
                        `𖣣ֶㅤ֯⌗ ❤️  ׄ ⬭ *Intentos restantes:* ${MAX_ERRORS - game.errors}`,
                        '',
                        '╰─ 𓂃 Sigue intentando'
                    ]
                        .join(
                            '\n'
                        )
                }
            )

            return true

        }

        const letter =
            text

        if (
            game.guessedLetters.has(
                letter
            )
        ) {

            await sendMessage(
                sock,
                from,
                {
                    text:
                        ui.info(
                            'LETRA REPETIDA',
                            `La letra "${letter.toUpperCase()}" ya fue utilizada.`
                        )
                }
            )

            return true

        }

        game.guessedLetters.add(
            letter
        )

        if (
            game.word.includes(
                letter
            )
        ) {

            if (
                isWordCompleted(
                    game.word,
                    game.guessedLetters
                )
            ) {

                return await winGame({
                    sock,
                    msg,
                    from,
                    game,
                    gameKey
                })

            }

            await sendBoard(
                sock,
                from,
                game,
                '¡LETRA CORRECTA!'
            )

            return true

        }

        game.errors++

        if (
            game.errors >=
            MAX_ERRORS
        ) {

            activeGames.delete(
                gameKey
            )

            await sendMessage(
                sock,
                from,
                {
                    text: [
                        'ㅤ۟∩　ׅ　💀　ׅ　*FIN DEL JUEGO*　ׄᰙ',
                        '',
                        '```',
                        getHangman(
                            MAX_ERRORS
                        ),
                        '```',
                        '',
                        `𖣣ֶㅤ֯⌗ 🔤  ׄ ⬭ *La palabra era:* ${game.word.toUpperCase()}`,
                        '',
                        '╰─ 𓂃 Se acabaron los intentos'
                    ]
                        .join(
                            '\n'
                        )
                }
            )

            return true

        }

        await sendBoard(
            sock,
            from,
            game,
            'LETRA INCORRECTA'
        )

        return true

    } catch (err) {

        logger.error(
            `${getBotName(sock)} | Ahorcado Check Error: ${err.stack || err.message}`
        )

        return false

    }

}

module.exports = {

    name:
        'ahorcado',

    aliases: [
        'hangman'
    ],

    description:
        'Inicia una partida de ahorcado',

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
                `${getBotName(sock)} | Error ahorcado: ${err.stack || err.message}`
            )

            return await sendMessage(
                sock,
                from,
                {
                    text:
                        ui.error(
                            'ERROR',
                            'No se pudo iniciar el ahorcado.'
                        )
                }
            )

        }

    },

    checkAnswer,

    activeGames

}
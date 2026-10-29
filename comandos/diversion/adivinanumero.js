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

const DEFAULT_MIN =
    1

const DEFAULT_MAX =
    100

const MIN_ALLOWED =
    0

const MAX_ALLOWED =
    100000

const WIN_XP =
    35

const WIN_COINS =
    25

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

function randomNumber(
    min,
    max
) {

    return Math.floor(
        Math.random() *
        (
            max -
            min +
            1
        )
    ) +
    min

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

function parseRange(
    args
) {

    if (
        !Array.isArray(
            args
        ) ||
        args.length ===
        0
    ) {

        return {

            success:
                true,

            min:
                DEFAULT_MIN,

            max:
                DEFAULT_MAX

        }

    }

    if (
        args.length ===
        1
    ) {

        const max =
            Number(
                args[0]
            )

        if (
            !Number.isInteger(
                max
            )
        ) {

            return {
                success:
                    false
            }

        }

        return {

            success:
                true,

            min:
                DEFAULT_MIN,

            max

        }

    }

    const min =
        Number(
            args[0]
        )

    const max =
        Number(
            args[1]
        )

    if (
        !Number.isInteger(
            min
        ) ||
        !Number.isInteger(
            max
        )
    ) {

        return {
            success:
                false
        }

    }

    return {

        success:
            true,

        min,

        max

    }

}

function validateRange(
    min,
    max
) {

    if (
        min <
        MIN_ALLOWED
    ) {

        return {
            success:
                false,

            message:
                `El número mínimo permitido es ${MIN_ALLOWED}.`
        }

    }

    if (
        max >
        MAX_ALLOWED
    ) {

        return {
            success:
                false,

            message:
                `El número máximo permitido es ${MAX_ALLOWED.toLocaleString()}.`
        }

    }

    if (
        min >=
        max
    ) {

        return {
            success:
                false,

            message:
                'El número mínimo debe ser menor que el máximo.'
        }

    }

    if (
        max -
        min <
        2
    ) {

        return {
            success:
                false,

            message:
                'El rango debe contener al menos 3 números.'
        }

    }

    return {
        success:
            true
    }

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
    from,
    args,
    prefix = '.'
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
                        'PARTIDA ACTIVA',
                        [
                            'Ya hay una partida de adivinar número activa en este grupo.',
                            '',
                            'Los participantes deben seguir intentando hasta que alguien acierte.'
                        ]
                            .join(
                                '\n'
                            )
                    )
            }
        )

    }

    const range =
        parseRange(
            args
        )

    if (
        !range.success
    ) {

        return await sendMessage(
            sock,
            from,
            {
                text:
                    ui.warn(
                        'RANGO INVÁLIDO',
                        [
                            'Usa números enteros.',
                            '',
                            `Ejemplos:`,
                            `${prefix}adivinanumero`,
                            `${prefix}adivinanumero 50`,
                            `${prefix}adivinanumero 10 500`
                        ]
                            .join(
                                '\n'
                            )
                    )
            }
        )

    }

    const validation =
        validateRange(
            range.min,
            range.max
        )

    if (
        !validation.success
    ) {

        return await sendMessage(
            sock,
            from,
            {
                text:
                    ui.warn(
                        'RANGO INVÁLIDO',
                        validation.message
                    )
            }
        )

    }

    const target =
        randomNumber(
            range.min,
            range.max
        )

    activeGames.set(
        gameKey,
        {
            target,

            min:
                range.min,

            max:
                range.max,

            attempts:
                0,

            startedAt:
                Date.now()
        }
    )

    const botName =
        getBotName(
            sock
        )

    logger.event(
        `${botName} | AdivinaNumero iniciado | ${from} | ${range.min}-${range.max}`
    )

    return await sendMessage(
        sock,
        from,
        {
            text: [
                'ㅤ۟∩　ׅ　🔢　ׅ　*ADIVINA EL NÚMERO*　ׄᰙ',
                '',
                `𖣣ֶㅤ֯⌗ 🎯  ׄ ⬭ He elegido un número entre *${range.min}* y *${range.max}*.`,
                '',
                '𖣣ֶㅤ֯⌗ 💬  ׄ ⬭ Escribe tu número directamente en el chat.',
                '',
                `𖣣ֶㅤ֯⌗ ✨  ׄ ⬭ *Premio:* +${WIN_XP} XP`,
                `𖣣ֶㅤ֯⌗ 🪙  ׄ ⬭ *Premio:* +${WIN_COINS} monedas`,
                '',
                '╰─ 𓂃 Te diré si debes subir o bajar'
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

        const text =
            getMessageText(
                msg
            )
                .trim()

        if (
            !/^-?\d+$/.test(
                text
            )
        ) {

            return false

        }

        const guess =
            Number(
                text
            )

        if (
            !Number.isSafeInteger(
                guess
            )
        ) {

            return false

        }

        if (
            guess <
                game.min ||
            guess >
                game.max
        ) {

            return false

        }

        game.attempts +=
            1

        if (
            guess <
            game.target
        ) {

            await sendMessage(
                sock,
                from,
                {
                    text: [
                        'ㅤ۟∩　ׅ　📈　ׅ　*MÁS ALTO*　ׄᰙ',
                        '',
                        `𖣣ֶㅤ֯⌗ 🔢  ׄ ⬭ *${guess}* es demasiado bajo.`,
                        '',
                        '╰─ 𓂃 Intenta con un número mayor'
                    ]
                        .join(
                            '\n'
                        )
                }
            )

            return true

        }

        if (
            guess >
            game.target
        ) {

            await sendMessage(
                sock,
                from,
                {
                    text: [
                        'ㅤ۟∩　ׅ　📉　ׅ　*MÁS BAJO*　ׄᰙ',
                        '',
                        `𖣣ֶㅤ֯⌗ 🔢  ׄ ⬭ *${guess}* es demasiado alto.`,
                        '',
                        '╰─ 𓂃 Intenta con un número menor'
                    ]
                        .join(
                            '\n'
                        )
                }
            )

            return true

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

            logger.error(
                `${getBotName(sock)} | AdivinaNumero reward error: ${reward.error}`
            )

            return false

        }

        const lines = [

            'ㅤ۟∩　ׅ　🏆　ׅ　*¡NÚMERO CORRECTO!*　ׄᰙ',

            '',

            `𖣣ֶㅤ֯⌗ 👤  ׄ ⬭ *@${sender.split('@')[0]}*`,

            `𖣣ֶㅤ֯⌗ 🎯  ׄ ⬭ *Número:* ${game.target}`,

            `𖣣ֶㅤ֯⌗ 🔢  ׄ ⬭ *Intentos del grupo:* ${game.attempts}`,

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
            `${getBotName(sock)} | AdivinaNumero | ${sender.split('@')[0]} ganó | Número ${game.target} | ${game.attempts} intentos`
        )

        return true

    } catch (err) {

        logger.error(
            `${getBotName(sock)} | AdivinaNumero Check Error: ${err.stack || err.message}`
        )

        return false

    }

}

module.exports = {

    name:
        'adivinanumero',

    aliases: [
        'adivina',
        'guessnumber',
        'numero'
    ],

    description:
        'Inicia un juego para adivinar un número',

    category:
        'diversion',

    groupOnly:
        true,

    async execute({
        sock,
        from,
        args,
        prefix = '.'
    }) {

        try {

            return await startGame({
                sock,
                from,
                args,
                prefix
            })

        } catch (err) {

            logger.error(
                `${getBotName(sock)} | Error adivinanumero: ${err.stack || err.message}`
            )

            return await sendMessage(
                sock,
                from,
                {
                    text:
                        ui.error(
                            'ERROR',
                            'No se pudo iniciar el juego.'
                        )
                }
            )

        }

    },

    checkAnswer,

    activeGames

}
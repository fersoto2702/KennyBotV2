const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const {
    getSenderFromMessage,
    applyGameReward
} = require('../../src/utils/gameRewards')

function getBotName(
    sock
) {

    return String(
        sock?.botProfile?.name ||
        'KennyBot'
    )
        .trim()

}

function rollDice(
    sides = 6
) {

    return Math.floor(
        Math.random() *
        sides
    ) + 1

}

function getDiceEmoji(
    value
) {

    const emojis = {

        1:
            '⚀',

        2:
            '⚁',

        3:
            '⚂',

        4:
            '⚃',

        5:
            '⚄',

        6:
            '⚅'

    }

    return (
        emojis[value] ||
        '🎲'
    )

}

function getReward(
    result,
    sides
) {

    const percentage =
        result /
        sides

    if (
        percentage ===
        1
    ) {

        return {

            tier:
                'JACKPOT',

            emoji:
                '👑',

            xp:
                25,

            coins:
                20

        }

    }

    if (
        percentage >=
        0.8
    ) {

        return {

            tier:
                'EXCELENTE',

            emoji:
                '🔥',

            xp:
                18,

            coins:
                12

        }

    }

    if (
        percentage >=
        0.5
    ) {

        return {

            tier:
                'BUENO',

            emoji:
                '✨',

            xp:
                12,

            coins:
                7

        }

    }

    return {

        tier:
            'SUERTE BAJA',

        emoji:
            '😅',

        xp:
            5,

        coins:
            2

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

module.exports = {

    name:
        'dado',

    aliases: [
        'dice',
        'tirardado'
    ],

    description:
        'Lanza un dado y gana XP y monedas',

    category:
        'diversion',

    async execute({
        sock,
        from,
        msg,
        args
    }) {

        try {

            let sides =
                6

            if (
                Array.isArray(
                    args
                ) &&
                args[0]
            ) {

                const parsed =
                    Number(
                        args[0]
                    )

                if (
                    !Number.isInteger(
                        parsed
                    ) ||
                    parsed < 2 ||
                    parsed > 100
                ) {

                    return await sendMessage(
                        sock,
                        from,
                        {
                            text:
                                ui.warn(
                                    'DADO INVÁLIDO',
                                    'El número de caras debe estar entre 2 y 100.'
                                )
                        }
                    )

                }

                sides =
                    parsed

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

            const result =
                rollDice(
                    sides
                )

            const rewardData =
                getReward(
                    result,
                    sides
                )

            const reward =
                applyGameReward({
                    sender,
                    xp:
                        rewardData.xp,
                    coins:
                        rewardData.coins
                })

            if (
                !reward.success
            ) {

                throw new Error(
                    `No se pudo aplicar recompensa: ${reward.error}`
                )

            }

            const botName =
                getBotName(
                    sock
                )

            const diceEmoji =
                sides === 6
                    ? getDiceEmoji(
                        result
                    )
                    : '🎲'

            const rewardLines = [

                `𖣣ֶㅤ֯⌗ ${rewardData.emoji}  ׄ ⬭ *Resultado:* ${rewardData.tier}`,

                '',

                `𖣣ֶㅤ֯⌗ ✨  ׄ ⬭ *XP:* +${reward.gainedXp}`,

                `𖣣ֶㅤ֯⌗ 🪙  ׄ ⬭ *Monedas:* +${reward.gainedCoins}`

            ]

            if (
                reward.hasBoost
            ) {

                rewardLines.push(
                    '𖣣ֶㅤ֯⌗ 🚀  ׄ ⬭ *XP Boost:* ACTIVO'
                )

            }

            if (
                reward.levelsGained >
                0
            ) {

                rewardLines.push(
                    '',
                    `𖣣ֶㅤ֯⌗ ⭐  ׄ ⬭ *Level Up:* +${reward.levelsGained}`,
                    `𖣣ֶㅤ֯⌗ 🎁  ׄ ⬭ *Premio:* +${reward.levelRewards.toLocaleString()} monedas`,
                    `𖣣ֶㅤ֯⌗ 📊  ׄ ⬭ *Nivel actual:* ${reward.currentLevel}`
                )

            }

            const message = [

                'ㅤ۟∩　ׅ　🎲　ׅ　*DADO*　ׄᰙ',

                '',

                `𖣣ֶㅤ֯⌗ 🎯  ׄ ⬭ *Resultado:* ${diceEmoji} ${result}`,

                `𖣣ֶㅤ֯⌗ 🔢  ׄ ⬭ *Caras:* ${sides}`,

                '',

                ...rewardLines,

                '',

                `╰─ 𓂃 Lanzado por ${botName}`

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
                `${botName} | Dado d${sides} | ${sender.split('@')[0]} | ${result} | +${reward.gainedXp} XP | +${reward.gainedCoins} coins`
            )

            return true

        } catch (err) {

            logger.error(
                `${getBotName(sock)} | Error dado: ${err.stack || err.message}`
            )

            try {

                await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.error(
                                'ERROR',
                                'No se pudo lanzar el dado.'
                            )
                    }
                )

            } catch {}

            return false

        }

    }

}
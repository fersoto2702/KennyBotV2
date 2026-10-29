const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const {
    getSenderFromMessage,
    applyGameReward
} = require('../../src/utils/gameRewards')

const OPTIONS = {

    piedra: {
        emoji:
            '🪨',

        name:
            'Piedra'
    },

    papel: {
        emoji:
            '📄',

        name:
            'Papel'
    },

    tijera: {
        emoji:
            '✂️',

        name:
            'Tijera'
    }

}

const ALIASES = {

    rock:
        'piedra',

    piedra:
        'piedra',

    paper:
        'papel',

    papel:
        'papel',

    scissors:
        'tijera',

    tijera:
        'tijera',

    tijeras:
        'tijera'

}

const REWARDS = {

    GANASTE: {
        xp:
            20,

        coins:
            15
    },

    EMPATE: {
        xp:
            8,

        coins:
            5
    },

    PERDISTE: {
        xp:
            3,

        coins:
            0
    }

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

function normalizeOption(
    value
) {

    const option =
        String(
            value ||
            ''
        )
            .trim()
            .toLowerCase()

    return (
        ALIASES[
            option
        ] ||
        null
    )

}

function randomOption() {

    const keys =
        Object.keys(
            OPTIONS
        )

    return keys[
        Math.floor(
            Math.random() *
            keys.length
        )
    ]

}

function getResult(
    player,
    bot
) {

    if (
        player ===
        bot
    ) {

        return {
            result:
                'EMPATE',

            emoji:
                '🤝'
        }

    }

    const winsAgainst = {

        piedra:
            'tijera',

        papel:
            'piedra',

        tijera:
            'papel'

    }

    if (
        winsAgainst[
            player
        ] ===
        bot
    ) {

        return {
            result:
                'GANASTE',

            emoji:
                '🏆'
        }

    }

    return {
        result:
            'PERDISTE',

        emoji:
            '💀'
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
        'ppt',

    aliases: [
        'piedrapapeltijera',
        'rps'
    ],

    description:
        'Juega piedra, papel o tijera contra el bot',

    category:
        'diversion',

    async execute({
        sock,
        from,
        msg,
        args,
        prefix = '.'
    }) {

        try {

            const player =
                normalizeOption(
                    Array.isArray(
                        args
                    )
                        ? args[0]
                        : null
                )

            if (
                !player
            ) {

                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.info(
                                'PIEDRA PAPEL O TIJERA',
                                [
                                    'Elige una opción:',
                                    '',
                                    `• ${prefix}ppt piedra`,
                                    `• ${prefix}ppt papel`,
                                    `• ${prefix}ppt tijera`,
                                    '',
                                    'Premios:',
                                    '🏆 Ganar: +20 XP / +15 monedas',
                                    '🤝 Empatar: +8 XP / +5 monedas',
                                    '💀 Perder: +3 XP'
                                ]
                                    .join(
                                        '\n'
                                    )
                            )
                    }
                )

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

            const botChoice =
                randomOption()

            const playerData =
                OPTIONS[
                    player
                ]

            const botData =
                OPTIONS[
                    botChoice
                ]

            const outcome =
                getResult(
                    player,
                    botChoice
                )

            const baseReward =
                REWARDS[
                    outcome.result
                ]

            const reward =
                applyGameReward({
                    sender,
                    xp:
                        baseReward.xp,
                    coins:
                        baseReward.coins
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

            const rewardLines = [

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

                'ㅤ۟∩　ׅ　🎮　ׅ　*PIEDRA PAPEL O TIJERA*　ׄᰙ',

                '',

                `𖣣ֶㅤ֯⌗ 👤  ׄ ⬭ *Tú:* ${playerData.emoji} ${playerData.name}`,

                `𖣣ֶㅤ֯⌗ 🤖  ׄ ⬭ *${botName}:* ${botData.emoji} ${botData.name}`,

                '',

                `𖣣ֶㅤ֯⌗ ${outcome.emoji}  ׄ ⬭ *Resultado:* ${outcome.result}`,

                '',

                ...rewardLines,

                '',

                `╰─ 𓂃 Usa ${prefix}ppt para volver a jugar`

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
                `${botName} | PPT | ${sender.split('@')[0]} | ${player} vs ${botChoice} | ${outcome.result} | +${reward.gainedXp} XP | +${reward.gainedCoins} coins`
            )

            return true

        } catch (err) {

            logger.error(
                `${getBotName(sock)} | Error ppt: ${err.stack || err.message}`
            )

            try {

                await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.error(
                                'ERROR',
                                'No se pudo jugar piedra, papel o tijera.'
                            )
                    }
                )

            } catch {}

            return false

        }

    }

}
const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


const economyPath =
    path.join(
        __dirname,
        '../../database/economy.json'
    )


const EMOJIS = [
    '🍎',
    '🍌',
    '🍇',
    '💎',
    '7️⃣',
    '🍒'
]


function spin() {

    return EMOJIS[
        Math.floor(
            Math.random() *
            EMOJIS.length
        )
    ]

}


function ensureEconomyFile() {

    const directory =
        path.dirname(
            economyPath
        )


    if (
        !fs.existsSync(
            directory
        )
    ) {

        fs.mkdirSync(
            directory,
            {
                recursive: true
            }
        )

    }


    if (
        !fs.existsSync(
            economyPath
        )
    ) {

        fs.writeFileSync(
            economyPath,
            JSON.stringify(
                {},
                null,
                2
            ),
            'utf8'
        )

    }

}


function readEconomy() {

    ensureEconomyFile()


    try {

        const data =
            JSON.parse(
                fs.readFileSync(
                    economyPath,
                    'utf8'
                )
            )


        return (
            data &&
            typeof data === 'object' &&
            !Array.isArray(data)
        )
            ? data
            : {}

    } catch (err) {

        logger.error(
            `Error leyendo economy.json: ${err.message}`
        )

        return {}

    }

}


function saveEconomy(data) {

    fs.writeFileSync(
        economyPath,
        JSON.stringify(
            data,
            null,
            2
        ),
        'utf8'
    )

}


function normalizeUser(
    economy,
    jid
) {

    if (
        !economy[jid] ||
        typeof economy[jid] !== 'object'
    ) {

        economy[jid] = {
            coins: 0,
            bank: 0
        }

    }


    if (
        !Number.isFinite(
            Number(
                economy[jid].coins
            )
        )
    ) {

        economy[jid].coins =
            0

    }


    if (
        !Number.isFinite(
            Number(
                economy[jid].bank
            )
        )
    ) {

        economy[jid].bank =
            0

    }


    economy[jid].coins =
        Math.max(
            0,
            Number(
                economy[jid].coins
            )
        )


    economy[jid].bank =
        Math.max(
            0,
            Number(
                economy[jid].bank
            )
        )

}


function formatMoney(value) {

    return Number(
        value || 0
    )
        .toLocaleString(
            'es-MX'
        )

}


module.exports = {

    name:
        'slots',

    aliases: [
        'slot',
        'tragamonedas'
    ],

    description:
        'Juega a las tragamonedas',

    category:
        'economia',
async execute({

        sock,
        from,
        msg,
        args

    }) {

        try {

            /* ─────────────────────────────
               USUARIO
            ───────────────────────────── */

            const sender =

                msg.key.participant ||

                msg.participant ||

                msg.key.remoteJid


            if (!sender) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE USUARIO',

                                'No se pudo identificar tu cuenta.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               ECONOMÍA
            ───────────────────────────── */

            const economy =
                readEconomy()


            normalizeUser(
                economy,
                sender
            )


            /* ─────────────────────────────
               APUESTA
            ───────────────────────────── */

            const input =
                String(
                    args?.[0] || ''
                )
                    .trim()
                    .toLowerCase()


            let bet


            if (
                input === 'all' ||
                input === 'todo'
            ) {

                bet =
                    economy[sender].coins

            } else {

                bet =
                    Number.parseInt(
                        input,
                        10
                    )

            }


            if (
                !Number.isFinite(bet) ||
                bet <= 0
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'APUESTA INVÁLIDA',

                                'Usa /slots cantidad o /slots all.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               FONDOS
            ───────────────────────────── */

            if (
                economy[sender].coins <
                bet
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'FONDOS INSUFICIENTES',

                                `Solo tienes 🪙 ${formatMoney(economy[sender].coins)} disponibles.`

                            )

                    }

                )

            }


            /* ─────────────────────────────
               COBRAR APUESTA
            ───────────────────────────── */

            economy[sender].coins -=
                bet


            /* ─────────────────────────────
               GIRAR
            ───────────────────────────── */

            const a =
                spin()

            const b =
                spin()

            const c =
                spin()


            /* ─────────────────────────────
               PREMIO
            ───────────────────────────── */

            let reward =
                0

            let resultType =
                'loss'


            if (
                a === b &&
                b === c
            ) {

                reward =
                    bet * 5

                resultType =
                    'jackpot'

            }

            else if (
                a === b ||
                b === c ||
                a === c
            ) {

                reward =
                    bet * 2

                resultType =
                    'win'

            }


            /* ─────────────────────────────
               GANANCIA
            ───────────────────────────── */

            if (
                reward > 0
            ) {

                economy[sender].coins +=
                    reward


                saveEconomy(
                    economy
                )


                const netGain =
                    reward -
                    bet


                const title =

                    resultType === 'jackpot'

                        ? '🎰 JACKPOT'

                        : '🎰 SLOTS · GANASTE'


                const rarity =

                    resultType === 'jackpot'

                        ? '🌟 TRIPLE'

                        : '🟢 DOBLE'


                logger.event(

                    `Slots: ${sender.split('@')[0]} +${netGain} | ${a} ${b} ${c}`

                )


                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.success(

                                title,

                                [

                                    [
                                        'Usuario',
                                        `@${sender.split('@')[0]}`
                                    ],

                                    [
                                        'Resultado',
                                        `${a} ${b} ${c}`
                                    ],

                                    [
                                        'Apuesta',
                                        `🪙 ${formatMoney(bet)}`
                                    ],

                                    [
                                        'Premio',
                                        `🪙 ${formatMoney(reward)}`
                                    ],

                                    [
                                        'Ganancia neta',
                                        `🪙 +${formatMoney(netGain)}`
                                    ],

                                    [
                                        'Combinación',
                                        rarity
                                    ],

                                    [
                                        'Wallet',
                                        `🪙 ${formatMoney(economy[sender].coins)}`
                                    ]

                                ],

                                resultType === 'jackpot'

                                    ? '¡Conseguiste tres símbolos iguales!'

                                    : 'Conseguiste dos símbolos iguales.'

                            ),

                        mentions: [
                            sender
                        ]

                    }

                )

            }


            /* ─────────────────────────────
               DERROTA
            ───────────────────────────── */

            saveEconomy(
                economy
            )


            logger.event(

                `Slots: ${sender.split('@')[0]} -${bet} | ${a} ${b} ${c}`

            )


            return await sock.sendMessage(

                from,

                {

                    text:
                        ui.error(

                            '🎰 SLOTS · PERDISTE',

                            [
                                `𖣣ֶㅤ֯⌗ 🎰  ׄ ⬭ *Resultado:* ${a} ${b} ${c}`,
                                `𖣣ֶㅤ֯⌗ 🎲  ׄ ⬭ *Apuesta:* 🪙 ${formatMoney(bet)}`,
                                `𖣣ֶㅤ֯⌗ 💸  ׄ ⬭ *Pérdida:* 🪙 -${formatMoney(bet)}`,
                                `𖣣ֶㅤ֯⌗ 🪙  ׄ ⬭ *Wallet:* ${formatMoney(economy[sender].coins)}`,
                                '',
                                '╰─ 𓂃 No salió ninguna combinación ganadora.'
                            ].join('\n')

                        ),

                    mentions: [
                        sender
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error slots: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE SLOTS',

                                'No se pudo completar la jugada.'

                            )

                    }

                )

            } catch {}

        }

    }

}
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
        'gamble',

    aliases: [
        'bet',
        'apostar'
    ],

    description:
        'Apuesta tus monedas al azar',

    category:
        'economia',

    cooldown:
        10,


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


            if (
                !economy[sender] ||
                typeof economy[sender] !== 'object'
            ) {

                economy[sender] = {
                    coins: 0,
                    bank: 0
                }

            }


            if (
                !Number.isFinite(
                    Number(
                        economy[sender].coins
                    )
                )
            ) {

                economy[sender].coins =
                    0

            }


            if (
                !Number.isFinite(
                    Number(
                        economy[sender].bank
                    )
                )
            ) {

                economy[sender].bank =
                    0

            }


            economy[sender].coins =
                Number(
                    economy[sender].coins
                )


            economy[sender].bank =
                Number(
                    economy[sender].bank
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


            let amount


            if (
                input === 'all' ||
                input === 'todo'
            ) {

                amount =
                    economy[sender].coins

            } else {

                amount =
                    Number.parseInt(
                        input,
                        10
                    )

            }


            if (
                !Number.isFinite(amount) ||
                amount <= 0
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'CANTIDAD INVÁLIDA',

                                'Usa /gamble cantidad o /gamble all.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               FONDOS
            ───────────────────────────── */

            if (
                economy[sender].coins <
                amount
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'FONDOS INSUFICIENTES',

                                `Tienes 🪙 ${formatMoney(economy[sender].coins)} disponibles en tu wallet.`

                            )

                    }

                )

            }


            /* ─────────────────────────────
               RESULTADO
            ───────────────────────────── */

            const win =
                Math.random() < 0.5


            if (win) {

                economy[sender].coins +=
                    amount


                saveEconomy(
                    economy
                )


                logger.event(

                    `Gamble: ${sender.split('@')[0]} +${amount}`

                )


                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.success(

                                '🎰 GAMBLE',

                                [

                                    [
                                        'Usuario',
                                        `@${sender.split('@')[0]}`
                                    ],

                                    [
                                        'Resultado',
                                        '🟢 GANASTE'
                                    ],

                                    [
                                        'Apuesta',
                                        `🪙 ${formatMoney(amount)}`
                                    ],

                                    [
                                        'Ganancia',
                                        `🪙 +${formatMoney(amount)}`
                                    ],

                                    [
                                        'Wallet',
                                        `🪙 ${formatMoney(economy[sender].coins)}`
                                    ]

                                ],

                                'La suerte estuvo de tu lado.'

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

            economy[sender].coins -=
                amount


            saveEconomy(
                economy
            )


            logger.event(

                `Gamble: ${sender.split('@')[0]} -${amount}`

            )


            return await sock.sendMessage(

                from,

                {

                    text:
                        ui.error(

                            '🎰 GAMBLE',

                            [
                                '🔴 PERDISTE',
                                '',
                                `𖣣ֶㅤ֯⌗ 🎲  ׄ ⬭ *Apuesta:* 🪙 ${formatMoney(amount)}`,
                                `𖣣ֶㅤ֯⌗ 💸  ׄ ⬭ *Pérdida:* 🪙 -${formatMoney(amount)}`,
                                `𖣣ֶㅤ֯⌗ 🪙  ׄ ⬭ *Wallet:* ${formatMoney(economy[sender].coins)}`,
                                '',
                                '╰─ 𓂃 Esta vez no tuviste suerte.'
                            ].join('\n')

                        ),

                    mentions: [
                        sender
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error gamble: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE GAMBLE',

                                'No se pudo completar la apuesta.'

                            )

                    }

                )

            } catch {}

        }

    }

}
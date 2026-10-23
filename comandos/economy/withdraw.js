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
        'withdraw',

    aliases: [
        'with',
        'retirar',
        'retiro'
    ],

    description:
        'Retira monedas del banco',

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
                Math.max(
                    0,
                    Number(
                        economy[sender].coins
                    )
                )


            economy[sender].bank =
                Math.max(
                    0,
                    Number(
                        economy[sender].bank
                    )
                )


            /* ─────────────────────────────
               CANTIDAD
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
                    economy[sender].bank

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

                                'Usa /withdraw cantidad o /withdraw all.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               FONDOS
            ───────────────────────────── */

            if (
                economy[sender].bank <
                amount
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'FONDOS INSUFICIENTES',

                                `Solo tienes 🏦 ${formatMoney(economy[sender].bank)} disponibles en el banco.`

                            )

                    }

                )

            }


            /* ─────────────────────────────
               RETIRO
            ───────────────────────────── */

            economy[sender].bank -=
                amount


            economy[sender].coins +=
                amount


            saveEconomy(
                economy
            )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Withdraw: ${sender.split('@')[0]} → ${amount}`

            )


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            return await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            '🏧 RETIRO REALIZADO',

                            [

                                [
                                    'Usuario',
                                    `@${sender.split('@')[0]}`
                                ],

                                [
                                    'Retirado',
                                    `🪙 ${formatMoney(amount)}`
                                ],

                                [
                                    'Wallet',
                                    `🪙 ${formatMoney(economy[sender].coins)}`
                                ],

                                [
                                    'Banco',
                                    `🏦 ${formatMoney(economy[sender].bank)}`
                                ],

                                [
                                    'Total',
                                    `💸 ${formatMoney(
                                        economy[sender].coins +
                                        economy[sender].bank
                                    )}`
                                ]

                            ],

                            'Tus monedas fueron retiradas correctamente del banco.'

                        ),

                    mentions: [
                        sender
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error withdraw: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE RETIRO',

                                'No se pudo completar el retiro.'

                            )

                    }

                )

            } catch {}

        }

    }

}
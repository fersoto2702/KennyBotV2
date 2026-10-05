
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


function normalizeBalance(user = {}) {

    return {

        coins:
            Number.isFinite(
                Number(user.coins)
            )
                ? Math.max(
                    0,
                    Number(user.coins)
                )
                : 0,

        bank:
            Number.isFinite(
                Number(user.bank)
            )
                ? Math.max(
                    0,
                    Number(user.bank)
                )
                : 0

    }

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
        'balance',

    aliases: [
        'bal',
        'money',
        'wallet'
    ],

    description:
        'Muestra tu balance de monedas',

    category:
        'economia',

    cooldown:
        3,


    async execute({

        sock,
        from,
        msg

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


            const previous =
                economy[sender]


            const balance =
                normalizeBalance(
                    previous
                )


            economy[sender] =
                balance


            /*
                Solo escribimos si el usuario
                no existía o si había datos
                inválidos que normalizamos.
            */

            if (
                !previous ||
                previous.coins !== balance.coins ||
                previous.bank !== balance.bank
            ) {

                saveEconomy(
                    economy
                )

            }


            const wallet =
                balance.coins


            const bank =
                balance.bank


            const total =
                wallet + bank


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            const text =
                ui.info(

                    '💰 BALANCE',

                    [

                        [
                            'Usuario',
                            `@${sender.split('@')[0]}`
                        ],

                        [
                            'Wallet',
                            `🪙 ${formatMoney(wallet)}`
                        ],

                        [
                            'Banco',
                            `🏦 ${formatMoney(bank)}`
                        ],

                        [
                            'Total',
                            `💸 ${formatMoney(total)}`
                        ]

                    ],

                    'Administra tus monedas y ahorros.'

                )


            await sock.sendMessage(

                from,

                {

                    text,

                    mentions: [
                        sender
                    ]

                }

            )


            logger.event(

                `Balance consultado: ${sender.split('@')[0]} | ${formatMoney(total)} monedas`

            )


        } catch (err) {

            logger.error(

                `Error balance: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE BALANCE',

                                'No se pudo consultar tu balance.'

                            )

                    }

                )

            } catch {}

        }

    }

}
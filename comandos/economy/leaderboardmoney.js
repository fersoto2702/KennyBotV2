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


const MEDALS = [
    '🥇',
    '🥈',
    '🥉'
]


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


function normalizeMoney(value) {

    const number =
        Number(value)


    if (
        !Number.isFinite(number)
    ) {

        return 0

    }


    return Math.max(
        0,
        number
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
        'leaderboardmoney',

    aliases: [
        'moneylb',
        'richest',
        'topmoney',
        'rich'
    ],

    description:
        'Muestra el top de usuarios más ricos',

    category:
        'economia',

    cooldown:
        10,


    async execute({

        sock,
        from

    }) {

        try {

            /* ─────────────────────────────
               ECONOMÍA
            ───────────────────────────── */

            const economy =
                readEconomy()


            const users =
                Object.entries(
                    economy
                )


            /* ─────────────────────────────
               SIN DATOS
            ───────────────────────────── */

            if (
                users.length === 0
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.info(

                                '👑 TOP RICOS',

                                [],

                                'Todavía no hay usuarios registrados en la economía.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               NORMALIZAR
            ───────────────────────────── */

            const fixedUsers =
                users
                    .map(

                        ([id, data]) => {

                            const coins =
                                normalizeMoney(
                                    data?.coins
                                )


                            const bank =
                                normalizeMoney(
                                    data?.bank
                                )


                            return [

                                id,

                                {

                                    coins,

                                    bank,

                                    total:
                                        coins +
                                        bank

                                }

                            ]

                        }

                    )


            /* ─────────────────────────────
               ORDENAR
            ───────────────────────────── */

            fixedUsers.sort(

                (a, b) =>

                    b[1].total -
                    a[1].total

            )


            /* ─────────────────────────────
               TOP 10
            ───────────────────────────── */

            const top =
                fixedUsers
                    .slice(
                        0,
                        10
                    )


            const mentions =
                top.map(
                    ([id]) =>
                        id
                )


            const rows =
                top
                    .map(

                        ([id, data], index) => {

                            const position =
                                MEDALS[index] ||
                                `${index + 1}.`


                            return [

                                `${position} *@${id.split('@')[0]}*`,

                                `   🪙 Wallet: ${formatMoney(data.coins)}`,

                                `   🏦 Banco: ${formatMoney(data.bank)}`,

                                `   💸 Total: ${formatMoney(data.total)}`

                            ].join('\n')

                        }

                    )
                    .join(
                        '\n\n'
                    )


            /* ─────────────────────────────
               MENSAJE
            ───────────────────────────── */

            const text = [

                'ㅤ۟∩　ׅ　👑　ׅ　*TOP RICOS*　ׄᰙ',

                '',

                '𖣣ֶㅤ֯⌗ 💸  ׄ ⬭ *Ranking de economía*',

                '',

                rows,

                '',

                '╰─ 𓂃 Ranking basado en Wallet + Banco.'

            ].join('\n')


            /* ─────────────────────────────
               ENVIAR
            ───────────────────────────── */

            await sock.sendMessage(

                from,

                {

                    text,

                    mentions

                }

            )


            logger.event(

                `LeaderboardMoney consultado | ${top.length} usuario(s)`

            )


        } catch (err) {

            logger.error(

                `Error leaderboardmoney: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE RANKING',

                                'No se pudo consultar el ranking de usuarios.'

                            )

                    }

                )

            } catch {}

        }

    }

}
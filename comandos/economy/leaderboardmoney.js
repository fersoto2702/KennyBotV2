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

// =========================
// MEDALS
// =========================

const MEDALS = [

    '🥇',
    '🥈',
    '🥉'

]

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

    cooldown: 10,

    async execute({

        sock,
        from

    }) {

        try {

            // =========================
            // DB
            // =========================

            if (
                !fs.existsSync(economyPath)
            ) {

                fs.writeFileSync(

                    economyPath,

                    JSON.stringify(
                        {},
                        null,
                        2
                    )

                )

            }

            // =========================
            // READ DB
            // =========================

            let economy = {}

            try {

                economy =
                    JSON.parse(

                        fs.readFileSync(
                            economyPath
                        )

                    )

            } catch {

                economy = {}

            }

            // =========================
            // USERS
            // =========================

            const users =
                Object.entries(economy)

            if (
                users.length === 0
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.info(

                                'TOP RICOS',

                                [],

                                'No hay datos todavía.'

                            )

                    }

                )

            }

            // =========================
            // FIX VALUES
            // =========================

            const fixedUsers =

                users.map(

                    ([id, data]) => {

                        if (
                            typeof data.coins !== 'number'
                        ) {

                            data.coins = 0

                        }

                        if (
                            typeof data.bank !== 'number'
                        ) {

                            data.bank = 0

                        }

                        return [

                            id,

                            {

                                coins:
                                    data.coins,

                                bank:
                                    data.bank,

                                total:
                                    data.coins + data.bank

                            }

                        ]

                    }

                )

            // =========================
            // SORT
            // =========================

            fixedUsers.sort(

                (a, b) =>

                    b[1].total -
                    a[1].total

            )

            // =========================
            // TOP
            // =========================

            const top =
                fixedUsers.slice(0, 10)

            const mentions =
                top.map(([id]) => id)

            // =========================
            // ROWS
            // =========================

            const rows =

                top.map(

                    ([id, data], i) => {

                        const medal =

                            MEDALS[i] ||

                            `${i + 1}.`

                        return (

                            `${medal} ` +

                            `@${id.split('@')[0]} ` +

                            `💸 ${data.total.toLocaleString()}`

                        )

                    }

                ).join('\n')

            // =========================
            // SEND
            // =========================

            await sock.sendMessage(

                from,

                {

                    text: [

                        `👑 TOP RICOS`,

                        ui.divider,

                        rows,

                        ui.divider

                    ].join('\n'),

                    mentions

                }

            )

        } catch (err) {

            logger.error(
                `Error leaderboardmoney: ${err.message}`
            )

        }

    }

}
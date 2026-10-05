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


const DAILY_COOLDOWN =
    24 * 60 * 60 * 1000


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


function formatRemaining(ms) {

    const totalMinutes =
        Math.ceil(
            ms / 60000
        )


    const hours =
        Math.floor(
            totalMinutes / 60
        )


    const minutes =
        totalMinutes % 60


    if (
        hours <= 0
    ) {

        return `${minutes}m`

    }


    if (
        minutes <= 0
    ) {

        return `${hours}h`

    }


    return `${hours}h ${minutes}m`

}


module.exports = {

    name:
        'daily',

    aliases: [
        'diario',
        'reward'
    ],

    description:
        'Reclama tu recompensa diaria',

    category:
        'economia',


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


            if (
                !economy[sender] ||
                typeof economy[sender] !== 'object'
            ) {

                economy[sender] = {

                    coins:
                        0,

                    bank:
                        0,

                    lastDaily:
                        0

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


            if (
                !Number.isFinite(
                    Number(
                        economy[sender].lastDaily
                    )
                )
            ) {

                economy[sender].lastDaily =
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


            economy[sender].lastDaily =
                Number(
                    economy[sender].lastDaily
                )


            /* ─────────────────────────────
               COOLDOWN PERSISTENTE
            ───────────────────────────── */

            const now =
                Date.now()


            const lastDaily =
                economy[sender].lastDaily


            const nextDaily =
                lastDaily +
                DAILY_COOLDOWN


            if (
                lastDaily > 0 &&
                now < nextDaily
            ) {

                const remaining =
                    nextDaily -
                    now


                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'YA RECLAMASTE HOY',

                                `Tu próxima recompensa estará disponible en ${formatRemaining(remaining)}.`

                            )

                    }

                )

            }


            /* ─────────────────────────────
               RECOMPENSA
            ───────────────────────────── */

            const reward =

                Math.floor(
                    Math.random() *
                    2000
                ) +
                500


            economy[sender].coins +=
                reward


            economy[sender].lastDaily =
                now


            saveEconomy(
                economy
            )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Daily: ${sender.split('@')[0]} +${reward}`

            )


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            return await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            '🎁 DAILY REWARD',

                            [

                                [
                                    'Usuario',
                                    `@${sender.split('@')[0]}`
                                ],

                                [
                                    'Recompensa',
                                    `🪙 +${formatMoney(reward)}`
                                ],

                                [
                                    'Wallet',
                                    `🪙 ${formatMoney(economy[sender].coins)}`
                                ],

                                [
                                    'Próximo daily',
                                    '24 horas'
                                ]

                            ],

                            'Tu recompensa diaria fue añadida correctamente.'

                        ),

                    mentions: [
                        sender
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error daily: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DAILY',

                                'No se pudo reclamar la recompensa diaria.'

                            )

                    }

                )

            } catch {}

        }

    }

}
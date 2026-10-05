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


const WORK_COOLDOWN =
    60 * 60 * 1000


const JOBS = [

    'Programador 💻',

    'Taxista 🚕',

    'Doctor 🩺',

    'Policía 👮',

    'Chef 👨‍🍳',

    'Streamer 🎮',

    'Youtuber 📹',

    'Hacker 🖥️'

]


function random(array) {

    return array[
        Math.floor(
            Math.random() *
            array.length
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

        return (
            minutes === 1
                ? '1 minuto'
                : `${minutes} minutos`
        )

    }


    if (
        minutes <= 0
    ) {

        return (
            hours === 1
                ? '1 hora'
                : `${hours} horas`
        )

    }


    return `${hours}h ${minutes}m`

}


module.exports = {

    name:
        'work',

    aliases: [
        'trabajar',
        'job'
    ],

    description:
        'Trabaja para ganar monedas',

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
                    coins: 0,
                    bank: 0,
                    lastWork: 0
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
                        economy[sender].lastWork
                    )
                )
            ) {

                economy[sender].lastWork =
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


            economy[sender].lastWork =
                Number(
                    economy[sender].lastWork
                )


            /* ─────────────────────────────
               COOLDOWN
            ───────────────────────────── */

            const now =
                Date.now()


            const lastWork =
                economy[sender].lastWork


            const nextWork =
                lastWork +
                WORK_COOLDOWN


            if (
                lastWork > 0 &&
                now < nextWork
            ) {

                const remaining =
                    nextWork -
                    now


                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'YA TRABAJASTE',

                                `Podrás volver a trabajar en ${formatRemaining(remaining)}.`

                            )

                    }

                )

            }


            /* ─────────────────────────────
               TRABAJO
            ───────────────────────────── */

            const job =
                random(
                    JOBS
                )


            const amount =

                Math.floor(
                    Math.random() *
                    500
                ) +
                100


            economy[sender].coins +=
                amount


            economy[sender].lastWork =
                now


            saveEconomy(
                economy
            )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Work: ${sender.split('@')[0]} +${amount} (${job})`

            )


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            return await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            '💼 TRABAJO COMPLETADO',

                            [

                                [
                                    'Usuario',
                                    `@${sender.split('@')[0]}`
                                ],

                                [
                                    'Trabajo',
                                    job
                                ],

                                [
                                    'Ganancia',
                                    `🪙 +${formatMoney(amount)}`
                                ],

                                [
                                    'Wallet',
                                    `🪙 ${formatMoney(economy[sender].coins)}`
                                ],

                                [
                                    'Próximo trabajo',
                                    '1 hora'
                                ]

                            ],

                            'Terminaste tu jornada y recibiste tu pago.'

                        ),

                    mentions: [
                        sender
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error work: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE TRABAJO',

                                'No se pudo completar el trabajo.'

                            )

                    }

                )

            } catch {}

        }

    }

}
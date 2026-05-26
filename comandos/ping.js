const os =
    require('os')

const logger =
    require('../src/utils/logger')

const ui =
    require('../src/utils/ui')

// =========================
// FORMAT UPTIME
// =========================

const formatUptime = seconds => {

    const d =
        Math.floor(seconds / 86400)

    const h =
        Math.floor(
            (seconds % 86400) / 3600
        )

    const m =
        Math.floor(
            (seconds % 3600) / 60
        )

    const s =
        Math.floor(seconds % 60)

    return [

        d ? `${d}d` : '',
        h ? `${h}h` : '',
        m ? `${m}m` : '',
        `${s}s`

    ].filter(Boolean).join(' ')

}

module.exports = {

    name:
        'ping',

    aliases: [

        'p',
        'speed',
        'latency'

    ],

    description:
        'Muestra la velocidad y estado del bot',

    category:
        'general',

    cooldown: 2,

    async execute({

        sock,
        from

    }) {

        try {

            // =========================
            // START
            // =========================

            const start =
                performance.now()

            // =========================
            // CALCULATE
            // =========================

            const end =
                performance.now()

            const ms =
                Math.floor(end - start)

            // =========================
            // STATUS
            // =========================

            const status =

                ms < 150

                    ? '🟢 Excelente'

                    : ms < 400

                        ? '🟡 Estable'

                        : '🔴 Lento'

            // =========================
            // SYSTEM
            // =========================

            const uptime =
                formatUptime(
                    process.uptime()
                )

            const ram =

                (
                    process.memoryUsage()
                        .heapUsed /

                    1024 /

                    1024
                ).toFixed(2)

            const platform =
                `${os.platform()} ${os.arch()}`

            // =========================
            // LOGGER
            // =========================

            logger.event(
                `Ping ejecutado → ${ms}ms`
            )

            // =========================
            // SEND
            // =========================

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.success(

                            'PONG',

                            [

                                [

                                    'Velocidad',

                                    `${ms}ms`

                                ],

                                [

                                    'Estado',

                                    status

                                ],

                                [

                                    'Uptime',

                                    uptime

                                ],

                                [

                                    'RAM',

                                    `${ram} MB`

                                ],

                                [

                                    'NodeJS',

                                    process.version

                                ],

                                [

                                    'Plataforma',

                                    platform

                                ]

                            ]

                        )

                }

            )

        } catch (err) {

            logger.error(
                `Error ping: ${err.message}`
            )

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.error(

                            'ERROR',

                            'No se pudo medir el ping.'

                        )

                }

            )

        }

    }

}
const os =
    require('os')

const {
    performance
} = require('perf_hooks')

const logger =
    require('../src/utils/logger')

const ui =
    require('../src/utils/ui')


function formatUptime(
    seconds
) {

    const safeSeconds =
        Math.max(
            0,
            Number(seconds) || 0
        )


    const d =
        Math.floor(
            safeSeconds / 86400
        )


    const h =
        Math.floor(
            (safeSeconds % 86400) /
            3600
        )


    const m =
        Math.floor(
            (safeSeconds % 3600) /
            60
        )


    const s =
        Math.floor(
            safeSeconds % 60
        )


    return [

        d
            ? `${d}d`
            : '',

        h
            ? `${h}h`
            : '',

        m
            ? `${m}m`
            : '',

        `${s}s`

    ]
        .filter(Boolean)
        .join(' ')

}


function formatBytes(
    bytes
) {

    const value =
        Number(bytes)


    if (
        !Number.isFinite(value) ||
        value <= 0
    ) {

        return '0 MB'

    }


    return (
        value /
        1024 /
        1024
    )
        .toFixed(2) +
        ' MB'

}


function getLatencyStatus(
    ms
) {

    if (
        ms < 150
    ) {

        return '🟢 Excelente'

    }


    if (
        ms < 400
    ) {

        return '🟡 Estable'

    }


    if (
        ms < 800
    ) {

        return '🟠 Lento'

    }


    return '🔴 Muy lento'

}


async function measureLatency(
    sock,
    from
) {

    const start =
        performance.now()


    /*
        Medimos una operación real que
        necesita comunicación con WhatsApp.

        Esto es mucho más representativo
        que llamar performance.now()
        dos veces seguidas.
    */

    await sock.sendPresenceUpdate(
        'composing',
        from
    )


    const end =
        performance.now()


    /*
        Restauramos la presencia para
        no dejar el bot como "escribiendo".
    */

    try {

        await sock.sendPresenceUpdate(
            'paused',
            from
        )

    } catch {}


    return Math.max(
        0,
        Math.round(
            end - start
        )
    )

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

    cooldown:
        2,


    async execute({

        sock,
        from

    }) {

        try {

            /* ─────────────────────────────
               LATENCIA
            ───────────────────────────── */

            let ms

            try {

                ms =
                    await measureLatency(

                        sock,

                        from

                    )

            } catch (err) {

                logger.warn?.(

                    `No se pudo medir latencia real: ${err.message}`

                )


                /*
                    Si WhatsApp rechaza la
                    actualización de presencia,
                    seguimos mostrando el resto
                    del estado del bot.
                */

                ms =
                    null

            }


            /* ─────────────────────────────
               ESTADO
            ───────────────────────────── */

            const status =
                ms !== null

                    ? getLatencyStatus(
                        ms
                    )

                    : '⚪ No disponible'


            /* ─────────────────────────────
               UPTIME
            ───────────────────────────── */

            const uptime =
                formatUptime(
                    process.uptime()
                )


            /* ─────────────────────────────
               MEMORIA
            ───────────────────────────── */

            const memory =
                process.memoryUsage()


            const heapUsed =
                formatBytes(
                    memory.heapUsed
                )


            const heapTotal =
                formatBytes(
                    memory.heapTotal
                )


            const rss =
                formatBytes(
                    memory.rss
                )


            /* ─────────────────────────────
               SISTEMA
            ───────────────────────────── */

            const platform =
                `${os.platform()} ${os.arch()}`


            const cpuModel =
                os.cpus()?.[0]?.model ||
                'Desconocido'


            const systemUptime =
                formatUptime(
                    os.uptime()
                )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Ping ejecutado | ${ms !== null ? `${ms}ms` : 'N/A'} | RAM=${heapUsed}`

            )


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            return await sock.safeSendMessage(

                from,

                {

                    text:
                        ui.success(

                            'PONG',

                            [

                                [
                                    'Latencia',
                                    ms !== null
                                        ? `${ms} ms`
                                        : 'No disponible'
                                ],

                                [
                                    'Estado',
                                    status
                                ],

                                [
                                    'Uptime Bot',
                                    uptime
                                ],

                                [
                                    'Heap',
                                    `${heapUsed} / ${heapTotal}`
                                ],

                                [
                                    'RAM Proceso',
                                    rss
                                ],

                                [
                                    'NodeJS',
                                    process.version
                                ],

                                [
                                    'Plataforma',
                                    platform
                                ],

                                [
                                    'Uptime Sistema',
                                    systemUptime
                                ],

                                [
                                    'CPU',
                                    cpuModel
                                ]

                            ],

                            'KennyBot V2 operativo.'

                        )

                }

            )


        } catch (err) {

            logger.error(

                `Error ping: ${err.stack || err.message}`

            )


            try {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR PING',

                                'No se pudo consultar el estado de KennyBot.'

                            )

                    }

                )

            } catch {}

        }

    }

}
const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const {
    getUserStats
} = require('../../src/database/mysql')


function formatTime(ms) {

    const safeMs =
        Number(ms)


    if (
        !Number.isFinite(safeMs) ||
        safeMs < 0
    ) {

        return 'Desconocido'

    }


    const totalMinutes =
        Math.floor(
            safeMs / 60000
        )


    const days =
        Math.floor(
            totalMinutes / 1440
        )


    const hours =
        Math.floor(
            (totalMinutes % 1440) / 60
        )


    const minutes =
        totalMinutes % 60


    if (
        days > 0
    ) {

        return (
            hours > 0
                ? `${days}d ${hours}h`
                : `${days}d`
        )

    }


    if (
        hours > 0
    ) {

        return (
            minutes > 0
                ? `${hours}h ${minutes}m`
                : `${hours}h`
        )

    }


    return `${minutes}m`

}


function formatNumber(value) {

    const number =
        Number(value)


    if (
        !Number.isFinite(number)
    ) {

        return '0'

    }


    return number.toLocaleString(
        'es-MX'
    )

}


function getMentionedJids(msg) {

    return (

        msg.message
            ?.extendedTextMessage
            ?.contextInfo
            ?.mentionedJid

        ||

        msg.message
            ?.imageMessage
            ?.contextInfo
            ?.mentionedJid

        ||

        msg.message
            ?.videoMessage
            ?.contextInfo
            ?.mentionedJid

        ||

        []

    )

}


function getDays(args = []) {

    const numericArg =
        args.find(
            arg =>
                /^\d+$/.test(
                    String(arg)
                )
        )


    if (!numericArg) {

        return 7

    }


    return Number.parseInt(
        numericArg,
        10
    )

}


module.exports = {

    name:
        'msgstats',

    aliases: [
        'messages',
        'actividad'
    ],

    description:
        'Muestra estadísticas de mensajes',

    category:
        'general',
async execute({

        sock,
        from,
        msg,
        args

    }) {

        try {

            /* ─────────────────────────────
               SOLO GRUPOS
            ───────────────────────────── */

            if (
                !from.endsWith(
                    '@g.us'
                )
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'SOLO GRUPOS',

                                'Este comando solo funciona dentro de grupos.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               USUARIO
            ───────────────────────────── */

            const mentions =
                getMentionedJids(
                    msg
                )


            const sender =

                msg.key.participant ||

                msg.participant ||

                msg.key.remoteJid


            const target =

                mentions[0] ||

                sender


            if (!target) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE USUARIO',

                                'No se pudo identificar al usuario.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               PERÍODO
            ───────────────────────────── */

            const days =
                getDays(
                    args
                )


            if (
                !Number.isFinite(days) ||
                days < 1 ||
                days > 365
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'DÍAS INVÁLIDOS',

                                'Usa un número entre 1 y 365.\n\nEjemplos:\n/msgstats 30\n/msgstats @usuario 30'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               CONSULTA
            ───────────────────────────── */

            const stats =
                await getUserStats(

                    from,

                    target,

                    days

                )


            const total =
                Number(
                    stats?.total || 0
                )


            if (
                !stats ||
                !Number.isFinite(total) ||
                total <= 0
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'SIN DATOS',

                                `@${target.split('@')[0]} no tiene estadísticas registradas de los últimos ${days} días.`

                            ),

                        mentions: [
                            target
                        ]

                    }

                )

            }


            /* ─────────────────────────────
               ÚLTIMA ACTIVIDAD
            ───────────────────────────── */

            const lastMessage =
                Number(
                    stats.ultimo
                )


            const inactiveMs =

                Number.isFinite(
                    lastMessage
                )

                    ? Math.max(
                        0,
                        Date.now() -
                        lastMessage
                    )

                    : null


            const lastActivity =

                inactiveMs !== null

                    ? `⏱ Hace ${formatTime(inactiveMs)}`

                    : 'Sin datos'


            /* ─────────────────────────────
               POSICIÓN
            ───────────────────────────── */

            const position =
                Number(
                    stats.position
                )


            const formattedPosition =

                Number.isFinite(position) &&
                position > 0

                    ? `🏆 #${position}`

                    : 'Sin ranking'


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.info(

                            '📊 ESTADÍSTICAS',

                            [

                                [
                                    'Usuario',
                                    `@${target.split('@')[0]}`
                                ],

                                [
                                    'Mensajes',
                                    `💬 ${formatNumber(total)}`
                                ],

                                [
                                    'Posición',
                                    formattedPosition
                                ],

                                [
                                    'Período',
                                    `📅 ${days} días`
                                ],

                                [
                                    'Último mensaje',
                                    lastActivity
                                ]

                            ],

                            'Actividad registrada dentro del grupo.'

                        ),

                    mentions: [
                        target
                    ]

                }

            )


            logger.event(

                `MsgStats: ${from.split('@')[0]} | ${target.split('@')[0]} | ${days} días | ${total} mensajes`

            )


        } catch (err) {

            logger.error(

                `MsgStats Error: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE ESTADÍSTICAS',

                                'No se pudieron consultar las estadísticas.'

                            )

                    }

                )

            } catch {}

        }

    }

}
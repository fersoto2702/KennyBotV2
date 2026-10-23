const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const {
    getInactive
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


module.exports = {

    name:
        'inactive',

    aliases: [
        'inactivos',
        'deadchat'
    ],

    description:
        'Muestra los usuarios menos activos',

    category:
        'general',
async execute({

        sock,
        from,
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
               PERÍODO
            ───────────────────────────── */

            const days =
                Number.parseInt(
                    args?.[0] || '7',
                    10
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

                                'Usa un número entre 1 y 365.\n\nEjemplo: /inactive 30'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               CONSULTA
            ───────────────────────────── */

            const users =
                await getInactive(
                    from,
                    days,
                    10
                )


            if (
                !Array.isArray(users) ||
                users.length === 0
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'SIN DATOS',

                                `No hay estadísticas disponibles de los últimos ${days} días.`

                            )

                    }

                )

            }


            /* ─────────────────────────────
               USUARIOS VÁLIDOS
            ───────────────────────────── */

            const validUsers =
                users.filter(
                    user =>
                        user &&
                        typeof user.usuario === 'string'
                )


            if (
                validUsers.length === 0
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'SIN DATOS',

                                'No se encontraron usuarios válidos en las estadísticas.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               MENCIONES
            ───────────────────────────── */

            const mentions =
                validUsers.map(
                    user =>
                        user.usuario
                )


            /* ─────────────────────────────
               FILAS
            ───────────────────────────── */

            const rows =
                validUsers
                    .map(

                        (user, index) => {

                            const lastMessage =
                                Number(
                                    user.ultimo
                                )


                            const inactiveMs =
                                Number.isFinite(lastMessage)
                                    ? Math.max(
                                        0,
                                        Date.now() -
                                        lastMessage
                                    )
                                    : NaN


                            const inactiveTime =
                                formatTime(
                                    inactiveMs
                                )


                            const number =
                                user.usuario
                                    .split('@')[0]


                            return [

                                `𖣣ֶㅤ֯⌗ ${index + 1}.  ׄ ⬭ *@${number}*`,

                                `   💬 Mensajes: ${formatNumber(user.total)}`,

                                `   ⏱ Inactivo: ${inactiveTime}`

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

                'ㅤ۟∩　ׅ　💀　ׅ　*USUARIOS MÁS INACTIVOS*　ׄᰙ',

                '',

                `𖣣ֶㅤ֯⌗ 📅  ׄ ⬭ *Período:* últimos ${days} días`,

                `𖣣ֶㅤ֯⌗ 👥  ׄ ⬭ *Usuarios:* ${validUsers.length}`,

                '',

                rows,

                '',

                '╰─ 𓂃 Ranking basado en la última actividad registrada.'

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

                `Inactive: ${from.split('@')[0]} | ${validUsers.length} usuarios | ${days} días`

            )


        } catch (err) {

            logger.error(

                `Inactive Error: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE INACTIVOS',

                                'No se pudo consultar la actividad del grupo.'

                            )

                    }

                )

            } catch {}

        }

    }

}
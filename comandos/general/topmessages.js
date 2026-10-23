const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const {
    getTopMessages
} = require('../../src/database/mysql')


const MEDALS = [
    '🥇',
    '🥈',
    '🥉'
]


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
        'topmessages',

    aliases: [
        'topmsg',
        'activostop'
    ],

    description:
        'Muestra los usuarios más activos',

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

                                'Usa un número entre 1 y 365.\n\nEjemplo: /topmessages 30'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               CONSULTA
            ───────────────────────────── */

            const users =
                await getTopMessages(
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
               RANKING
            ───────────────────────────── */

            const rows =
                validUsers
                    .map(

                        (user, index) => {

                            const medal =
                                MEDALS[index] ||
                                `${index + 1}.`


                            const number =
                                user.usuario
                                    .split('@')[0]


                            const total =
                                formatNumber(
                                    user.total
                                )


                            return [

                                `${medal} *@${number}*`,

                                `   💬 Mensajes: ${total}`

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

                'ㅤ۟∩　ׅ　🏆　ׅ　*USUARIOS MÁS ACTIVOS*　ׄᰙ',

                '',

                `𖣣ֶㅤ֯⌗ 📅  ׄ ⬭ *Período:* últimos ${days} días`,

                `𖣣ֶㅤ֯⌗ 👥  ׄ ⬭ *Usuarios:* ${validUsers.length}`,

                '',

                rows,

                '',

                '╰─ 𓂃 Ranking basado en mensajes enviados.'

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


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `TopMessages: ${from.split('@')[0]} | ${validUsers.length} usuarios | ${days} días`

            )


        } catch (err) {

            logger.error(

                `TopMessages Error: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE RANKING',

                                'No se pudo consultar el ranking de mensajes.'

                            )

                    }

                )

            } catch {}

        }

    }

}
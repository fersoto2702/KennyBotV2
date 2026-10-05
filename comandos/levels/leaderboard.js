const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


const levelsPath =
    path.join(
        __dirname,
        '../../database/levels.json'
    )


const MEDALS = [
    '🥇',
    '🥈',
    '🥉'
]


function ensureLevelsFile() {

    const directory =
        path.dirname(
            levelsPath
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
            levelsPath
        )
    ) {

        fs.writeFileSync(
            levelsPath,
            JSON.stringify(
                {},
                null,
                2
            ),
            'utf8'
        )

    }

}


function readLevels() {

    ensureLevelsFile()


    try {

        const data =
            JSON.parse(
                fs.readFileSync(
                    levelsPath,
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
            `Error leyendo levels.json: ${err.message}`
        )

        return {}

    }

}


function normalizeLevelData(
    data
) {

    const source =
        data &&
        typeof data === 'object' &&
        !Array.isArray(data)
            ? data
            : {}


    let level =
        Number(
            source.level
        )


    let xp =
        Number(
            source.xp
        )


    if (
        !Number.isFinite(level) ||
        level < 1
    ) {

        level =
            1

    }


    if (
        !Number.isFinite(xp) ||
        xp < 0
    ) {

        xp =
            0

    }


    return {

        ...source,

        level:
            Math.floor(level),

        xp:
            Math.floor(xp)

    }

}


function formatNumber(
    value
) {

    return Number(
        value || 0
    )
        .toLocaleString(
            'es-MX'
        )

}


function getNumber(
    jid
) {

    return String(
        jid || ''
    )
        .split('@')[0]
        .split(':')[0]

}


module.exports = {

    name:
        'leaderboard',

    aliases: [
        'lb',
        'top',
        'topxp'
    ],

    description:
        'Muestra el top de usuarios con más nivel',

    category:
        'niveles',

    cooldown:
        10,


    async execute({

        sock,
        from

    }) {

        try {

            /* ─────────────────────────────
               DATOS
            ───────────────────────────── */

            const levels =
                readLevels()


            let users =
                Object.entries(
                    levels
                )
                    .map(

                        ([id, data]) => {

                            return [

                                id,

                                normalizeLevelData(
                                    data
                                )

                            ]

                        }

                    )


            /* ─────────────────────────────
               SIN USUARIOS
            ───────────────────────────── */

            if (
                users.length === 0
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.info(

                                '🏆 LEADERBOARD',

                                [],

                                'Todavía no hay usuarios registrados en el sistema de niveles.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               ORDENAR
            ───────────────────────────── */

            users.sort(

                (a, b) => {

                    const levelDiff =
                        b[1].level -
                        a[1].level


                    if (
                        levelDiff !== 0
                    ) {

                        return levelDiff

                    }


                    return (
                        b[1].xp -
                        a[1].xp
                    )

                }

            )


            const top =
                users.slice(
                    0,
                    10
                )


            /* ─────────────────────────────
               MENCIONES
            ───────────────────────────── */

            const mentions =
                top
                    .map(
                        ([id]) =>
                            id
                    )
                    .filter(
                        id =>
                            typeof id === 'string' &&
                            id.includes('@')
                    )


            /* ─────────────────────────────
               RANKING
            ───────────────────────────── */

            const rows =
                top
                    .map(

                        ([id, data], index) => {

                            const position =
                                MEDALS[index] ||
                                `${index + 1}.`


                            return [

                                `${position} *@${getNumber(id)}*`,

                                `   ⭐ Nivel: ${formatNumber(data.level)}`,

                                `   ✨ XP: ${formatNumber(data.xp)}`

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

                'ㅤ۟∩　ׅ　🏆　ׅ　*LEADERBOARD GLOBAL*　ׄᰙ',

                '',

                `𖣣ֶㅤ֯⌗ 👥  ׄ ⬭ *Usuarios registrados:* ${users.length}`,

                `𖣣ֶㅤ֯⌗ 🔝  ׄ ⬭ *Mostrando:* Top ${top.length}`,

                '',

                rows,

                '',

                '╰─ 𓂃 Ranking ordenado por nivel y XP.'

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

                `Leaderboard usado en ${from.split('@')[0]} | ${users.length} usuarios`

            )


        } catch (err) {

            logger.error(

                `Error leaderboard: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE LEADERBOARD',

                                'No se pudo generar el ranking de niveles.'

                            )

                    }

                )

            } catch {}

        }

    }

}
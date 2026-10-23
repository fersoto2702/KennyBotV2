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


function saveLevels(
    levels
) {

    fs.writeFileSync(
        levelsPath,
        JSON.stringify(
            levels,
            null,
            2
        ),
        'utf8'
    )

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


function getMedal(
    position
) {

    if (
        position === 1
    ) {

        return '🥇'

    }


    if (
        position === 2
    ) {

        return '🥈'

    }


    if (
        position === 3
    ) {

        return '🥉'

    }


    return `#${position}`

}


module.exports = {

    name:
        'rank',

    aliases: [
        'ranking',
        'globalrank'
    ],

    description:
        'Muestra tu posición en el ranking global',

    category:
        'niveles',
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
               NIVELES
            ───────────────────────────── */

            const levels =
                readLevels()


            let changed =
                false


            if (
                !levels[sender] ||
                typeof levels[sender] !== 'object' ||
                Array.isArray(levels[sender])
            ) {

                levels[sender] = {
                    xp: 0,
                    level: 1
                }


                changed =
                    true

            }


            const normalizedSender =
                normalizeLevelData(
                    levels[sender]
                )


            if (
                levels[sender].xp !==
                normalizedSender.xp
            ) {

                levels[sender].xp =
                    normalizedSender.xp

                changed =
                    true

            }


            if (
                levels[sender].level !==
                normalizedSender.level
            ) {

                levels[sender].level =
                    normalizedSender.level

                changed =
                    true

            }


            if (
                changed
            ) {

                saveLevels(
                    levels
                )

            }


            /* ─────────────────────────────
               USUARIOS
            ───────────────────────────── */

            const users =
                Object.entries(
                    levels
                )
                    .map(

                        ([id, data]) => [

                            id,

                            normalizeLevelData(
                                data
                            )

                        ]

                    )


            /* ─────────────────────────────
               ORDENAR
            ───────────────────────────── */

            users.sort(

                (a, b) => {

                    const levelDifference =
                        b[1].level -
                        a[1].level


                    if (
                        levelDifference !== 0
                    ) {

                        return levelDifference

                    }


                    return (
                        b[1].xp -
                        a[1].xp
                    )

                }

            )


            /* ─────────────────────────────
               POSICIÓN
            ───────────────────────────── */

            const index =
                users.findIndex(

                    ([id]) =>
                        id === sender

                )


            const position =
                index >= 0
                    ? index + 1
                    : users.length


            const userData =
                normalizeLevelData(
                    levels[sender]
                )


            const medal =
                getMedal(
                    position
                )


            /* ─────────────────────────────
               DATOS EXTRA
            ───────────────────────────── */

            const usersAbove =
                Math.max(
                    0,
                    position - 1
                )


            const percentile =
                users.length > 0
                    ? Math.max(
                        1,
                        Math.ceil(
                            (
                                position /
                                users.length
                            ) *
                            100
                        )
                    )
                    : 100


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Rank check: ${getNumber(sender)} → #${position}/${users.length} | Nivel ${userData.level}`

            )


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            return await sock.sendMessage(

                from,

                {

                    text:
                        ui.info(

                            '🏆 RANK GLOBAL',

                            [

                                [
                                    'Usuario',
                                    `@${getNumber(sender)}`
                                ],

                                [
                                    'Posición',
                                    `${medal} de ${users.length}`
                                ],

                                [
                                    'Nivel',
                                    `⭐ ${formatNumber(userData.level)}`
                                ],

                                [
                                    'XP',
                                    `✨ ${formatNumber(userData.xp)}`
                                ],

                                [
                                    'Por encima',
                                    usersAbove === 0
                                        ? '👑 Nadie'
                                        : `👥 ${formatNumber(usersAbove)} usuario${usersAbove === 1 ? '' : 's'}`
                                ],

                                [
                                    'Top aproximado',
                                    `🔝 ${percentile}%`
                                ]

                            ],

                            position === 1
                                ? 'Estás en el primer lugar del ranking global.'
                                : 'Sigue ganando XP para subir posiciones.'

                        ),

                    mentions: [
                        sender
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error rank: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE RANK',

                                'No se pudo consultar tu posición global.'

                            )

                    }

                )

            } catch {}

        }

    }

}
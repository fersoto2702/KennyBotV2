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


function createProgressBar(
    current,
    required,
    size = 10
) {

    if (
        !Number.isFinite(current) ||
        !Number.isFinite(required) ||
        required <= 0
    ) {

        return {
            bar:
                '░'.repeat(size),

            percent:
                0
        }

    }


    const ratio =
        Math.max(
            0,
            Math.min(
                1,
                current / required
            )
        )


    const filled =
        Math.floor(
            ratio * size
        )


    const percent =
        Math.floor(
            ratio * 100
        )


    return {

        bar:
            '█'.repeat(filled) +
            '░'.repeat(
                size - filled
            ),

        percent

    }

}


module.exports = {

    name:
        'level',

    aliases: [
        'lvl',
        'rank',
        'xp'
    ],

    description:
        'Muestra tu nivel y XP actual',

    category:
        'niveles',

    cooldown:
        5,


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


            let xp =
                Number(
                    levels[sender].xp
                )


            let level =
                Number(
                    levels[sender].level
                )


            if (
                !Number.isFinite(xp) ||
                xp < 0
            ) {

                xp =
                    0

                changed =
                    true

            }


            if (
                !Number.isFinite(level) ||
                level < 1
            ) {

                level =
                    1

                changed =
                    true

            }


            xp =
                Math.floor(
                    xp
                )


            level =
                Math.floor(
                    level
                )


            if (
                levels[sender].xp !== xp
            ) {

                levels[sender].xp =
                    xp

                changed =
                    true

            }


            if (
                levels[sender].level !== level
            ) {

                levels[sender].level =
                    level

                changed =
                    true

            }


            /* ─────────────────────────────
               XP NECESARIA
            ───────────────────────────── */

            const neededXp =
                level * 100


            const {
                bar,
                percent
            } =
                createProgressBar(

                    xp,

                    neededXp,

                    10

                )


            const remainingXp =
                Math.max(
                    0,
                    neededXp - xp
                )


            /* ─────────────────────────────
               GUARDAR SOLO SI CAMBIÓ
            ───────────────────────────── */

            if (
                changed
            ) {

                saveLevels(
                    levels
                )

            }


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Level check: ${sender.split('@')[0]} → Nivel ${level} | ${xp}/${neededXp} XP`

            )


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            return await sock.sendMessage(

                from,

                {

                    text:
                        ui.info(

                            '⭐ NIVEL · XP',

                            [

                                [
                                    'Usuario',
                                    `@${sender.split('@')[0]}`
                                ],

                                [
                                    'Nivel',
                                    `⭐ ${formatNumber(level)}`
                                ],

                                [
                                    'XP',
                                    `✨ ${formatNumber(xp)} / ${formatNumber(neededXp)}`
                                ],

                                [
                                    'Progreso',
                                    `${bar} ${percent}%`
                                ],

                                [
                                    'Faltan',
                                    remainingXp > 0
                                        ? `✨ ${formatNumber(remainingXp)} XP`
                                        : '✓ Nivel listo para subir'
                                ]

                            ],

                            'Sigue participando para ganar más experiencia.'

                        ),

                    mentions: [
                        sender
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error level: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE NIVEL',

                                'No se pudo consultar tu nivel y experiencia.'

                            )

                    }

                )

            } catch {}

        }

    }

}
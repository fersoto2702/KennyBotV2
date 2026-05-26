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

    cooldown: 5,

    async execute({

        sock,
        from,
        msg

    }) {

        try {

            // =========================
            // CREATE FILE
            // =========================

            if (
                !fs.existsSync(levelsPath)
            ) {

                fs.writeFileSync(

                    levelsPath,

                    JSON.stringify(
                        {},
                        null,
                        2
                    )

                )

            }

            // =========================
            // READ DB
            // =========================

            let levels = {}

            try {

                levels =
                    JSON.parse(

                        fs.readFileSync(
                            levelsPath
                        )

                    )

            } catch {

                levels = {}

            }

            // =========================
            // USER
            // =========================

            const sender =

                msg.key.participant ||

                msg.key.remoteJid

            // =========================
            // CREATE USER
            // =========================

            if (
                !levels[sender]
            ) {

                levels[sender] = {

                    xp: 0,
                    level: 1

                }

            }

            // =========================
            // FIX VALUES
            // =========================

            if (
                typeof levels[sender].xp !== 'number'
            ) {

                levels[sender].xp = 0

            }

            if (
                typeof levels[sender].level !== 'number'
            ) {

                levels[sender].level = 1

            }

            if (
                levels[sender].xp < 0
            ) {

                levels[sender].xp = 0

            }

            if (
                levels[sender].level < 1
            ) {

                levels[sender].level = 1

            }

            // =========================
            // DATA
            // =========================

            const xp =
                levels[sender].xp

            const level =
                levels[sender].level

            const neededXp =
                level * 100

            const progress =

                Math.min(

                    Math.floor(

                        (xp / neededXp) * 10

                    ),

                    10

                )

            const bar =

                '█'.repeat(progress) +

                '░'.repeat(10 - progress)

            const percent =

                Math.min(

                    Math.floor(

                        (xp / neededXp) * 100

                    ),

                    100

                )

            // =========================
            // SAVE
            // =========================

            fs.writeFileSync(

                levelsPath,

                JSON.stringify(
                    levels,
                    null,
                    2
                )

            )

            logger.event(

                `Level check: ${sender.split('@')[0]} → Nivel ${level}`

            )

            // =========================
            // SEND
            // =========================

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.info(

                            'NIVEL · XP',

                            [

                                [

                                    'Usuario',

                                    `@${sender.split('@')[0]}`

                                ],

                                [

                                    'Nivel',

                                    `⭐ ${level}`

                                ],

                                [

                                    'XP',

                                    `✨ ${xp.toLocaleString()} / ${neededXp.toLocaleString()}`

                                ],

                                [

                                    'Progreso',

                                    `${bar} ${percent}%`

                                ]

                            ]

                        ),

                    mentions: [

                        sender

                    ]

                }

            )

        } catch (err) {

            logger.error(
                `Error level: ${err.message}`
            )

        }

    }

}
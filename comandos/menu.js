const comandos =
    require('../src/utils/commandRegistry')

const logger =
    require('../src/utils/logger')


const categoryConfig = {

    general: {
        emoji: '🤖',
        label: '𝐆𝐄𝐍𝐄𝐑𝐀𝐋'
    },

    descargas: {
        emoji: '⬇️',
        label: '𝐃𝐄𝐒𝐂𝐀𝐑𝐆𝐀𝐒'
    },

    diversión: {
        emoji: '🎭',
        label: '𝐃𝐈𝐕𝐄𝐑𝐒𝐈𝐎𝐍'
    },

    economía: {
        emoji: '🪙',
        label: '𝐄𝐂𝐎𝐍𝐎𝐌𝐈𝐀'
    },

    niveles: {
        emoji: '⭐',
        label: '𝐍𝐈𝐕𝐄𝐋𝐄𝐒'
    },

    perfil: {
        emoji: '👤',
        label: '𝐏𝐄𝐑𝐅𝐈𝐋'
    },

    grupos: {
        emoji: '👥',
        label: '𝐆𝐑𝐔𝐏𝐎𝐒'
    },

    bienvenida: {
        emoji: '👋',
        label: '𝐁𝐈𝐄𝐍𝐕𝐄𝐍𝐈𝐃𝐀'
    },

    configuración: {
        emoji: '⚙️',
        label: '𝐂𝐎𝐍𝐅𝐈𝐆𝐔𝐑𝐀𝐂𝐈𝐎𝐍'
    },

    admin: {
        emoji: '🛡️',
        label: '𝐀𝐃𝐌𝐈𝐍'
    },

    owner: {
        emoji: '👑',
        label: '𝐎𝐖𝐍𝐄𝐑'
    }

}


const categoryOrder = [
    'general',
    'descargas',
    'diversión',
    'economía',
    'niveles',
    'perfil',
    'grupos',
    'bienvenida',
    'configuración',
    'admin',
    'owner'
]


function formatUptime(
    seconds
) {

    const d =
        Math.floor(
            seconds / 86400
        )

    const h =
        Math.floor(
            seconds % 86400 / 3600
        )

    const m =
        Math.floor(
            seconds % 3600 / 60
        )

    const s =
        Math.floor(
            seconds % 60
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


function safeText(
    value,
    fallback
) {

    const text =
        String(
            value ?? ''
        )
            .trim()


    return text ||
        fallback

}


function getGreeting() {

    const hour =
        new Date()
            .getHours()


    if (
        hour < 12
    ) {

        return '🌅 Buenos días'

    }


    if (
        hour < 18
    ) {

        return '☀️ Buenas tardes'

    }


    return '🌙 Buenas noches'

}


module.exports = {

    name:
        'menu',

    aliases: [
        'help',
        'ayuda',
        'commands',
        'cmds'
    ],

    description:
        'Muestra el menú del bot',

    category:
        'general',

    cooldown:
        5,


    async execute({

        sock,
        from,
        settings = {}

    }) {

        try {

            /* ─────────────────────────────
               CATEGORÍAS
            ───────────────────────────── */

            const categories =
                {}


            for (
                const [key, command]
                of comandos
            ) {

                if (
                    !command ||
                    typeof command !== 'object'
                ) {

                    continue

                }


                /*
                    Evitar aliases duplicados.
                */

                if (
                    key !== command.name
                ) {

                    continue

                }


                /*
                    Comandos ocultos no aparecen.
                */

                if (
                    command.hidden
                ) {

                    continue

                }


                const category =
                    String(
                        command.category ||
                        'general'
                    )
                        .toLowerCase()
                        .trim()


                if (
                    !categories[
                        category
                    ]
                ) {

                    categories[
                        category
                    ] = []

                }


                categories[
                    category
                ]
                    .push(
                        command
                    )

            }


            /* ─────────────────────────────
               ORDENAR COMANDOS
            ───────────────────────────── */

            for (
                const category
                in categories
            ) {

                categories[
                    category
                ]
                    .sort(

                        (a, b) =>

                            String(
                                a.name
                            )
                                .localeCompare(
                                    String(
                                        b.name
                                    ),
                                    'es',
                                    {
                                        sensitivity:
                                            'base'
                                    }
                                )

                    )

            }


            /* ─────────────────────────────
               TOTAL
            ───────────────────────────── */

            const total =
                Object.values(
                    categories
                )
                    .reduce(

                        (
                            accumulator,
                            commands
                        ) =>

                            accumulator +
                            commands.length,

                        0

                    )


            /* ─────────────────────────────
               DATOS DEL BOT
            ───────────────────────────── */

            const greeting =
                getGreeting()


            const memory =
                process.memoryUsage()


            const ramUsed =
                (
                    memory.heapUsed /
                    1024 /
                    1024
                )
                    .toFixed(2)


            const ramTotal =
                (
                    memory.heapTotal /
                    1024 /
                    1024
                )
                    .toFixed(2)


            const uptime =
                formatUptime(
                    process.uptime()
                )


            const botName =
                safeText(

                    settings.botName,

                    'KennyBot V2'

                )


            /* ─────────────────────────────
               CABECERA
            ───────────────────────────── */

            let text = [

                'ㅤ۟∩　ׅ　🤖　ׅ　*KENNYBOT V2*　ׄᰙ',

                '',

                `𖣣ֶㅤ֯⌗ 🌅  ׄ ⬭ *Saludo:* ${greeting.replace(/^[^\s]+\s*/, '')}`,

                `𖣣ֶㅤ֯⌗ ⌨️  ׄ ⬭ *Prefijos:* / . #`,

                `𖣣ֶㅤ֯⌗ 📚  ׄ ⬭ *Comandos:* ${total}`,

                `𖣣ֶㅤ֯⌗ ⏱️  ׄ ⬭ *Uptime:* ${uptime}`,

                `𖣣ֶㅤ֯⌗ 🧠  ׄ ⬭ *RAM:* ${ramUsed} / ${ramTotal} MB`,

                `𖣣ֶㅤ֯⌗ 🟢  ׄ ⬭ *Node:* ${process.version}`,

                '',

                '━━━━━━━━━━━━━━━━━━━━━━━━━━'

            ]
                .join('\n')


            /* ─────────────────────────────
               ORDEN DE CATEGORÍAS
            ───────────────────────────── */

            const orderedCategories = [

                ...categoryOrder.filter(

                    category =>
                        categories[
                            category
                        ]?.length

                ),

                ...Object.keys(
                    categories
                )
                    .filter(

                        category =>
                            !categoryOrder.includes(
                                category
                            )

                    )

            ]


            /* ─────────────────────────────
               SECCIONES
            ───────────────────────────── */

            for (
                const category
                of orderedCategories
            ) {

                const cmds =
                    categories[
                        category
                    ]


                if (
                    !cmds?.length
                ) {

                    continue

                }


                const config =
                    categoryConfig[
                        category
                    ]

                    ||

                    {

                        emoji:
                            '📁',

                        label:
                            category
                                .charAt(0)
                                .toUpperCase()

                            +

                            category
                                .slice(1)

                    }


                text += [

                    '',

                    `ㅤ۟∩　ׅ　${config.emoji}　ׅ　*${config.label}*　ׄᰙ`,

                    '',

                    ...cmds.map(

                        command =>
                            `𖣣ֶㅤ֯⌗ ✦  ׄ ⬭ .${command.name}`

                    ),

                    '',

                    '━━━━━━━━━━━━━━━━━━━━━━━━━━'

                ]
                    .join('\n')

            }


            /* ─────────────────────────────
               FOOTER
            ───────────────────────────── */

            text += [

                '',

                '╰─ 𓂃 Powered by Kenny',

                `╰─ 𓂃 ${botName}`

            ]
                .join('\n')


            /* ─────────────────────────────
               ENVIAR
            ───────────────────────────── */

            await sock.safeSendMessage(

                from,

                {
                    text
                }

            )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Menu consultado | comandos=${total} | categorias=${orderedCategories.length}`

            )


        } catch (err) {

            logger.error(

                `Error menu: ${err.stack || err.message}`

            )


            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            '❌ No se pudo cargar el menú.'

                    }

                )

            } catch {}

        }

    }

}
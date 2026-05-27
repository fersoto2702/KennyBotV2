const os =
    require('os')

const comandos =
    require('../src/utils/commandRegistry')

const ui =
    require('../src/utils/ui')

// =========================
// CATEGORY CONFIG
// =========================

const categoryConfig = {

    admin: {

        emoji: '🛡',
        label: 'Admin'

    },

    configuración: {

        emoji: '⚙',
        label: 'Configuración'

    },

    descargas: {

        emoji: '⬇',
        label: 'Descargas'

    },

    economía: {

        emoji: '🪙',
        label: 'Economía'

    },

    grupos: {

        emoji: '👥',
        label: 'Grupos'

    },

    niveles: {

        emoji: '⭐',
        label: 'Niveles'

    },

    perfil: {

        emoji: '👤',
        label: 'Perfil'

    },

    bienvenida: {

        emoji: '👋',
        label: 'Bienvenida'

    },

    general: {

        emoji: '🤖',
        label: 'General'

    }

}

// =========================
// CATEGORY ORDER
// =========================

const categoryOrder = [

    'general',
    'descargas',
    'economía',
    'niveles',
    'perfil',
    'grupos',
    'bienvenida',
    'configuración',
    'admin'

]

// =========================
// FORMAT UPTIME
// =========================

const formatUptime = seconds => {

    const d =
        Math.floor(seconds / 86400)

    const h =
        Math.floor(seconds % 86400 / 3600)

    const m =
        Math.floor(seconds % 3600 / 60)

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

    cooldown: 5,

    async execute({

        sock,
        from,
        settings

    }) {

        try {

            // =========================
            // CATEGORIES
            // =========================

            const categories = {}

            for (
                const [key, command]
                of comandos
            ) {

                // evitar aliases
                if (
                    key !== command.name
                ) continue

                // ocultos
                if (
                    command.hidden
                ) continue

                const category =

                    (
                        command.category ||
                        'general'
                    ).toLowerCase()

                if (
                    !categories[category]
                ) {

                    categories[category] = []

                }

                categories[category].push(command)

            }

            // =========================
            // SORT COMMANDS
            // =========================

            for (
                const category
                in categories
            ) {

                categories[category].sort(

                    (a, b) =>

                        a.name.localeCompare(
                            b.name
                        )

                )

            }

            // =========================
            // TOTAL
            // =========================

            const total =

                [...comandos.entries()]
                    .filter(

                        ([key, cmd]) =>

                            key === cmd.name &&

                            !cmd.hidden

                    )
                    .length

            // =========================
            // GREETING
            // =========================

            const hour =
                new Date().getHours()

            const greeting =

                hour < 12

                    ? '🌅 Buenos días'

                    : hour < 18

                        ? '☀ Buenas tardes'

                        : '🌙 Buenas noches'

            // =========================
            // SYSTEM INFO
            // =========================

            const ramUsed =

                (
                    (
                        process.memoryUsage()
                            .heapUsed /

                        1024 /

                        1024
                    ).toFixed(2)
                )

            const uptime =

                formatUptime(
                    process.uptime()
                )

            // =========================
            // HEADER
            // =========================

            let text = [

                `╭─〔 🤖 ${settings.botName} 〕`,

                `│`,
                `│ ${greeting}`,
                `│`,
                `│ ⚡ Prefijos: /  .  #`,
                `│ 📦 Comandos: ${total}`,
                `│ ⏱ Uptime: ${uptime}`,
                `│ 🧠 RAM: ${ramUsed} MB`,
                `│ 💻 Node: ${process.version}`,
                `│`,
                `╰─────────────`

            ].join('\n')

            text += '\n\n'

            // =========================
            // ORDER
            // =========================

            const orderedCategories = [

                ...categoryOrder.filter(

                    c => categories[c]

                ),

                ...Object.keys(categories)
                    .filter(

                        c =>
                            !categoryOrder.includes(c)

                    )

            ]

            // =========================
            // BUILD
            // =========================

            for (
                const category
                of orderedCategories
            ) {

                const cmds =
                    categories[category]

                if (
                    !cmds ||
                    cmds.length === 0
                ) continue

                const config =

                    categoryConfig[category] ||

                    {

                        emoji: '📁',

                        label:

                            category.charAt(0)
                            .toUpperCase() +

                            category.slice(1)

                    }

                text +=
`╭─〔 ${config.emoji} ${config.label} 〕
│`

                for (
                    const cmd
                    of cmds
                ) {

                    const badges = []

                    if (cmd.adminOnly)
                        badges.push('👮')

                    if (cmd.ownerOnly)
                        badges.push('👑')

                    if (cmd.groupOnly)
                        badges.push('👥')

                    if (cmd.privateOnly)
                        badges.push('💬')

                    if (cmd.cooldown)
                        badges.push(`⏳${cmd.cooldown}`)

                    const aliasText =

                        cmd.aliases?.length

                            ? ` (${cmd.aliases.join(', ')})`

                            : ''

                    text +=
`\n│ ✦ /${cmd.name}${aliasText}
│   ↳ ${cmd.description || 'Sin descripción'}
│   ↳ ${badges.join(' ') || '—'}
│`

                }

                text += '\n╰─────────────\n\n'

            }

            // =========================
            // FOOTER
            // =========================

            text +=
`✨ Usa /comando
🔥 Compatible con:
/ . #

© ${settings.botName}`

            // =========================
            // SEND
            // =========================

            await sock.safeSendMessage(

                from,

                { text }

            )

        } catch (err) {

            console.log(err)

        }

    }

}
const os =
    require('os')

const comandos =
    require('../src/utils/commandRegistry')

const ui =
    require('../src/utils/ui')

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
    'admin'
]

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

            const categories = {}

            for (const [key, command] of comandos) {

                if (key !== command.name) continue
                if (command.hidden) continue

                const category =
                    (command.category || 'general').toLowerCase()

                if (!categories[category]) {
                    categories[category] = []
                }

                categories[category].push(command)

            }

            for (const category in categories) {

                categories[category].sort(
                    (a, b) =>
                        a.name.localeCompare(b.name)
                )

            }

            const total =
                [...comandos.entries()]
                    .filter(
                        ([key, cmd]) =>
                            key === cmd.name &&
                            !cmd.hidden
                    )
                    .length

            const hour =
                new Date().getHours()

            const greeting =
                hour < 12
                    ? '🌅 Buenos días'
                : hour < 18
                    ? '☀ Buenas tardes'
                    : '🌙 Buenas noches'

            const ramUsed =
                (
                    process.memoryUsage()
                        .heapUsed /
                    1024 /
                    1024
                ).toFixed(2)

            const uptime =
                formatUptime(process.uptime())

        let text =

`୨୧ ─────────── ୨୧

⌗ 𝐊𝐄𝐍𝐍𝐘𝐁𝐎𝐓 𝐕𝟐

✦ ${greeting}
✦ 𝐏𝐫𝐞𝐟𝐢𝐣𝐨𝐬: / . #
✦ 𝐂𝐨𝐦𝐚𝐧𝐝𝐨𝐬: ${total}
✦ 𝐔𝐩𝐭𝐢𝐦𝐞: ${uptime}
✦ 𝐑𝐀𝐌: ${ramUsed} MB
✦ 𝐍𝐨𝐝𝐞: ${process.version}

୨୧ ─────────── ୨୧
`

const orderedCategories = [
    ...categoryOrder.filter(c => categories[c]),
    ...Object.keys(categories).filter(
        c => !categoryOrder.includes(c)
    )
]

for (const category of orderedCategories) {

    const cmds =
        categories[category]

    if (!cmds?.length) continue

    const config =
        categoryConfig[category] ||
        {
            emoji: '📁',
            label:
                category.charAt(0).toUpperCase() +
                category.slice(1)
        }

    text +=

`\n⌗ ${config.label} [${cmds.length}]\n\n`

    for (const cmd of cmds) {

        text +=
`✦ .${cmd.name}\n`

    }

    text += '\n'

}

text +=

`୨୧ ─────────── ୨୧

✧ 𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐊𝐞𝐧𝐧𝐲
✧ ${settings.botName}

୨୧ ─────────── ୨୧`

            await sock.safeSendMessage(
                from,
                { text }
            )

        } catch (err) {

            console.log(err)

        }

    }

}
const fs =

    require('fs')



const path =

    require('path')



const comandos =

    require('../src/utils/commandRegistry')



const logger =

    require('../src/utils/logger')



const categoryConfigDefault = {



    general: {

        emoji:

            '🤖',

        label:

            '𝐆𝐄𝐍𝐄𝐑𝐀𝐋'

    },



    descargas: {

        emoji:

            '⬇️',

        label:

            '𝐃𝐄𝐒𝐂𝐀𝐑𝐆𝐀𝐒'

    },



    diversión: {

        emoji:

            '🎭',

        label:

            '𝐃𝐈𝐕𝐄𝐑𝐒𝐈𝐎𝐍'

    },



    'ultimate team': {

        emoji:

            '⚽',

        label:

            '𝐔𝐋𝐓𝐈𝐌𝐀𝐓𝐄 𝐓𝐄𝐀𝐌'

    },



    economia: {

        emoji:

            '🪙',

        label:

            '𝐄𝐂𝐎𝐍𝐎𝐌𝐈𝐀'

    },



    economía: {

        emoji:

            '🪙',

        label:

            '𝐄𝐂𝐎𝐍𝐎𝐌𝐈𝐀'

    },



    niveles: {

        emoji:

            '⭐',

        label:

            '𝐍𝐈𝐕𝐄𝐋𝐄𝐒'

    },



    perfil: {

        emoji:

            '👤',

        label:

            '𝐏𝐄𝐑𝐅𝐈𝐋'

    },



    grupos: {

        emoji:

            '👥',

        label:

            '𝐆𝐑𝐔𝐏𝐎𝐒'

    },



    bienvenida: {

        emoji:

            '👋',

        label:

            '𝐁𝐈𝐄𝐍𝐕𝐄𝐍𝐈𝐃𝐀'

    },



    configuracion: {

        emoji:

            '⚙️',

        label:

            '𝐂𝐎𝐍𝐅𝐈𝐆𝐔𝐑𝐀𝐂𝐈𝐎𝐍'

    },



    configuración: {

        emoji:

            '⚙️',

        label:

            '𝐂𝐎𝐍𝐅𝐈𝐆𝐔𝐑𝐀𝐂𝐈𝐎𝐍'

    },



    admin: {

        emoji:

            '🛡️',

        label:

            '𝐀𝐃𝐌𝐈𝐍'

    },



    owner: {

        emoji:

            '👑',

        label:

            '𝐎𝐖𝐍𝐄𝐑'

    }



}



const categoryConfigBrazil = {



    general: {

        emoji:

            '🤖',

        label:

            '𝐆𝐄𝐑𝐀𝐋'

    },



    descargas: {

        emoji:

            '⬇️',

        label:

            '𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐒'

    },



    diversión: {

        emoji:

            '🎭',

        label:

            '𝐃𝐈𝐕𝐄𝐑𝐒𝐀̃𝐎'

    },



    'ultimate team': {

        emoji:

            '⚽',

        label:

            '𝐔𝐋𝐓𝐈𝐌𝐀𝐓𝐄 𝐓𝐄𝐀𝐌'

    },



    economia: {

        emoji:

            '🪙',

        label:

            '𝐄𝐂𝐎𝐍𝐎𝐌𝐈𝐀'

    },



    economía: {

        emoji:

            '🪙',

        label:

            '𝐄𝐂𝐎𝐍𝐎𝐌𝐈𝐀'

    },



    niveles: {

        emoji:

            '⭐',

        label:

            '𝐍𝐈𝐕𝐄𝐈𝐒'

    },



    perfil: {

        emoji:

            '👤',

        label:

            '𝐏𝐄𝐑𝐅𝐈𝐋'

    },



    grupos: {

        emoji:

            '👥',

        label:

            '𝐆𝐑𝐔𝐏𝐎𝐒'

    },



    bienvenida: {

        emoji:

            '👋',

        label:

            '𝐁𝐎𝐀𝐒-𝐕𝐈𝐍𝐃𝐀𝐒'

    },



    configuracion: {

        emoji:

            '⚙️',

        label:

            '𝐂𝐎𝐍𝐅𝐈𝐆𝐔𝐑𝐀𝐂𝐀𝐎'

    },



    configuración: {

        emoji:

            '⚙️',

        label:

            '𝐂𝐎𝐍𝐅𝐈𝐆𝐔𝐑𝐀𝐂𝐀𝐎'

    },



    admin: {

        emoji:

            '🛡️',

        label:

            '𝐀𝐃𝐌𝐈𝐍'

    },



    owner: {

        emoji:

            '👑',

        label:

            '𝐎𝐖𝐍𝐄𝐑'

    }



}



const categoryOrder = [



    'general',



    'descargas',



    'diversión',



    'ultimate team',



    'economia',



    'economía',



    'niveles',



    'perfil',



    'grupos',



    'bienvenida',



    'configuracion',



    'configuración',



    'admin',



    'owner'



]



function normalizeCategory(

    value

) {

    const category =

        String(

            value ||

            'general'

        )

            .toLowerCase()

            .trim()



    const aliases = {

        diversion:

            'diversión',

        diversao:

            'diversión',

        diversão:

            'diversión',

        'ultimate_team':

            'ultimate team',

        'ultimate-team':

            'ultimate team',

        ultimateteam:

            'ultimate team'

    }



    return (

        aliases[category] ||

        category

    )

}



function formatUptime(

    seconds

) {



    const d =

        Math.floor(

            seconds /

            86400

        )



    const h =

        Math.floor(

            (

                seconds %

                86400

            ) /

            3600

        )



    const m =

        Math.floor(

            (

                seconds %

                3600

            ) /

            60

        )



    const s =

        Math.floor(

            seconds %

            60

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

            value ??

            ''

        )

            .trim()



    return text ||

        fallback



}



function getProfile(

    sock,

    settings

) {



    return (

        sock?.botProfile ||

        settings?.bots?.main ||

        {

            id:

                'main',



            name:

                settings?.botName ||

                'KennyBot',



            flag:

                '🇲🇽',



            slogan:

                'Tu asistente para WhatsApp.',



            menuStyle:

                'default',



            menuImage:

                null

        }

    )



}



function isBrazilProfile(

    profile

) {



    return (

        String(

            profile?.id ||

            ''

        )

            .trim()

            .toLowerCase() ===

        'brazil'

    )



}



function getGreeting(

    brazil

) {



    const hour =

        new Date()

            .getHours()



    if (

        brazil

    ) {



        if (

            hour <

            12

        ) {



            return 'Bom dia'



        }



        if (

            hour <

            18

        ) {



            return 'Boa tarde'



        }



        return 'Boa noite'



    }



    if (

        hour <

        12

    ) {



        return 'Buenos días'



    }



    if (

        hour <

        18

    ) {



        return 'Buenas tardes'



    }



    return 'Buenas noches'



}



function getMaintenanceSet(

    settings

) {



    return new Set(

        (

            Array.isArray(

                settings?.maintenanceCommands

            )

                ? settings.maintenanceCommands

                : []

        )

            .map(

                command =>

                    String(

                        command ||

                        ''

                    )

                        .trim()

                        .toLowerCase()

            )

            .filter(Boolean)

    )



}



function getPrefixes(

    settings

) {



    const prefixes =

        Array.isArray(

            settings?.prefixes

        )

            ? settings.prefixes

            : []



    if (

        prefixes.length ===

        0

    ) {



        return '/'



    }



    return prefixes.join(

        ' '

    )



}



function getPrimaryPrefix(

    settings

) {



    const prefixes =

        Array.isArray(

            settings?.prefixes

        )

            ? settings.prefixes

            : []



    return (

        prefixes[0] ||

        '.'

    )



}



function getMenuImagePath(

    profile

) {



    const raw =

        String(

            profile?.menuImage ||

            ''

        )

            .trim()



    if (!raw) {



        return null



    }



    const resolved =

        path.isAbsolute(

            raw

        )

            ? raw

            : path.resolve(

                process.cwd(),

                raw

            )



    if (

        !fs.existsSync(

            resolved

        )

    ) {



        return null



    }



    return resolved



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

async execute({



        sock,



        from,



        settings = {},



        botProfile = null



    }) {



        try {



            const profile =

                botProfile ||

                getProfile(

                    sock,

                    settings

                )



            const brazil =

                isBrazilProfile(

                    profile

                )



            const categoryConfig =

                brazil

                    ? categoryConfigBrazil

                    : categoryConfigDefault



            const categories =

                {}



            for (

                const [

                    key,

                    command

                ]

                of comandos

            ) {



                if (

                    !command ||

                    typeof command !==

                    'object'

                ) {



                    continue



                }



                if (

                    key !==

                    command.name

                ) {



                    continue



                }



                if (

                    command.hidden

                ) {



                    continue



                }



                const category =

                    normalizeCategory(

                        command.category

                    )



                if (

                    !categories[

                        category

                    ]

                ) {



                    categories[

                        category

                    ] =

                        []



                }



                categories[

                    category

                ]

                    .push(

                        command

                    )



            }



            for (

                const category

                in categories

            ) {



                categories[

                    category

                ]

                    .sort(

                        (

                            a,

                            b

                        ) =>

                            String(

                                a.name

                            )

                                .localeCompare(

                                    String(

                                        b.name

                                    ),

                                    brazil

                                        ? 'pt-BR'

                                        : 'es',

                                    {

                                        sensitivity:

                                            'base'

                                    }

                                )

                    )



            }



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



            const maintenance =

                getMaintenanceSet(

                    settings

                )



            const maintenanceCount =

                [

                    ...comandos.values()

                ]

                    .filter(

                        command =>

                            command &&

                            typeof command ===

                            'object' &&

                            command.name &&

                            maintenance.has(

                                String(

                                    command.name

                                )

                                    .toLowerCase()

                            )

                    )

                    .length



            const greeting =

                getGreeting(

                    brazil

                )



            const memory =

                process.memoryUsage()



            const ramUsed =

                (

                    memory.heapUsed /

                    1024 /

                    1024

                )

                    .toFixed(

                        2

                    )



            const ramTotal =

                (

                    memory.heapTotal /

                    1024 /

                    1024

                )

                    .toFixed(

                        2

                    )



            const uptime =

                formatUptime(

                    process.uptime()

                )



            const botName =

                safeText(

                    profile?.name,

                    settings?.botName ||

                    'KennyBot'

                )



            const flag =

                safeText(

                    profile?.flag,

                    brazil

                        ? '🇧🇷'

                        : '🇲🇽'

                )



            const slogan =

                brazil

                    ? 'Golden Empire Bot'

                    : safeText(

                        profile?.slogan,

                        'Tu asistente para WhatsApp.'

                    )



            const prefixes =

                getPrefixes(

                    settings

                )



            const primaryPrefix =

                getPrimaryPrefix(

                    settings

                )



            let text =

                [

                    `ㅤ۟∩　ׅ　🤖　ׅ　*${botName.toUpperCase()}*　ׄᰙ`,

                    '',

                    `𖣣ֶㅤ֯⌗ ${flag}  ׄ ⬭ *${brazil ? 'Região' : 'Región'}:* ${brazil ? 'Brasil' : 'México'}`,

                    `𖣣ֶㅤ֯⌗ 👑  ׄ ⬭ *${brazil ? 'Identidade' : 'Identidad'}:* ${slogan}`,

                    `𖣣ֶㅤ֯⌗ 🌅  ׄ ⬭ *${brazil ? 'Saudação' : 'Saludo'}:* ${greeting}`,

                    `𖣣ֶㅤ֯⌗ ⌨️  ׄ ⬭ *${brazil ? 'Prefixos' : 'Prefijos'}:* ${prefixes}`,

                    `𖣣ֶㅤ֯⌗ 📚  ׄ ⬭ *${brazil ? 'Comandos' : 'Comandos'}:* ${total}`,

                    `𖣣ֶㅤ֯⌗ 🛠️  ׄ ⬭ *${brazil ? 'Em manutenção' : 'En mantenimiento'}:* ${maintenanceCount}`,

                    `𖣣ֶㅤ֯⌗ ⏱️  ׄ ⬭ *Uptime:* ${uptime}`,

                    `𖣣ֶㅤ֯⌗ 🧠  ׄ ⬭ *RAM:* ${ramUsed} / ${ramTotal} MB`,

                    `𖣣ֶㅤ֯⌗ 🟢  ׄ ⬭ *Node:* ${process.version}`,

                    '',

                    '━━━━━━━━━━━━━━━━━━━━━━━━━━'

                ]

                    .join(

                        '\n'

                    )



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



            const seenCategories =

                new Set()



            for (

                const category

                of orderedCategories

            ) {



                if (

                    seenCategories.has(

                        category

                    )

                ) {



                    continue



                }



                seenCategories.add(

                    category

                )



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

                                .charAt(

                                    0

                                )

                                .toUpperCase()

                            +

                            category

                                .slice(

                                    1

                                )

                    }



                const commandLines =

                    cmds.map(

                        command => {



                            const commandName =

                                String(

                                    command.name ||

                                    ''

                                )

                                    .trim()



                            const maintenanceMode =

                                maintenance.has(

                                    commandName.toLowerCase()

                                )



                            if (

                                maintenanceMode

                            ) {



                                return (

                                    `𖣣ֶㅤ֯⌗ 🛠️  ׄ ⬭ ${primaryPrefix}${commandName} — ` +

                                    (

                                        brazil

                                            ? 'manutenção'

                                            : 'mantenimiento'

                                    )

                                )



                            }



                            return `𖣣ֶㅤ֯⌗ ✦  ׄ ⬭ ${primaryPrefix}${commandName}`



                        }

                    )



                text += [

                    '',

                    `ㅤ۟∩　ׅ　${config.emoji}　ׅ　*${config.label}*　ׄᰙ`,

                    '',

                    ...commandLines,

                    '',

                    '━━━━━━━━━━━━━━━━━━━━━━━━━━'

                ]

                    .join(

                        '\n'

                    )



            }



            text += [

                '',

                brazil

                    ? '╰─ 𓂃 ( 🇧🇷 )　𝖦𝖮𝖫𝖣𝖤𝖭　⌗　𝖤𝖬𝖯𝖨𝖱𝖤　˖'

                    : `╰─ 𓂃 ${flag} ${botName}`

            ]

                .join(

                    '\n'

                )



            const menuImage =

                getMenuImagePath(

                    profile

                )



            if (

                menuImage

            ) {



                await sock.safeSendMessage(

                    from,

                    {

                        image:

                            {

                                url:

                                    menuImage

                            },



                        caption:

                            text

                    }

                )



            } else {



                await sock.safeSendMessage(

                    from,

                    {

                        text

                    }

                )



            }



            logger.event(

                `${botName} | Menu consultado | comandos=${total} | mantenimiento=${maintenanceCount} | categorias=${orderedCategories.length}`

            )



            return true



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



            return false



        }



    }



}
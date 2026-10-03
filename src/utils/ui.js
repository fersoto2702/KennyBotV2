const LINE =
    '𓂃 𓂃 𓂃 𓂃 𓂃 𓂃 𓂃 𓂃'

const DLINE =
    '━━━━━━━━━━━━━━━━━━━━━━━━'


const safe = value =>
    String(value ?? '').trim()


/* ─────────────────────────────
   HEADER GENERAL
───────────────────────────── */

function header(
    title,
    icon = '𖤐'
) {

    return [
        `ㅤ۟${icon}　ׅ　*${safe(title)}*　ׄ𓂃`,
        ''
    ].join('\n')

}


/* ─────────────────────────────
   SUBHEADER
───────────────────────────── */

function subheader(
    label,
    icon = '⌗'
) {

    return (
        `𖣣ֶㅤ֯${icon}  ׄ  ${safe(label)}`
    )

}


/* ─────────────────────────────
   CAMPOS
───────────────────────────── */

function field(
    key,
    value
) {

    return (
        `𖣣ֶㅤ֯⌗ ⟡  ׄ ⬭ *${safe(key)}:* ${safe(value)}`
    )

}


/* ─────────────────────────────
   LISTAS
───────────────────────────── */

function list(
    items = [],
    prefix = '𖣣ֶㅤ֯⌗'
) {

    if (!Array.isArray(items))
        return ''

    return items.map(item => {

        const name =
            safe(item?.name)

        const desc =
            safe(item?.desc)

        const aliases =
            Array.isArray(item?.aliases)
                ? item.aliases
                : []

        const badges =
            Array.isArray(item?.badges)
                ? item.badges
                : []

        const badgeText =
            badges.length
                ? `  ‹ ${badges.join(' · ')} ›`
                : ''

        let line =
            `${prefix} ✦  ׄ ⬭ *${name}*${badgeText}`

        if (desc) {

            line +=
                `\nㅤ╰─ 𓂃 ${desc}`

        }

        if (aliases.length) {

            line +=
                `\nㅤ╰─ 𓂃 *Aliases:* ${aliases.join(', ')}`

        }

        return line

    }).join('\n')

}


/* ─────────────────────────────
   SECCIONES DEL MENÚ
───────────────────────────── */

function section(
    label,
    emoji,
    items = []
) {

    return [

        `ㅤ۟∩　ׅ　${safe(emoji)}　ׅ　*${safe(label).toUpperCase()}*`,
        `ㅤׄ⌗ ${items.length} comandos`,
        '',

        list(items),

        ''

    ].join('\n')

}


/* ─────────────────────────────
   SUCCESS
───────────────────────────── */

function success(
    title,
    fields = [],
    footer = ''
) {

    const lines = [

        `ㅤ۟∩　ׅ　✓　ׅ　*${safe(title)}*　ׄᰙ`,
        ''

    ]

    if (Array.isArray(fields)) {

        fields.forEach(
            ([key, value], index) => {

                const icons = [
                    '✦',
                    '❖',
                    '♛',
                    'ꕥ',
                    '☆'
                ]

                const icon =
                    icons[index % icons.length]

                lines.push(
                    `𖣣ֶㅤ֯⌗ ${icon}  ׄ ⬭ *${safe(key)}:* ${safe(value)}`
                )

            }
        )

    }

    if (footer) {

        lines.push('')
        lines.push(
            `╰─ 𓂃 ${safe(footer)}`
        )

    }

    return lines.join('\n')

}


/* ─────────────────────────────
   ERROR
───────────────────────────── */

function error(
    title,
    detail = ''
) {

    const lines = [

        `ㅤ۟∩　ׅ　✕　ׅ　*${safe(title)}*　ׄᰙ`

    ]

    if (detail) {

        lines.push('')
        lines.push(
            `𖣣ֶㅤ֯⌗ ⚠  ׄ ⬭ ${safe(detail)}`
        )

    }

    return lines.join('\n')

}


/* ─────────────────────────────
   INFO
───────────────────────────── */

function info(
    title,
    fields = [],
    footer = ''
) {

    const lines = [

        `ㅤ۟∩　ׅ　◈　ׅ　*${safe(title)}*　ׄᰙ`,
        ''

    ]

    if (Array.isArray(fields)) {

        fields.forEach(
            ([key, value], index) => {

                const icons = [
                    '✎',
                    '⌁',
                    '⟡',
                    'ꕥ',
                    '☆'
                ]

                const icon =
                    icons[index % icons.length]

                lines.push(
                    `𖣣ֶㅤ֯⌗ ${icon}  ׄ ⬭ *${safe(key)}:* ${safe(value)}`
                )

            }
        )

    }

    if (footer) {

        lines.push('')
        lines.push(
            `╰─ 𓂃 ${safe(footer)}`
        )

    }

    return lines.join('\n')

}


/* ─────────────────────────────
   WARNING
───────────────────────────── */

function warn(
    title,
    detail = ''
) {

    const lines = [

        `ㅤ۟∩　ׅ　⚠　ׅ　*${safe(title)}*　ׄᰙ`

    ]

    if (detail) {

        lines.push('')
        lines.push(
            `𖣣ֶㅤ֯⌗ ◇  ׄ ⬭ ${safe(detail)}`
        )

    }

    return lines.join('\n')

}


/* ─────────────────────────────
   MENU HEADER
───────────────────────────── */

function menuHeader(
    botName,
    greeting,
    prefix,
    total
) {

    return [

        `ㅤ۟∩　ׅ　𖤐　ׅ　*${safe(botName)}*　ׄᰙ`,
        '',
        `𖣣ֶㅤ֯⌗ ♡  ׄ ⬭ ${safe(greeting)}`,
        `𖣣ֶㅤ֯⌗ ⌁  ׄ ⬭ *Prefijo:* ${safe(prefix)}`,
        `𖣣ֶㅤ֯⌗ ✦  ׄ ⬭ *Comandos:* ${safe(total)}`,
        ''

    ].join('\n')

}


/* ─────────────────────────────
   MENU FOOTER
───────────────────────────── */

function menuFooter(
    prefix
) {

    return [

        '',
        `╰─ 𓂃 💡 Usa *${safe(prefix)}help <comando>*`,
        `ㅤ   para obtener más información.`

    ].join('\n')

}


module.exports = {

    header,
    subheader,
    field,
    list,
    section,

    success,
    error,
    info,
    warn,

    menuHeader,
    menuFooter,

    divider: LINE,
    doubleDivider: DLINE,

}
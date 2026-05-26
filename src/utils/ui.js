const LINE =
    '────────────────────────'

const DLINE =
    '━━━━━━━━━━━━━━━━━━━━━━━━'

// =========================
// SAFE STRING
// =========================

const safe = value =>

    String(value ?? '')
        .trim()

// =========================
// HEADER
// =========================

function header(

    title,
    icon = '⟨',
    close = '⟩'

) {

    return [

        `${icon} ${safe(title)} ${close}`,

        LINE

    ].join('\n')

}

// =========================
// SUBHEADER
// =========================

function subheader(

    label,
    icon = '▸'

) {

    return `${icon} ${safe(label)}`

}

// =========================
// FIELD
// =========================

function field(

    key,
    value,
    pad = 10

) {

    const padded =

        safe(key)
            .padEnd(pad, ' ')

    return `${padded} ${safe(value)}`

}

// =========================
// LIST
// =========================

function list(

    items = [],
    prefix = '│'

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

                ? ` ‹ ${badges.join(' · ')} ›`

                : ''

        let line =
            `${prefix} *${name}*${badgeText}`

        // =========================
        // DESCRIPTION
        // =========================

        if (desc) {

            line +=
                `\n${prefix}  ↳ ${desc}`

        }

        // =========================
        // ALIASES
        // =========================

        if (aliases.length) {

            line +=

                `\n${prefix}  ↳ Aliases: ${aliases.join(', ')}`

        }

        return line

    }).join('\n')

}

// =========================
// SECTION
// =========================

function section(

    label,
    emoji,
    items = []

) {

    return [

        `┌─「 ${safe(emoji)} ${safe(label).toUpperCase()} 」─ ${items.length} cmds`,

        list(items),

        `└${LINE}`

    ].join('\n')

}

// =========================
// SUCCESS
// =========================

function success(

    title,
    fields = [],
    footer = ''

) {

    const lines = [

        `▓ ${safe(title)}`,

        LINE

    ]

    // =========================
    // FIELDS
    // =========================

    if (Array.isArray(fields)) {

        lines.push(

            ...fields.map(

                ([k, v]) =>

                    field(k, v)

            )

        )

    }

    // =========================
    // FOOTER
    // =========================

    if (fields.length) {

        lines.push(LINE)

    }

    if (footer) {

        lines.push(
            safe(footer)
        )

    }

    return lines.join('\n')

}

// =========================
// ERROR
// =========================

function error(

    title,
    detail = ''

) {

    const lines = [

        `⚠ ${safe(title)}`

    ]

    if (detail) {

        lines.push(
            LINE
        )

        lines.push(
            safe(detail)
        )

    }

    return lines.join('\n')

}

// =========================
// INFO
// =========================

function info(

    title,
    fields = [],
    footer = ''

) {

    const lines = [

        `⟨ ${safe(title)} ⟩`,

        LINE

    ]

    if (Array.isArray(fields)) {

        lines.push(

            ...fields.map(

                ([k, v]) =>

                    field(k, v)

            )

        )

    }

    if (fields.length) {

        lines.push(
            LINE
        )

    }

    if (footer) {

        lines.push(
            safe(footer)
        )

    }

    return lines.join('\n')

}

// =========================
// WARN
// =========================

function warn(

    title,
    detail = ''

) {

    const lines = [

        `◈ ${safe(title)}`

    ]

    if (detail) {

        lines.push(
            LINE
        )

        lines.push(
            safe(detail)
        )

    }

    return lines.join('\n')

}

// =========================
// MENU HEADER
// =========================

function menuHeader(

    botName,
    greeting,
    prefix,
    total

) {

    return [

        `╔══════════════════════╗`,

        `  ${safe(botName)}`,

        `  ${safe(greeting)}`,

        `╚══════════════════════╝`,

        '',

        `⬡ Prefijo: *${safe(prefix)}*   Cmds: *${safe(total)}*`,

        DLINE

    ].join('\n')

}

// =========================
// MENU FOOTER
// =========================

function menuFooter(prefix) {

    return [

        DLINE,

        `💡 Usa *${safe(prefix)}help <comando>* para más info`

    ].join('\n')

}

// =========================
// EXPORTS
// =========================

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
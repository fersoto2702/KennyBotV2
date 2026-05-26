const fs = require('fs')
const path = require('path')
const chalk = require('chalk')

// =========================
// CONFIG
// =========================

const LOG_DIR =
    path.join(__dirname, '../../logs')

const LOG_FILE =
    path.join(LOG_DIR, 'latest.log')

const ENABLE_FILE_LOG =
    true

const ENABLE_DEBUG =
    process.env.DEBUG === 'true'

// =========================
// CREATE LOG DIR
// =========================

if (
    ENABLE_FILE_LOG &&
    !fs.existsSync(LOG_DIR)
) {

    fs.mkdirSync(LOG_DIR, {
        recursive: true
    })

}

// =========================
// COLORS
// =========================

const c = {

    primary:
        chalk.cyanBright,

    white:
        chalk.white,

    muted:
        chalk.gray,

    dim:
        chalk.gray,

}

// =========================
// TIMESTAMP
// =========================

const timestamp = () => {

    const d =
        new Date()

    const pad = n =>

        String(n)
            .padStart(2, '0')

    return `[${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}]`

}

// =========================
// FILE LOG
// =========================

const writeToFile = text => {

    try {

        if (!ENABLE_FILE_LOG)
            return

        fs.appendFileSync(
            LOG_FILE,
            text + '\n'
        )

    } catch {}

}

// =========================
// SEPARATOR
// =========================

const sep = (

    char = '─',
    len = 50

) =>

    c.muted(
        char.repeat(len)
    )

// =========================
// MAIN LOG
// =========================

const log = (

    icon,
    colorFn,
    label,
    text

) => {

    const time =
        timestamp()

    const consoleText =

        `  ${c.muted(time)} ${icon} ${colorFn(chalk.bold(` ${label} `))} ${c.white(String(text))}`

    const fileText =

        `${time} [${label}] ${String(text)}`

    console.log(consoleText)

    writeToFile(fileText)

}

// =========================
// LOGGER
// =========================

module.exports = {

    // =========================
    // BANNER
    // =========================

    banner(botName = 'Kenny Bot') {

        const lines = [

            '',

            c.primary('  ██╗  ██╗███████╗███╗   ██╗███╗   ██╗██╗   ██╗'),
            c.primary('  ██║ ██╔╝██╔════╝████╗  ██║████╗  ██║╚██╗ ██╔╝'),
            c.primary('  █████╔╝ █████╗  ██╔██╗ ██║██╔██╗ ██║ ╚████╔╝ '),
            c.primary('  ██╔═██╗ ██╔══╝  ██║╚██╗██║██║╚██╗██║  ╚██╔╝  '),
            c.primary('  ██║  ██╗███████╗██║ ╚████║██║ ╚████║   ██║   '),
            c.primary('  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚═══╝   ╚═╝   '),

            '',

            c.dim('  ') +
            chalk.bold(
                c.white(`✦ ${botName}`)
            ) +
            c.dim('  ·  WhatsApp Bot  ·  Baileys'),

            '',

            '  ' + sep('─', 48),

            ''

        ]

        console.log(
            lines.join('\n')
        )

    },

    // =========================
    // STATUS TABLE
    // =========================

    statusTable(data = {}) {

        const rows =
            Object.entries(data)

        if (rows.length === 0)
            return

        const maxKey =
            Math.max(
                ...rows.map(
                    ([k]) => k.length
                )
            )

        console.log('')

        rows.forEach(([key, val]) => {

            console.log(

                `  ${c.muted('│')} ${c.dim(key.padEnd(maxKey))}  ${c.primary('→')}  ${c.white(String(val))}  ${c.muted('│')}`

            )

        })

        console.log('')

    },

    // =========================
    // SEPARATOR
    // =========================

    separator() {

        console.log(
            '  ' + sep()
        )

    },

    // =========================
    // SUCCESS
    // =========================

    success(text) {

        log(
            '✅',
            chalk.bgGreen.black,
            'OK',
            text
        )

    },

    // =========================
    // ERROR
    // =========================

    error(text) {

        log(
            '❌',
            chalk.bgRed.white,
            'ERROR',
            text
        )

    },

    // =========================
    // INFO
    // =========================

    info(text) {

        log(
            'ℹ️',
            chalk.bgBlue.white,
            'INFO',
            text
        )

    },

    // =========================
    // WARN
    // =========================

    warn(text) {

        log(
            '⚠️',
            chalk.bgYellow.black,
            'WARN',
            text
        )

    },

    // =========================
    // EVENT
    // =========================

    event(text) {

        log(
            '📩',
            chalk.bgMagenta.white,
            'EVENT',
            text
        )

    },

    // =========================
    // COMMAND
    // =========================

    cmd(text) {

        log(
            '⚡',
            chalk.bgCyan.black,
            'CMD',
            text
        )

    },

    // =========================
    // DEBUG
    // =========================

    debug(text) {

        if (!ENABLE_DEBUG)
            return

        log(
            '🐛',
            chalk.bgGray.white,
            'DEBUG',
            text
        )

    },

    // =========================
    // QR
    // =========================

    qr() {

        console.log('')

        console.log(
            '  ' + sep('─', 48)
        )

        console.log(

            `  ${chalk.yellow.bold('▸ ESCANEA EL QR CODE')}`

        )

        console.log(
            '  ' + sep('─', 48)
        )

        console.log('')

    }

}
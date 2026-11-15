/*
 * API del panel de KennyBot.
 *
 * Sirve los datos que el panel (React) lee y recibe sus acciones.
 * No necesita instalar nada: usa el módulo http de Node.
 *
 * ─────────────────────────────────────────────
 * Uso en tu index.js (después de crear el socket):
 *
 *     const { pool } = require('./database/mysql')      // ajusta la ruta
 *     const startPanelApi = require('./panel-api')
 *
 *     startPanelApi({
 *         pool,
 *         token: process.env.PANEL_TOKEN,
 *         origin: process.env.PANEL_ORIGIN,              // ej. https://tuweb.com
 *         getSock: () => sock,
 *         commandsDir: path.join(__dirname, 'comandos'),
 *
 *         hooks: {
 *             reload:  async () => { ... hot reload ... },
 *             restart: async () => { ... },
 *         }
 *     })
 *
 * Todos los hooks son opcionales. Si falta uno, esa acción
 * responde 501 y el panel lo muestra como error claro.
 * ─────────────────────────────────────────────
 *
 * IMPORTANTE: este servidor puede reiniciar tu bot.
 * Por eso exige un token en cada petición (Authorization: Bearer ...).
 * Genera uno largo, por ejemplo:
 *
 *     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * y guárdalo en tu .env como PANEL_TOKEN. Nunca lo pongas en el código.
 */

const http = require('http')
const os = require('os')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')


/* Nombre visible de cada carpeta de /comandos en el panel */
const FOLDER_LABELS = {
    admin: 'Admin',
    config: 'Configuración',
    diversion: 'Diversión',
    downloads: 'Descargas',
    economy: 'Economía',
    general: 'General',
    grupos: 'Grupos',
    levels: 'Niveles',
    premium: 'Premium',
    profile: 'Perfil',
    welcome: 'Bienvenida'
}


/* Archivos sueltos en la raíz de /comandos que pertenecen al sistema de cartas */
const CARD_COMMANDS = [
    'card',
    'cardinfo',
    'claim',
    'collection',
    'equip',
    'events',
    'myclub',
    'objectives',
    'openpack',
    'packs',
    'pick'
]


function scanCommands(root, isEnabled) {
    const out = []

    const add = (file, cat, folder) => {
        if (path.extname(file) !== '.js') {
            return
        }

        const name = path.basename(file, '.js')

        out.push({
            name,
            cat,
            folder,
            uses: 0,
            on: isEnabled ? isEnabled(name) !== false : true
        })
    }

    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            for (const file of fs.readdirSync(path.join(root, entry.name))) {
                add(file, FOLDER_LABELS[entry.name] || entry.name, entry.name)
            }
        } else {
            add(
                entry.name,
                CARD_COMMANDS.includes(path.basename(entry.name, '.js')) ? 'Cartas' : 'Utilidad',
                '(raíz)'
            )
        }
    }

    return out
}


const DAY_NAMES = [
    'Dom',
    'Lun',
    'Mar',
    'Mié',
    'Jue',
    'Vie',
    'Sáb'
]


/*
 * Tu registerMessage guarda la fecha en UTC (toISOString),
 * así que aquí también contamos los días en UTC para que coincidan.
 */
function utcDay(offset = 0) {
    const d = new Date()

    d.setUTCDate(d.getUTCDate() - offset)

    return d.toISOString().split('T')[0]
}


function mask(jid = '') {
    const number = String(jid).split('@')[0]

    return number.length > 4
        ? `+…${number.slice(-4)}`
        : number
}


function safeEqual(a, b) {
    const x = Buffer.from(String(a))
    const y = Buffer.from(String(b))

    return x.length === y.length
        && crypto.timingSafeEqual(x, y)
}


function startPanelApi({
    pool,
    token,
    origin,
    getSock = () => null,
    commandsDir,
    hooks = {},
    stateFile = null,
    port = Number(process.env.PANEL_PORT) || 4000,
    host = process.env.PANEL_HOST || '127.0.0.1',
    logger = console
}) {
    if (!token || token.length < 16) {
        throw new Error(
            'PANEL_TOKEN falta o es muy corto (mínimo 16 caracteres). ' +
            'El panel puede reiniciar el bot, así que no se inicia sin token.'
        )
    }

    const startedAt = Date.now()


    /* ───────── CPU (porcentaje real del proceso) ───────── */

    let cpuPct = 0
    let lastCpu = process.cpuUsage()
    let lastTime = Date.now()

    setInterval(() => {
        const now = Date.now()
        const usage = process.cpuUsage(lastCpu)

        const busy = (usage.user + usage.system) / 1000
        const wall = now - lastTime

        cpuPct = Math.min(
            100,
            Math.round(busy / wall / os.cpus().length * 100)
        )

        lastCpu = process.cpuUsage()
        lastTime = now
    }, 3000).unref()


    /* ───────── etiquetas del tablero de grupos (solo del panel) ───────── */

    function readState() {
        try {
            if (stateFile && fs.existsSync(stateFile)) {
                return JSON.parse(fs.readFileSync(stateFile, 'utf8'))
            }
        } catch (err) {
            logger.error?.(`Panel API: no pude leer ${stateFile}: ${err.message}`)
        }

        return {}
    }


    function saveGroupStatus(jid, status) {
        if (!stateFile) {
            const err = new Error('Acción no disponible: falta la opción "stateFile" en startPanelApi')

            err.code = 501

            throw err
        }

        if (![ 'active', 'watch', 'muted' ].includes(status)) {
            throw new Error('Estado de grupo inválido')
        }

        fs.mkdirSync(path.dirname(stateFile), { recursive: true })

        const state = readState()

        state.groups = state.groups || {}
        state.groups[jid] = { ...(state.groups[jid] || {}), status }

        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8')
    }


    /* ───────── nombres de grupos (con caché de 60 s) ───────── */

    let groupCache = { at: 0, map: {} }

    async function groupInfo() {
        if (Date.now() - groupCache.at < 60000) {
            return groupCache.map
        }

        try {
            const sock = getSock()

            if (sock?.groupFetchAllParticipating) {
                const all = await sock.groupFetchAllParticipating()

                groupCache = {
                    at: Date.now(),
                    map: Object.fromEntries(
                        Object.values(all).map(g => [
                            g.id,
                            {
                                name: g.subject,
                                size: g.participants?.length || 0
                            }
                        ])
                    )
                }
            }
        } catch (err) {
            logger.error?.(`Panel API: no pude leer los grupos: ${err.message}`)
        }

        return groupCache.map
    }


    /* ───────── consultas a MySQL ───────── */

    async function dbPing() {
        const t = Date.now()

        await pool.execute('SELECT 1')

        return Date.now() - t
    }


    async function range(days, labelFn) {
        const start = utcDay(days - 1)

        const [rows] = await pool.execute(`
            SELECT
                DATE_FORMAT(fecha, '%Y-%m-%d') AS d,
                SUM(cantidad) AS total
            FROM mensajes
            WHERE fecha >= ?
            GROUP BY fecha
        `, [
            start
        ])

        const byDay = Object.fromEntries(
            rows.map(r => [ r.d, Number(r.total) ])
        )

        const labels = []
        const msgs = []

        for (let i = days - 1; i >= 0; i--) {
            const day = utcDay(i)

            labels.push(labelFn(day))
            msgs.push(byDay[day] || 0)
        }

        return {
            labels,
            msgs
        }
    }


    async function groups() {
        const today = utcDay(0)

        const [rows] = await pool.execute(`
            SELECT
                grupo,
                SUM(cantidad) AS total,
                SUM(CASE WHEN fecha = ? THEN cantidad ELSE 0 END) AS hoy,
                COUNT(DISTINCT usuario) AS vistos
            FROM mensajes
            GROUP BY grupo
            ORDER BY hoy DESC, total DESC
        `, [
            today
        ])

        const info = await groupInfo()

        const saved = readState().groups || {}

        return rows.map(r => {
            const settings = hooks.groupSettings?.(r.grupo) || {}

            return {
                id: r.grupo,
                name: info[r.grupo]?.name || mask(r.grupo),
                members: info[r.grupo]?.size || Number(r.vistos),
                today: Number(r.hoy),
                features: settings.features || {},
                status: saved[r.grupo]?.status || settings.status || 'active'
            }
        })
    }


    async function leaderboard() {
        const [rows] = await pool.execute(`
            SELECT
                usuario,
                SUM(cantidad) AS total
            FROM mensajes
            GROUP BY usuario
            ORDER BY total DESC
            LIMIT 10
        `)

        return rows.map(r => {
            const extra = hooks.userStats?.(r.usuario) || {}

            return {
                name: hooks.userName?.(r.usuario) || mask(r.usuario),
                lvl: extra.level || 0,
                xp: extra.xp || 0,
                coins: extra.coins || 0,
                msgs: Number(r.total)
            }
        })
    }


    async function stats() {
        const [ r7, r30, g, top, ping ] = await Promise.all([
            range(7, day => DAY_NAMES[new Date(day + 'T12:00:00Z').getUTCDay()]),
            range(30, day => String(Number(day.slice(8)))),
            groups(),
            leaderboard(),
            dbPing()
        ])

        const mem = process.memoryUsage().rss / 1048576

        const json = {
            bot: {
                name: 'KennyBot V2',
                online: true,
                uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
                ramUsed: Math.round(mem),
                ramMax: Math.round(os.totalmem() / 1048576),
                cpu: cpuPct,
                queue: hooks.queueSize?.() ?? 0,
                queueMax: 20,
                wsPing: 0,
                dbPing: ping,
                modules: hooks.moduleCount?.() ?? 0
            },

            ranges: {
                '7d': r7,
                '30d': r30
            },

            groups: g,
            leaderboard: top
        }

        if (hooks.commands) {
            json.commands = await hooks.commands()
        } else if (commandsDir) {
            json.commands = scanCommands(commandsDir, hooks.isCommandEnabled)

            json.bot.modules = json.bot.modules || json.commands.length
        }

        if (hooks.warns) {
            json.warns = await hooks.warns()
        }

        return json
    }


    /* ───────── servidor ───────── */

    function send(res, code, body, cors) {
        res.writeHead(code, {
            'Content-Type': 'application/json; charset=utf-8',
            ...cors
        })

        res.end(JSON.stringify(body))
    }


    function readBody(req) {
        return new Promise((resolve, reject) => {
            let raw = ''

            req.on('data', chunk => {
                raw += chunk

                if (raw.length > 100000) {
                    reject(new Error('Cuerpo demasiado grande'))
                    req.destroy()
                }
            })

            req.on('end', () => {
                try {
                    resolve(raw ? JSON.parse(raw) : {})
                } catch (e) {
                    reject(new Error('JSON inválido'))
                }
            })
        })
    }


    const server = http.createServer(async (req, res) => {
        const cors = {
            'Access-Control-Allow-Origin': origin || '*',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Vary': 'Origin'
        }

        if (req.method === 'OPTIONS') {
            res.writeHead(204, cors)

            return res.end()
        }

        const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')

        if (!safeEqual(auth, token)) {
            return send(res, 401, { error: 'Token inválido o ausente' }, cors)
        }

        const url = new URL(req.url, 'http://x')

        const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)

        const need = name => {
            if (!hooks[name]) {
                const err = new Error(`Acción no disponible: falta el hook "${name}" en startPanelApi`)

                err.code = 501

                throw err
            }

            return hooks[name]
        }

        try {
            if (req.method === 'GET' && parts[0] === 'stats') {
                return send(res, 200, await stats(), cors)
            }

            if (req.method === 'POST') {
                const body = await readBody(req)

                if (parts[0] === 'reload') {
                    const result = await need('reload')()

                    return send(res, 200, { ok: true, ...(result || {}) }, cors)
                }

                if (parts[0] === 'restart') {
                    send(res, 200, { ok: true }, cors)

                    return setTimeout(() => need('restart')(), 300)
                }

                if (parts[0] === 'commands' && parts[1]) {
                    await need('setCommand')(parts[1], !!body.enabled)

                    return send(res, 200, { ok: true }, cors)
                }

                if (parts[0] === 'commands') {
                    await need('createCommand')(body.name, body.category)

                    return send(res, 200, { ok: true }, cors)
                }

                if (parts[0] === 'groups' && parts[1]) {
                    if (body.status !== undefined) {
                        saveGroupStatus(parts[1], body.status)
                    }

                    if (body.features && Object.keys(body.features).length) {
                        await need('setGroup')(parts[1], { features: body.features })
                    }

                    groupCache.at = 0

                    return send(res, 200, { ok: true }, cors)
                }

                if (parts[0] === 'warns' && parts[2] === 'remove') {
                    await need('removeWarn')(parts[1])

                    return send(res, 200, { ok: true }, cors)
                }

                if (parts[0] === 'warns') {
                    await need('addWarn')(body.user, body.group, body.reason)

                    return send(res, 200, { ok: true }, cors)
                }
            }

            send(res, 404, { error: 'No existe esa ruta' }, cors)
        } catch (err) {
            logger.error?.(`Panel API ${req.method} ${url.pathname}: ${err.message}`)

            send(res, err.code === 501 ? 501 : 500, { error: err.message }, cors)
        }
    })


    server.listen(port, host, () => {
        logger.log?.(`Panel API lista en http://${host}:${port}`)
    })

    return server
}


module.exports = startPanelApi
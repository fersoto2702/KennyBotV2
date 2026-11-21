/*
 * API del panel de KennyBot (v2: usuarios, registro, tiempo real, editor).
 *
 * Sirve los datos que el panel (React) lee y recibe sus acciones.
 * No necesita instalar nada: usa solo módulos de Node.
 *
 * Archivos que van juntos:
 *     src/utils/panel-api.js            (este archivo)
 *     src/utils/panel/auth.js           usuarios y sesiones
 *     src/utils/panel/audit.js          registro de actividad
 *     src/utils/panel/alerts.js         alertas por Telegram / WhatsApp
 *     src/utils/panel/editor.js         editor de comandos (apagado por defecto)
 *     src/utils/panel/replies.js        respuestas rápidas
 *     tools/panel-user.js               crear usuarios desde la terminal
 *     tools/watchdog.js                 vigilante externo (proceso aparte)
 *
 * SEGURIDAD
 *   - Este servidor puede reiniciar tu bot, así que exige iniciar sesión.
 *   - Escucha solo en 127.0.0.1. Para usarlo desde internet, ponlo detrás de
 *     HTTPS (ver DEPLOY.md). Nunca abras el puerto 4000 directamente.
 *   - Mientras no exista ningún usuario, funciona el PANEL_TOKEN de antes
 *     (modo transición). En cuanto creas un usuario, ese token se desactiva.
 *
 * Todos los hooks son opcionales. Si falta uno, esa acción responde 501.
 */

const http = require('http')
const os = require('os')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const createAuth = require('./panel/auth')
const createAudit = require('./panel/audit')
const createAlerts = require('./panel/alerts')
const createEditor = require('./panel/editor')
const createReplies = require('./panel/replies')
const createActivity = require('./panel/activity')
const createUptime = require('./panel/uptime')
const createMaintenance = require('./panel/maintenance')
const createBroadcasts = require('./panel/broadcasts')
const createTemplates = require('./panel/templates')
const createMetrics = require('./panel/metrics')
const createReport = require('./panel/report')
const createPublicStore = require('./panel/publicstore')
const createCatalog = require('./panel/catalog')
const startPublicApi = require('./public-api')


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
    welcome: 'Bienvenida',
    personalizados: 'Personalizados'
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
    secret = process.env.PANEL_SECRET,
    origin,
    getSock = () => null,
    commandsDir,
    hooks = {},
    stateFile = null,
    usersFile = path.join(process.cwd(), 'database', 'panel-users.json'),
    auditFile = path.join(process.cwd(), 'database', 'panel-audit.log'),
    backupDir = path.join(process.cwd(), 'database', 'panel-backups'),
    repliesFile = path.join(process.cwd(), 'database', 'panel-replies.json'),
    dataDir = path.join(process.cwd(), 'database'),
    publicApi = process.env.PUBLIC_API !== '0',
    alerts: alertsConfig = {},
    allowEdit = process.env.PANEL_ALLOW_EDIT === '1',
    trustProxy = process.env.PANEL_TRUST_PROXY === '1',
    sessionHours = Number(process.env.PANEL_SESSION_HOURS) || 12,
    port = Number(process.env.PANEL_PORT) || 4000,
    host = process.env.PANEL_HOST || '127.0.0.1',
    logger = console
}) {
    const signingKey = secret || token

    if (!signingKey || signingKey.length < 16) {
        throw new Error(
            'Falta PANEL_SECRET (o PANEL_TOKEN) de al menos 16 caracteres. ' +
            'El panel puede reiniciar el bot, así que no se inicia sin eso.'
        )
    }

    const auth = createAuth({ usersFile, secret: signingKey, sessionHours })
    const audit = createAudit({ file: auditFile, logger })

    const editor = commandsDir ? createEditor({ commandsDir, backupDir, allowEdit }) : null

    const replies = commandsDir
        ? createReplies({
            file: repliesFile,
            commandsDir,
            existingNames: () => scanCommands(commandsDir).flatMap(c => [ c.name ])
        })
        : null

    const origins = String(origin || '').split(',').map(o => o.trim()).filter(Boolean)

    if (auth.hasUsers() && !origins.length) {
        logger.warn?.('Panel API: define PANEL_ORIGIN con la dirección de tu panel para limitar quién puede llamar a la API.')
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

        if (hooks.economyTotal) {
            json.bot.coins = await hooks.economyTotal()
        }

        if (hooks.profiles) {
            json.bot.profiles = await hooks.profiles()
        }

        if (hooks.cards) {
            json.cards = await hooks.cards()
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

        json.activity = activity.snapshot(muteOpts)

        json.maintenance = maintenance.state()

        return json
    }


    /* ───────── estado ligero para el tiempo real ───────── */

    function liveStatus() {
        return {
            online: true,
            uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
            ramUsed: Math.round(process.memoryUsage().rss / 1048576),
            cpu: cpuPct,
            queue: hooks.queueSize?.() ?? 0,
            at: Date.now()
        }
    }


    /* ───────── métricas, disponibilidad y herramientas de operación ───────── */

    const metrics = createMetrics({ file: path.join(dataDir, 'panel-metrics.json'), logger })

    const prefixes = String(process.env.BOT_PREFIXES || '.').split(',').map(x => x.trim()).filter(Boolean)

    const uptime = createUptime({
        file: path.join(dataDir, 'panel-uptime.json'),
        getProfiles: () => hooks.profiles?.() || [],
        logger
    })

    const maintenance = createMaintenance({
        file: path.join(dataDir, 'panel-maintenance.json'),
        owners: () => [
            ...String(process.env.OWNER_NUMBERS || '').split(','),
            ...(hooks.owners?.() || [])
        ].map(x => x.trim()).filter(Boolean),
        prefixes
    })

    const templates = createTemplates({ file: path.join(dataDir, 'panel-templates.json'), logger })

    const publicStore = createPublicStore({
        configFile: path.join(dataDir, 'panel-public.json'),
        profilesFile: path.join(dataDir, 'panel-public-profiles.json')
    })

    const catalog = commandsDir
        ? createCatalog({ commandsDir, getConfig: () => publicStore.config() })
        : { get: () => ({ prefix: '.', total: 0, categories: [], commands: [] }), refresh() {} }

    const groupName = jid => groupCache.map[jid]?.name || mask(jid)


    /* ───────── actividad (mapa, radio, perfiles, bot mudo) ───────── */

    const activity = createActivity({
        onRecord: e => metrics.record(e),
        prefixes,
        onCommand: event => broadcast('cmd', event)
    })

    const errorOriginal = activity.error

    activity.error = (id, message) => {
        errorOriginal(id, message)

        metrics.error()
    }

    const muteOpts = {
        minCmds: Number(process.env.MUTE_MIN_COMMANDS) || 3,
        afterSec: Number(process.env.MUTE_AFTER_SEC) || 120
    }


    /* ───────── alertas ───────── */

    const alerts = createAlerts({
        getMute: id => activity.muteState(id, muteOpts),
        getProfiles: hooks.profiles,
        notifyWhatsApp: hooks.notifyWhatsApp,
        telegramToken: alertsConfig.telegramToken,
        telegramChat: alertsConfig.telegramChat,
        waNumber: alertsConfig.waNumber,
        graceSec: alertsConfig.graceSec,
        logger,
        onAlert: ({ text, results }) => {
            audit.log({
                user: 'sistema',
                action: 'alert',
                detail: `${text} → ${results.map(r => `${r.channel}:${r.ok ? 'ok' : r.reason}`).join(', ')}`
            })

            broadcast('alert', { text, at: Date.now() })
        }
    })


    /* ───────── difusiones, reporte semanal y web pública ───────── */

    const broadcasts = createBroadcasts({
        file: path.join(dataDir, 'panel-broadcasts.json'),
        send: async (profile, jid, text) => {
            if (!hooks.sendText) {
                throw new Error('Falta el hook sendText en index.js')
            }

            await hooks.sendText(profile, jid, text)
        },
        groupName,
        logger,
        onEvent: (kind, item) => {
            const ok = Object.values(item.results || {}).filter(r => r.ok).length

            audit.log({
                user: 'sistema',
                action: kind === 'start' ? 'broadcast-start' : 'broadcast-end',
                target: item.id,
                detail: kind === 'start' ? `${item.groups.length} grupos` : `${item.status}: ${ok}/${item.groups.length} enviados`
            })

            broadcast('broadcast', { id: item.id, status: item.status })
        }
    })


    async function sendTelegram(text) {
        const res = await fetch(`https://api.telegram.org/bot${alertsConfig.telegramToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: alertsConfig.telegramChat, text }),
            signal: AbortSignal.timeout(15000)
        })

        if (!res.ok) {
            throw new Error(`Telegram respondió ${res.status}`)
        }
    }


    const report = createReport({
        file: path.join(dataDir, 'panel-report.json'),
        metrics,
        uptime,
        groupName,
        logger,
        canSend: channel => channel === 'telegram'
            ? Boolean(alertsConfig.telegramToken && alertsConfig.telegramChat)
            : Boolean(alertsConfig.waNumber && hooks.notifyWhatsApp),
        sendTelegram,
        sendWhatsApp: text => hooks.notifyWhatsApp(alertsConfig.waNumber, text),
        warnsThisWeek: () => audit.tail(5000).filter(e => [ 'warn', 'warn-add' ].includes(e.action) && e.ok !== false && Date.now() - new Date(e.ts) < 7 * 86400000).length,
        activeWarns: async () => ((await hooks.warns?.()) || []).reduce((a, w) => a + (w.count || 0), 0),
        getData: async () => {
            const start = utcDay(6)
            const prevStart = utcDay(13)

            const [rows] = await pool.execute(`
                SELECT grupo, SUM(cantidad) AS total
                FROM mensajes
                WHERE fecha >= ?
                GROUP BY grupo
                ORDER BY total DESC
                LIMIT 10
            `, [ start ])

            const [[sum]] = await pool.execute(`
                SELECT
                    SUM(CASE WHEN fecha >= ? THEN cantidad ELSE 0 END) AS cur,
                    SUM(CASE WHEN fecha >= ? AND fecha < ? THEN cantidad ELSE 0 END) AS prev
                FROM mensajes
                WHERE fecha >= ?
            `, [ start, prevStart, start, prevStart ])

            await groupInfo()

            return {
                groups: rows.map(r => ({ jid: r.grupo, total: Number(r.total) })),
                thisWeek: Number(sum?.cur) || 0,
                lastWeek: Number(sum?.prev) || 0
            }
        }
    })


    const publicServer = publicApi
        ? startPublicApi({
            store: publicStore,
            catalog,
            uptime,
            maintenance,
            hooks: {
                isOnline: () => (hooks.profiles?.() || []).some(p => p.connected),
                publicProfile: jid => hooks.publicProfile?.(jid)
            },
            logger
        })
        : null


    /* ───────── tiempo real (Server-Sent Events) ───────── */

    const clients = new Set()

    function broadcast(event, data) {
        const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

        for (const res of clients) {
            try { res.write(msg) } catch {}
        }
    }

    audit.on(entry => broadcast('audit', entry))

    setInterval(() => {
        if (!clients.size) {
            return
        }

        broadcast('status', liveStatus())

        broadcast('activity', activity.snapshot(muteOpts))

        if (hooks.profiles) {
            Promise.resolve(hooks.profiles()).then(p => broadcast('profiles', p)).catch(() => {})
        }
    }, 5000).unref()

    setInterval(() => {
        for (const res of clients) {
            try { res.write(': ping\n\n') } catch {}
        }
    }, 20000).unref()


    /* ───────── servidor ───────── */

    function clientIp(req) {
        if (trustProxy) {
            const fwd = req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()

            if (fwd) {
                return fwd
            }
        }

        return req.socket.remoteAddress || 'desconocida'
    }


    function headersFor(req) {
        const h = {
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Vary': 'Origin',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Referrer-Policy': 'no-referrer',
            'Cache-Control': 'no-store'
        }

        const o = req.headers.origin

        if (!origins.length) {
            h['Access-Control-Allow-Origin'] = '*'
        } else if (o && origins.includes(o)) {
            h['Access-Control-Allow-Origin'] = o
        }

        if (req.headers['x-forwarded-proto'] === 'https') {
            h['Strict-Transport-Security'] = 'max-age=31536000'
        }

        return h
    }


    function send(res, code, body, cors) {
        res.writeHead(code, {
            'Content-Type': 'application/json; charset=utf-8',
            ...cors
        })

        res.end(JSON.stringify(body))
    }


    function readBody(req, limit = 100000) {
        return new Promise((resolve, reject) => {
            let raw = ''

            req.on('data', chunk => {
                raw += chunk

                if (raw.length > limit) {
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


    const httpError = (code, message) => Object.assign(new Error(message), { code })


    const server = http.createServer(async (req, res) => {
        const cors = headersFor(req)

        if (req.method === 'OPTIONS') {
            res.writeHead(204, cors)

            return res.end()
        }

        const url = new URL(req.url, 'http://x')

        const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)

        const ip = clientIp(req)

        try {
            /* ── rutas públicas ── */

            if (req.method === 'GET' && parts[0] === 'health') {
                return send(res, 200, { ok: true }, cors)
            }

            if (req.method === 'POST' && parts[0] === 'login') {
                const body = await readBody(req, 4000)

                try {
                    const session = await auth.login(body.user, body.password, ip)

                    audit.log({ user: session.user, role: session.role, ip, action: 'login' })

                    return send(res, 200, session, cors)
                } catch (err) {
                    audit.log({ user: String(body.user || '?').slice(0, 32), ip, action: 'login', ok: false, detail: err.message })

                    throw err
                }
            }


            /* ── a partir de aquí hace falta sesión ── */

            const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')

            let session = auth.check(bearer)

            if (!session && token && bearer && safeEqual(bearer, token)) {
                if (!auth.hasUsers() || process.env.PANEL_ALLOW_STATIC_TOKEN === '1') {
                    session = { user: 'token', role: 'admin' }
                }
            }

            if (!session) {
                return send(res, 401, { error: 'Sesión inválida o vencida. Inicia sesión de nuevo.' }, cors)
            }

            const allow = action => {
                if (!auth.can(session.role, action)) {
                    throw httpError(403, `Tu rol (${session.role}) no puede hacer esto.`)
                }
            }

            const need = name => {
                if (!hooks[name]) {
                    throw httpError(501, `Acción no disponible: falta el hook "${name}" en startPanelApi`)
                }

                return hooks[name]
            }

            const note = (action, target, detail) => audit.log({
                user: session.user,
                role: session.role,
                ip,
                action,
                target,
                detail
            })


            /* ── lecturas ── */

            if (req.method === 'GET') {
                if (parts[0] === 'me') {
                    return send(res, 200, {
                        user: session.user,
                        role: session.role,
                        editor: Boolean(editor?.enabled) && auth.can(session.role, 'edit'),
                        alerts: alerts.status()
                    }, cors)
                }

                if (parts[0] === 'stats') {
                    return send(res, 200, await stats(), cors)
                }

                if (parts[0] === 'events') {
                    if (clients.size >= 20) {
                        throw httpError(429, 'Demasiadas conexiones en vivo')
                    }

                    res.writeHead(200, {
                        ...cors,
                        'Content-Type': 'text/event-stream; charset=utf-8',
                        'Cache-Control': 'no-cache, no-transform',
                        'Connection': 'keep-alive',
                        'X-Accel-Buffering': 'no'
                    })

                    res.write('retry: 5000\n\n')

                    clients.add(res)

                    req.on('close', () => clients.delete(res))

                    res.write(`event: activity\ndata: ${JSON.stringify(activity.snapshot(muteOpts))}\n\n`)

                    return res.write(`event: status\ndata: ${JSON.stringify(liveStatus())}\n\n`)
                }

                if (parts[0] === 'audit') {
                    allow('audit')

                    return send(res, 200, {
                        rows: audit.tail(Number(url.searchParams.get('limit')) || 100, {
                            action: url.searchParams.get('action') || undefined
                        })
                    }, cors)
                }

                if (parts[0] === 'alerts' && parts[1] === 'status') {
                    allow('alerts')

                    return send(res, 200, alerts.status(), cors)
                }

                if (parts[0] === 'replies') {
                    allow('edit')

                    return send(res, 200, { rows: replies ? replies.list() : [] }, cors)
                }

                if (parts[0] === 'maintenance') {
                    allow('read')

                    return send(res, 200, maintenance.state(), cors)
                }

                if (parts[0] === 'broadcasts') {
                    allow('broadcast')

                    return send(res, 200, { rows: broadcasts.list() }, cors)
                }

                if (parts[0] === 'templates') {
                    allow('read')

                    return send(res, 200, templates.all(), cors)
                }

                if (parts[0] === 'report') {
                    allow('report')

                    return send(res, 200, report.config(), cors)
                }

                if (parts[0] === 'public') {
                    allow('public')

                    catalog.refresh()

                    return send(res, 200, {
                        config: publicStore.config(),
                        profiles: publicStore.count(),
                        commands: catalog.get().total,
                        publicApi: Boolean(publicServer),
                        siteUrl: process.env.PUBLIC_SITE_URL || null
                    }, cors)
                }

                if (parts[0] === 'editor') {
                    allow('edit')

                    if (!editor) {
                        throw httpError(501, 'El editor necesita la opción "commandsDir"')
                    }

                    if (!editor.enabled) {
                        throw httpError(403, 'El editor está apagado. Pon PANEL_ALLOW_EDIT=1 en tu .env y reinicia el bot.')
                    }

                    if (parts[1] === 'files') {
                        return send(res, 200, { rows: editor.list() }, cors)
                    }

                    if (parts[1] === 'file') {
                        return send(res, 200, editor.read(url.searchParams.get('path')), cors)
                    }

                    if (parts[1] === 'backups') {
                        return send(res, 200, { rows: editor.backups(url.searchParams.get('path')) }, cors)
                    }
                }
            }


            /* ── acciones ── */

            if (req.method === 'POST') {
                const big = parts[0] === 'editor'

                const body = await readBody(req, big ? 450000 : 100000)

                if (parts[0] === 'logout') {
                    if (body.everywhere) {
                        auth.revokeSessions(session.user)
                    }

                    note('logout', null, body.everywhere ? 'cerró todas sus sesiones' : null)

                    return send(res, 200, { ok: true }, cors)
                }

                if (parts[0] === 'maintenance') {
                    allow('maintenance')

                    const state = maintenance.set({ on: body.on, message: body.message, by: session.user })

                    note('maintenance', null, state.on ? `encendido: ${state.message}` : 'apagado')

                    broadcast('maintenance', state)

                    return send(res, 200, state, cors)
                }

                if (parts[0] === 'broadcasts') {
                    allow('broadcast')

                    if (parts[1] === 'preview') {
                        await groupInfo()

                        return send(res, 200, broadcasts.preview(body), cors)
                    }

                    if (parts[1] === 'test') {
                        const text = String(body.text || '').trim()

                        if (!text) {
                            throw httpError(400, 'Escribe el mensaje.')
                        }

                        if (!alertsConfig.waNumber || !hooks.notifyWhatsApp) {
                            throw httpError(400, 'Falta ALERT_WA_NUMBER en tu .env: ahí se envía la prueba.')
                        }

                        const ok = await hooks.notifyWhatsApp(alertsConfig.waNumber, broadcasts.render(`🧪 Prueba de difusión\n\n${text}`, ''))

                        note('broadcast-test')

                        return send(res, 200, { ok }, cors)
                    }

                    if (parts[2] === 'cancel') {
                        const item = broadcasts.cancel(parts[1])

                        note('broadcast-cancel', item.id)

                        return send(res, 200, item, cors)
                    }

                    await groupInfo()

                    const item = broadcasts.create(body, session.user)

                    note('broadcast-create', item.id, `${item.groups.length} grupos, ${new Date(item.at).toISOString()}`)

                    return send(res, 200, item, cors)
                }

                if (parts[0] === 'templates' && parts[1]) {
                    allow('groups')

                    if (parts[2] === 'delete') {
                        templates.remove(parts[1])

                        note('template-delete', parts[1])

                        return send(res, 200, templates.all(), cors)
                    }

                    templates.set(parts[1], body)

                    note('template-save', parts[1])

                    return send(res, 200, templates.all(), cors)
                }

                if (parts[0] === 'report') {
                    allow('report')

                    if (parts[1] === 'preview') {
                        return send(res, 200, { text: await report.build() }, cors)
                    }

                    if (parts[1] === 'send') {
                        const result = await report.sendNow()

                        note('report-send', null, result.channels.join(', '))

                        return send(res, 200, result, cors)
                    }

                    const cfg = report.setConfig(body)

                    note('report-config', null, cfg.enabled ? `${report.dayName(cfg.weekday)} ${cfg.hour}:${String(cfg.minute).padStart(2, '0')}` : 'apagado')

                    return send(res, 200, cfg, cors)
                }

                if (parts[0] === 'public') {
                    allow('public')

                    const config = publicStore.setConfig(body)

                    catalog.refresh()

                    note('public-config')

                    return send(res, 200, { config }, cors)
                }

                if (parts[0] === 'reload') {
                    allow('reload')

                    const result = await need('reload')()

                    note('reload', null, result?.total ? `${result.loaded}/${result.total} módulos` : null)

                    return send(res, 200, { ok: true, ...(result || {}) }, cors)
                }

                if (parts[0] === 'restart') {
                    allow('restart')

                    need('restart')

                    note('restart')

                    send(res, 200, { ok: true }, cors)

                    return setTimeout(() => hooks.restart(), 300)
                }

                if (parts[0] === 'commands' && parts[1]) {
                    allow('commands')

                    await need('setCommand')(parts[1], !!body.enabled)

                    note('command', parts[1], body.enabled ? 'activado' : 'desactivado')

                    return send(res, 200, { ok: true }, cors)
                }

                if (parts[0] === 'commands') {
                    allow('commands')

                    await need('createCommand')(body.name, body.category)

                    note('command-create', body.name)

                    return send(res, 200, { ok: true }, cors)
                }

                if (parts[0] === 'groups' && parts[1]) {
                    allow('groups')

                    const changes = []

                    if (body.status !== undefined) {
                        saveGroupStatus(parts[1], body.status)

                        changes.push(`estado: ${body.status}`)
                    }

                    if (body.features && Object.keys(body.features).length) {
                        await need('setGroup')(parts[1], { features: body.features })

                        changes.push(Object.entries(body.features).map(([ k, v ]) => `${k}: ${v ? 'on' : 'off'}`).join(', '))
                    }

                    groupCache.at = 0

                    note('group', mask(parts[1]), changes.join(' · '))

                    return send(res, 200, { ok: true }, cors)
                }

                if (parts[0] === 'warns' && parts[2] === 'remove') {
                    allow('warns')

                    await need('removeWarn')(parts[1])

                    note('warn-remove', mask(parts[1]))

                    return send(res, 200, { ok: true }, cors)
                }

                if (parts[0] === 'warns') {
                    allow('warns')

                    await need('addWarn')(body.user, body.group, body.reason)

                    note('warn-add', mask(body.user), body.reason)

                    return send(res, 200, { ok: true }, cors)
                }

                if (parts[0] === 'alerts' && parts[1] === 'test') {
                    allow('alerts')

                    const results = await alerts.test()

                    note('alert-test', null, results.map(r => `${r.channel}:${r.ok ? 'ok' : r.reason}`).join(', '))

                    return send(res, 200, { ok: results.some(r => r.ok), results }, cors)
                }

                if (parts[0] === 'replies') {
                    allow('edit')

                    if (!replies) {
                        throw httpError(501, 'Las respuestas necesitan la opción "commandsDir"')
                    }

                    const result = parts[2] === 'delete'
                        ? replies.remove(parts[1])
                        : replies.save(body.name, body)

                    let reload = null

                    if (result.needsReload && hooks.reload) {
                        reload = await hooks.reload()
                    }

                    note(parts[2] === 'delete' ? 'reply-delete' : 'reply-save', parts[2] === 'delete' ? parts[1] : body.name)

                    return send(res, 200, { ok: true, reload }, cors)
                }

                if (parts[0] === 'editor') {
                    allow('edit')

                    if (!editor) {
                        throw httpError(501, 'El editor necesita la opción "commandsDir"')
                    }

                    if (parts[1] === 'file') {
                        const result = editor.save(body.path, body.content, { expectedMtime: body.mtime })

                        let reload = null

                        if (hooks.reload) {
                            reload = await hooks.reload()
                        }

                        note('code-save', body.path, `${result.bytes} bytes${result.backup ? ' · copia ' + result.backup : ''}${reload?.failed ? ' · ' + reload.failed + ' módulo(s) con error' : ''}`)

                        return send(res, 200, { ...result, reload }, cors)
                    }

                    if (parts[1] === 'restore') {
                        const result = editor.restore(body.path, body.backup)

                        const reload = hooks.reload ? await hooks.reload() : null

                        note('code-restore', body.path, body.backup)

                        return send(res, 200, { ...result, reload }, cors)
                    }
                }
            }

            send(res, 404, { error: 'No existe esa ruta' }, cors)
        } catch (err) {
            const code = [ 401, 403, 409, 422, 429, 501 ].includes(err.code) ? err.code : 500

            if (code === 500) {
                logger.error?.(`Panel API ${req.method} ${url.pathname}: ${err.message}`)
            }

            if (!res.headersSent) {
                send(res, code, { error: err.message }, cors)
            }
        }
    })


    server.listen(port, host, () => {
        logger.log?.(`Panel API lista en http://${host}:${port}`)
    })

    return {
        server,
        audit,
        alerts,
        auth,
        activity,
        maintenance,
        templates,
        broadcasts,
        report,
        uptime,
        metrics,
        publicStore,
        publicServer,
        broadcast
    }
}


module.exports = startPanelApi
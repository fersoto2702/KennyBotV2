/*
 * API pública (solo lectura) para la web que ve todo el mundo.
 *
 * Es OTRO servidor, en otro puerto (4001), separado del panel de admin:
 *   - no tiene login ni token, y no puede cambiar nada
 *   - nunca devuelve números de teléfono, ni datos internos del bot
 *   - cada IP tiene límite de peticiones por minuto
 *
 * Rutas:
 *     GET /status           ¿está en línea?, último reinicio, caídas recientes
 *     GET /commands         catálogo de comandos
 *     GET /info             datos para "añadir el bot a mi grupo"
 *     GET /profile/:slug    licencia de un usuario que activó su perfil público
 *     GET /health
 */

const http = require('http')


function startPublicApi({
    store,
    catalog,
    uptime,
    maintenance,
    hooks = {},
    origin = process.env.PUBLIC_ORIGIN || '*',
    trustProxy = process.env.PANEL_TRUST_PROXY === '1',
    port = Number(process.env.PUBLIC_PORT) || 4001,
    host = process.env.PUBLIC_HOST || '127.0.0.1',
    logger = console
}) {
    const origins = String(origin).split(',').map(o => o.trim()).filter(Boolean)

    const buckets = new Map()


    function limited(ip, kind, max) {
        const key = `${kind}:${ip}`

        const now = Date.now()

        let b = buckets.get(key)

        if (!b || now > b.reset) {
            b = { n: 0, reset: now + 60000 }

            buckets.set(key, b)
        }

        b.n++

        return b.n > max
    }


    setInterval(() => {
        const now = Date.now()

        for (const [ k, b ] of buckets) {
            if (now > b.reset) {
                buckets.delete(k)
            }
        }
    }, 60000).unref()


    function ipOf(req) {
        if (trustProxy) {
            const fwd = req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()

            if (fwd) {
                return fwd
            }
        }

        return req.socket.remoteAddress || '?'
    }


    function send(req, res, code, body, cache = 'no-store') {
        const headers = {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': cache,
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer',
            'Vary': 'Origin'
        }

        const o = req.headers.origin

        if (origins.includes('*')) {
            headers['Access-Control-Allow-Origin'] = '*'
        } else if (o && origins.includes(o)) {
            headers['Access-Control-Allow-Origin'] = o
        }

        res.writeHead(code, headers)

        res.end(JSON.stringify(body))
    }


    function contact(value) {
        if (!value) {
            return null
        }

        if (/^https:\/\//i.test(value)) {
            return value
        }

        const digits = value.replace(/\D/g, '')

        return digits ? `https://wa.me/${digits}?text=${encodeURIComponent('Hola, quiero agregar el bot a mi grupo')}` : null
    }


    function status() {
        const m = maintenance.state()

        const up = uptime.summary(30)

        const online = Boolean(hooks.isOnline?.())

        return {
            state: !online ? 'offline' : m.on ? 'maintenance' : 'online',
            message: m.on ? m.message : null,
            startedAt: up.startedAt,
            uptimeSec: Math.round((Date.now() - up.startedAt) / 1000),
            availability: Number(uptime.summary(7).availability.toFixed(2)),
            incidents: up.outages.slice(0, 5).map(o => ({ from: o.from, to: o.to, minutes: o.minutes })),
            checkedAt: Date.now()
        }
    }


    function info() {
        const c = store.config()

        return {
            botName: c.botName,
            description: c.description,
            prefix: c.prefix,
            adminName: c.adminName || null,
            adminLink: contact(c.adminContact),
            botLink: c.botNumber ? `https://wa.me/${c.botNumber}` : null,
            rules: c.rules,
            instructions: c.instructions
        }
    }


    function profile(slug) {
        const rec = store.bySlug(slug)

        if (!rec) {
            return null
        }

        const p = hooks.publicProfile?.(rec.jid) || {}

        const max = p.maxWarns || 3

        const warns = Math.min(p.warns || 0, max)

        return {
            name: rec.name,
            since: rec.since,
            level: p.level || 0,
            xp: p.xp || 0,
            coins: p.coins || 0,
            badges: (p.badges || []).slice(0, 16).map(b => String(b).slice(0, 40)),
            warns,
            maxWarns: max,
            stars: Math.min(5, Math.round((warns / max) * 5))
        }
    }


    const server = http.createServer((req, res) => {
        try {
            if (req.method === 'OPTIONS') {
                res.writeHead(204, {
                    'Access-Control-Allow-Origin': origins.includes('*') ? '*' : (origins.includes(req.headers.origin) ? req.headers.origin : ''),
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                })

                return res.end()
            }

            if (req.method !== 'GET') {
                return send(req, res, 405, { error: 'Solo lectura.' })
            }

            const ip = ipOf(req)

            const parts = new URL(req.url, 'http://x').pathname.split('/').filter(Boolean).map(decodeURIComponent)

            if (limited(ip, 'all', 90)) {
                return send(req, res, 429, { error: 'Demasiadas peticiones. Espera un minuto.' })
            }

            switch (parts[0]) {
                case 'health':
                    return send(req, res, 200, { ok: true })

                case 'status':
                    return send(req, res, 200, status(), 'public, max-age=10')

                case 'commands':
                    return send(req, res, 200, catalog.get(), 'public, max-age=60')

                case 'info':
                    return send(req, res, 200, info(), 'public, max-age=60')

                case 'profile': {
                    if (limited(ip, 'profile', 20)) {
                        return send(req, res, 429, { error: 'Demasiadas consultas de perfil. Espera un minuto.' })
                    }

                    const data = /^[a-z0-9]{8}$/i.test(parts[1] || '') ? profile(parts[1]) : null

                    return data
                        ? send(req, res, 200, data)
                        : send(req, res, 404, { error: 'No existe ese perfil. Quizá su dueño lo desactivó.' })
                }

                default:
                    return send(req, res, 404, { error: 'No encontrado.' })
            }
        } catch (err) {
            logger.error?.(`API pública: ${err.message}`)

            send(req, res, 500, { error: 'Error interno.' })
        }
    })

    server.listen(port, host, () => logger.info?.(`API pública escuchando en http://${host}:${port}`))

    return { server, status, info, profile }
}


module.exports = startPublicApi
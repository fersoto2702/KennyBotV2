/*
 * Historial de disponibilidad.
 *
 * - Guarda un latido cada ~30 s. Si el bot arranca y el último latido es
 *   de hace más de 3 minutos, registra una caída (reinicio o proceso caído).
 * - Cada 15 s mira los perfiles: registra cuándo cada uno se desconecta y
 *   vuelve, y cuándo NINGUNO está conectado (el bot "está caído" para el público).
 *
 * Lo usan la página pública de estado y el reporte semanal.
 */

const createStore = require('./store')

const DAY = 86400000


function createUptime({ file, getProfiles, graceMs = 90000, tickMs = 15000, logger = console }) {
    const store = createStore(file, { firstSeen: 0, lastBeat: 0, outages: [], drops: [] })

    const db = store.get()

    db.outages ||= []
    db.drops ||= []

db.firstSeen ||= Date.now()

    const startedAt = Date.now()

    if (db.lastBeat && startedAt - db.lastBeat > 180000) {
        db.outages.push({ from: db.lastBeat, to: startedAt, kind: 'reinicio' })
    }

    db.lastBeat = startedAt

    let lastSave = 0


    function prune() {
        const limit = Date.now() - 35 * DAY

        db.outages = db.outages.filter(o => (o.to || Date.now()) > limit).slice(-300)
        db.drops = db.drops.filter(d => (d.to || Date.now()) > limit).slice(-500)
    }


    function tick() {
        const now = Date.now()

        let profiles = []

        try {
            profiles = getProfiles() || []
        } catch (err) {
            logger.error?.(`uptime: ${err.message}`)
        }

        db.lastBeat = now

        if (now - startedAt >= graceMs) {
            for (const p of profiles) {
                const open = db.drops.find(d => d.profile === p.id && !d.to)

                if (!p.connected && !open) {
                    db.drops.push({ profile: p.id, name: p.name, from: now, to: null })
                } else if (p.connected && open) {
                    open.to = now
                }
            }

            const anyUp = profiles.some(p => p.connected)

            const open = db.outages.find(o => !o.to)

            if (!anyUp && profiles.length && !open) {
                db.outages.push({ from: now, to: null, kind: 'desconexión' })
            } else if (anyUp && open) {
                open.to = now
            }
        }

        if (now - lastSave > 30000) {
            lastSave = now

            prune()

            try {
                store.save()
            } catch (err) {
                logger.error?.(`uptime: no pude guardar: ${err.message}`)
            }
        }
    }

    tick()

    const timer = setInterval(tick, tickMs)

    timer.unref?.()


    /* Minutos caídos dentro de la ventana [since, now] */
    function downtime(list, since) {
        const now = Date.now()

        return list.reduce((sum, o) => {
            const from = Math.max(o.from, since)

            const to = Math.min(o.to || now, now)

            return sum + Math.max(0, to - from)
        }, 0)
    }


    function summary(days = 7) {
        const now = Date.now()

        const since = now - days * DAY

        const window = Math.max(60000, Math.min(days * DAY, now - db.firstSeen))

        const down = downtime(db.outages, since)

        const outages = db.outages
            .filter(o => (o.to || now) > since)
            .map(o => ({ from: o.from, to: o.to, kind: o.kind, minutes: Math.max(1, Math.round(((o.to || now) - o.from) / 60000)) }))

        const perProfile = {}

        for (const d of db.drops.filter(x => (x.to || now) > since)) {
            const row = perProfile[d.profile] ||= { name: d.name || d.profile, drops: 0, minutes: 0 }

            row.drops++

            row.minutes += Math.round((Math.min(d.to || now, now) - Math.max(d.from, since)) / 60000)
        }

        return {
            startedAt,
            availability: Math.max(0, Math.min(100, 100 - (down / window) * 100)),
            outages: outages.reverse(),
            downMinutes: Math.round(down / 60000),
            perProfile
        }
    }

    return { summary, tick, startedAt, stop: () => clearInterval(timer), flush: () => store.save() }
}


module.exports = createUptime

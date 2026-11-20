/*
 * Actividad en vivo del bot.
 *
 * El bot avisa aquí de cada mensaje recibido, cada mensaje enviado y cada
 * error. Con eso el panel dibuja el mapa, la radio y los perfiles, y el
 * detector de bot mudo sabe cuándo un perfil recibe comandos y no contesta.
 *
 * Nada se guarda en disco: son contadores en memoria (se reinician con el bot).
 * De cada comando solo se guarda el NOMBRE (".menu"), nunca lo que escribió
 * la persona después.
 */

const HOUR = 3600000

function createActivity({
    prefixes = [ '.' ],
    keepEvents = 60,
    onCommand = () => {}
} = {}) {
    const profiles = new Map()

    const groups = new Map()

    const recent = []


    function profile(id) {
        if (!profiles.has(id)) {
            profiles.set(id, {
                received: 0,
                cmdTimes: [],
                hourly: new Map(),
                groupCmds: new Map(),
                sentAt: 0,
                lastCmd: null,
                errors: []
            })
        }

        return profiles.get(id)
    }


    const bucket = ts => Math.floor(ts / HOUR)


    function prune(p, now) {
        p.cmdTimes = p.cmdTimes.filter(t => now - t < 15 * 60000).slice(-200)

        p.errors = p.errors.filter(t => now - t < 15 * 60000)

        for (const key of p.hourly.keys()) {
            if (key < bucket(now) - 24) {
                p.hourly.delete(key)
            }
        }
    }


    /* Mensaje recibido. Devuelve el nombre del comando si lo era. */
    function incoming({ profile: id, jid, text, fromMe, name }) {
        if (!id || fromMe) {
            return null
        }

        const now = Date.now()

        const p = profile(id)

        p.received++

        const isGroup = typeof jid === 'string' && jid.endsWith('@g.us')

        const g = isGroup ? (groups.get(jid) || { msgs: [], cmds: [], last: 0 }) : null

        if (g) {
            g.msgs.push(now)

            g.last = now

            groups.set(jid, g)
        }

        const body = String(text || '').trim()

        const prefix = prefixes.find(x => body.startsWith(x))

        const cmd = prefix ? body.slice(prefix.length).split(/\s+/)[0].toLowerCase() : ''

        if (!cmd || !/^[a-z0-9_áéíóúñ]{1,24}$/i.test(cmd)) {
            return null
        }

        p.cmdTimes.push(now)

        p.lastCmd = now

        const h = bucket(now)

        const row = p.hourly.get(h) || { cmds: 0, sent: 0 }

        row.cmds++

        p.hourly.set(h, row)

        if (g) {
            g.cmds.push(now)

            p.groupCmds.set(jid, (p.groupCmds.get(jid) || 0) + 1)
        }

        prune(p, now)

        const event = {
            at: now,
            profile: id,
            cmd,
            group: isGroup ? jid : null,
            user: String(name || '').slice(0, 24) || null
        }

        recent.unshift(event)

        recent.length = Math.min(recent.length, keepEvents)

        onCommand(event)

        return cmd
    }


    /* Mensaje enviado por el bot (cualquier respuesta). */
    function sent(id) {
        if (!id) {
            return
        }

        const now = Date.now()

        const p = profile(id)

        p.sentAt = now

        const h = bucket(now)

        const row = p.hourly.get(h) || { cmds: 0, sent: 0 }

        row.sent++

        p.hourly.set(h, row)
    }


    function error(id, message) {
        const p = profile(id || '?')

        p.errors.push(Date.now())

        p.lastError = String(message || '').slice(0, 160)
    }


    /*
     * ¿El perfil recibe comandos pero no contesta?
     * Mudo = al menos `minCmds` comandos sin ningún mensaje enviado después,
     * y el más viejo lleva más de `afterSec` esperando.
     */
    function muteState(id, { minCmds = 3, afterSec = 120 } = {}) {
        const p = profiles.get(id)

        if (!p) {
            return { muted: false, waiting: 0 }
        }

        const now = Date.now()

        const waiting = p.cmdTimes.filter(t => t > p.sentAt)

        const muted = waiting.length >= minCmds && now - waiting[0] >= afterSec * 1000

        return { muted, waiting: waiting.length, since: muted ? waiting[0] : null }
    }


    function snapshot(opts) {
        const now = Date.now()

        const out = { at: now, profiles: {}, groups: {}, recent: recent.slice(0, 30) }

        for (const [ id, p ] of profiles) {
            prune(p, now)

            const hours = []

            let cmds24 = 0

            let sent24 = 0

            for (let i = 23; i >= 0; i--) {
                const row = p.hourly.get(bucket(now) - i) || { cmds: 0, sent: 0 }

                hours.push(row.cmds)

                cmds24 += row.cmds

                sent24 += row.sent
            }

            const top = [ ...p.groupCmds.entries() ].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([ jid, n ]) => ({ jid, n }))

            out.profiles[id] = {
                received: p.received,
                cmds24,
                sent24,
                hours,
                lastCmd: p.lastCmd,
                lastSent: p.sentAt || null,
                errors15: p.errors.length,
                lastError: p.errors.length ? p.lastError : null,
                top,
                ...muteState(id, opts)
            }
        }

        for (const [ jid, g ] of groups) {
            g.msgs = g.msgs.filter(t => now - t < 15 * 60000)

            g.cmds = g.cmds.filter(t => now - t < 15 * 60000)

            if (!g.msgs.length && now - g.last > 24 * HOUR) {
                groups.delete(jid)

                continue
            }

            out.groups[jid] = {
                msgs5: g.msgs.filter(t => now - t < 5 * 60000).length,
                cmds5: g.cmds.filter(t => now - t < 5 * 60000).length,
                msgs15: g.msgs.length,
                last: g.last
            }
        }

        return out
    }


    return {
        incoming,
        sent,
        error,
        muteState,
        snapshot,
        ids: () => [ ...profiles.keys() ]
    }
}


module.exports = createActivity
/*
 * Modo mantenimiento.
 *
 * Encendido, el bot NO ejecuta comandos de nadie (salvo del dueño y de la
 * propia cuenta del bot) y contesta un aviso, como máximo una vez cada
 * `repeatSec` por chat. Los mensajes que no son comandos siguen su curso
 * normal (conteo, antilink, niveles…).
 */

const createStore = require('./store')


function createMaintenance({
    file,
    owners = () => [],
    prefixes = [ '.' ],
    repeatSec = 120,
    defaultMessage = '🛠️ Estamos en mantenimiento. Volvemos en un rato.'
}) {
    const store = createStore(file, { on: false, message: defaultMessage, since: null, by: null })

    const lastReply = new Map()

    const number = jid => String(jid || '').split('@')[0].split(':')[0]


    function state() {
        const s = store.get()

        return { on: Boolean(s.on), message: s.message || defaultMessage, since: s.since, by: s.by }
    }


    function set({ on, message, by }) {
        const s = store.get()

        s.on = Boolean(on)

        if (typeof message === 'string' && message.trim()) {
            s.message = message.trim().slice(0, 300)
        }

        s.since = s.on ? Date.now() : null

        s.by = s.on ? by || null : null

        store.save()

        lastReply.clear()

        return state()
    }


    /* ¿Se debe frenar este mensaje? Devuelve { block, reply } o null. */
    function check({ jid, fromMe, sender, text }) {
        const s = store.get()

        if (!s.on || fromMe) {
            return null
        }

        const body = String(text || '').trim()

        if (!prefixes.some(p => body.startsWith(p) && body.length > p.length)) {
            return null
        }

        const who = number(sender || jid)

        if (owners().map(number).includes(who)) {
            return null
        }

        const last = lastReply.get(jid) || 0

        const now = Date.now()

        if (now - last < repeatSec * 1000) {
            return { block: true, reply: null }
        }

        lastReply.set(jid, now)

        return { block: true, reply: s.message || defaultMessage }
    }


    return { state, set, check }
}


module.exports = createMaintenance

/*
 * Contadores por día (comandos y mensajes por grupo, errores).
 * Se guardan en disco para que el reporte semanal funcione aunque el bot
 * se haya reiniciado. De cada comando solo se guarda su nombre.
 */

const createStore = require('./store')

const DAY = 86400000


const dayKey = (ts = Date.now()) => new Date(ts).toISOString().slice(0, 10)


function createMetrics({ file, logger = console }) {
    const store = createStore(file, { days: {} })

    const db = store.get()

    db.days ||= {}

    let dirty = false


    function today() {
        return (db.days[dayKey()] ||= { cmds: {}, groups: {}, errors: 0 })
    }


    function record({ cmd, jid }) {
        const d = today()

        if (cmd) {
            d.cmds[cmd] = (d.cmds[cmd] || 0) + 1
        }

        if (jid && String(jid).endsWith('@g.us')) {
            const g = (d.groups[jid] ||= { msgs: 0, cmds: 0 })

            g.msgs++

            if (cmd) {
                g.cmds++
            }
        }

        dirty = true
    }


    function error() {
        today().errors++

        dirty = true
    }


    function flush() {
        if (!dirty) {
            return
        }

        const limit = dayKey(Date.now() - 40 * DAY)

        for (const k of Object.keys(db.days)) {
            if (k < limit) {
                delete db.days[k]
            }
        }

        try {
            store.save()

            dirty = false
        } catch (err) {
            logger.error?.(`metrics: ${err.message}`)
        }
    }


    const timer = setInterval(flush, 60000)

    timer.unref?.()


    /* Suma de los últimos `days` días (offset = cuántos días atrás termina). */
    function range(days = 7, offset = 0) {
        const out = { cmds: {}, groups: {}, errors: 0, days: 0 }

        for (let i = offset; i < offset + days; i++) {
            const d = db.days[dayKey(Date.now() - i * DAY)]

            if (!d) {
                continue
            }

            out.days++

            out.errors += d.errors || 0

            for (const [ k, n ] of Object.entries(d.cmds)) {
                out.cmds[k] = (out.cmds[k] || 0) + n
            }

            for (const [ k, g ] of Object.entries(d.groups)) {
                const row = (out.groups[k] ||= { msgs: 0, cmds: 0 })

                row.msgs += g.msgs

                row.cmds += g.cmds
            }
        }

        return out
    }


    return { record, error, range, flush }
}


module.exports = createMetrics

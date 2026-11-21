/*
 * Difusión programada.
 *
 * Mensajes de texto a grupos elegidos, a una hora. Guardados en disco: si el
 * bot se reinicia, las difusiones pendientes siguen ahí.
 *
 * Para cuidar tu número (WhatsApp castiga el envío masivo):
 *   - entre un grupo y el siguiente espera de 4 a 9 segundos al azar
 *   - máximo 30 grupos por difusión y 60 envíos cada 24 horas
 *   - si el bot estuvo apagado y la hora ya pasó por más de 2 horas, NO la
 *     envía tarde: la marca como "perdida"
 */

const crypto = require('crypto')
const createStore = require('./store')

const HOUR = 3600000


const sleep = ms => new Promise(r => setTimeout(r, ms))


function createBroadcasts({
    file,
    send,
    groupName = () => 'grupo',
    delayMs = [ 4000, 9000 ],
    maxGroups = 30,
    maxPerDay = 60,
    maxPending = 10,
    lateMs = 2 * HOUR,
    onEvent = () => {},
    logger = console
}) {
    const store = createStore(file, { items: [] })

    const db = store.get()

    db.items ||= []

    let busy = false


    /* ── al arrancar ── */

    for (const item of db.items) {
        if (item.status === 'sending') {
            item.status = 'partial'

            item.note = 'El bot se reinició mientras enviaba.'
        }

        if (item.status === 'pending' && Date.now() - item.at > lateMs) {
            item.status = 'missed'

            item.note = 'La hora pasó con el bot apagado.'
        }
    }

    store.save()


    function render(text, jid, when = new Date()) {
        return String(text)
            .replaceAll('{grupo}', groupName(jid))
            .replaceAll('{fecha}', when.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }))
            .replaceAll('{hora}', when.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }))
    }


    function clean({ text, profile, groups, at }) {
        const body = String(text || '').trim()

        if (!body) {
            throw new Error('Escribe el mensaje.')
        }

        if (body.length > 1500) {
            throw new Error('El mensaje es demasiado largo (máximo 1500 caracteres).')
        }

        const list = [ ...new Set((groups || []).map(String)) ].filter(g => g.endsWith('@g.us'))

        if (!list.length) {
            throw new Error('Elige al menos un grupo.')
        }

        if (list.length > maxGroups) {
            throw new Error(`Máximo ${maxGroups} grupos por difusión.`)
        }

        const when = Number(at)

        if (!Number.isFinite(when) || when < Date.now() - 60000) {
            throw new Error('La hora ya pasó. Elige una hora futura.')
        }

        if (when > Date.now() + 90 * 24 * HOUR) {
            throw new Error('La hora está demasiado lejos (máximo 90 días).')
        }

        return { text: body, profile: String(profile || ''), groups: list, at: when }
    }


    function preview(input) {
        const data = clean({ at: Date.now() + 1000, ...input })

        const warnings = []

        if (/https?:\/\//i.test(data.text)) {
            warnings.push('Tiene un enlace: WhatsApp castiga más los mensajes con enlaces enviados a muchos grupos.')
        }

        if (data.groups.length > 15) {
            warnings.push('Son muchos grupos: el envío tardará varios minutos.')
        }

        const sentToday = db.items.flatMap(i => Object.values(i.results || {})).filter(r => r.ok && Date.now() - r.at < 24 * HOUR).length

        if (sentToday + data.groups.length > maxPerDay) {
            warnings.push(`Superas el límite de ${maxPerDay} envíos por día (ya van ${sentToday}). Se enviará hasta donde alcance.`)
        }

        return {
            items: data.groups.map(jid => ({ jid, name: groupName(jid), text: render(data.text, jid, new Date(data.at)) })),
            warnings
        }
    }


    function create(input, by) {
        const data = clean(input)

        if (db.items.filter(i => i.status === 'pending').length >= maxPending) {
            throw new Error(`Ya hay ${maxPending} difusiones pendientes. Cancela alguna primero.`)
        }

        const item = {
            id: crypto.randomBytes(5).toString('hex'),
            ...data,
            status: 'pending',
            by: by || null,
            createdAt: Date.now(),
            results: {}
        }

        db.items.push(item)

        db.items = db.items.slice(-100)

        store.save()

        return item
    }


    function cancel(id) {
        const item = db.items.find(i => i.id === id)

        if (!item) {
            throw new Error('Esa difusión no existe.')
        }

        if (![ 'pending', 'sending' ].includes(item.status)) {
            throw new Error('Esa difusión ya terminó.')
        }

        item.status = 'cancelled'

        store.save()

        return item
    }


    async function run(item) {
        item.status = 'sending'

        store.save()

        onEvent('start', item)

        for (const jid of item.groups) {
            if (item.status !== 'sending') {
                break
            }

            if (item.results[jid]?.ok) {
                continue
            }

            const sentToday = db.items.flatMap(i => Object.values(i.results || {})).filter(r => r.ok && Date.now() - r.at < 24 * HOUR).length

            if (sentToday >= maxPerDay) {
                item.results[jid] = { ok: false, error: 'Límite diario de envíos', at: Date.now() }

                continue
            }

            try {
                await send(item.profile, jid, render(item.text, jid))

                item.results[jid] = { ok: true, at: Date.now() }
            } catch (err) {
                item.results[jid] = { ok: false, error: String(err.message || err).slice(0, 120), at: Date.now() }

                logger.error?.(`Difusión ${item.id} → ${jid}: ${err.message}`)
            }

            store.save()

            await sleep(delayMs[0] + Math.random() * (delayMs[1] - delayMs[0]))
        }

        if (item.status === 'sending') {
            const ok = Object.values(item.results).filter(r => r.ok).length

            item.status = ok === item.groups.length ? 'sent' : ok === 0 ? 'failed' : 'partial'
        }

        store.save()

        onEvent('end', item)
    }


    async function tick() {
        if (busy) {
            return
        }

        busy = true

        try {
            const due = db.items.filter(i => i.status === 'pending' && i.at <= Date.now()).sort((a, b) => a.at - b.at)

            for (const item of due) {
                await run(item)
            }
        } catch (err) {
            logger.error?.(`Difusiones: ${err.message}`)
        } finally {
            busy = false
        }
    }


    const timer = setInterval(tick, 15000)

    timer.unref?.()


    return {
        list: () => db.items.slice().reverse().map(({ ...i }) => i),
        preview,
        create,
        cancel,
        tick,
        render,
        stop: () => clearInterval(timer)
    }
}


module.exports = createBroadcasts

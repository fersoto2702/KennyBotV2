/*
 * Reporte semanal por Telegram (y opcionalmente WhatsApp).
 *
 * Cuenta: mensajes de la semana contra la anterior, grupos más activos,
 * comandos más usados, warns y caídas.
 *
 * Programación: un día de la semana y una hora (hora del equipo donde corre
 * el bot). Si el bot estaba apagado a esa hora, lo manda al volver siempre
 * que no hayan pasado más de 36 horas.
 */

const createStore = require('./store')

const DAY = 86400000

const DAYS = [ 'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado' ]

const fmt = n => Number(n || 0).toLocaleString('es-MX')


function createReport({
    file,
    metrics,
    uptime,
    getData,
    groupName = jid => jid,
    warnsThisWeek = () => 0,
    activeWarns = () => 0,
    sendTelegram,
    sendWhatsApp = null,
    canSend = () => true,
    logger = console
}) {
    const store = createStore(file, { enabled: false, weekday: 1, hour: 9, minute: 0, whatsapp: false, lastSent: 0 })

    const cfg = store.get()


    function config() {
        return {
            enabled: Boolean(cfg.enabled),
            weekday: cfg.weekday,
            hour: cfg.hour,
            minute: cfg.minute,
            whatsapp: Boolean(cfg.whatsapp),
            lastSent: cfg.lastSent || 0,
            channels: { telegram: Boolean(canSend('telegram')), whatsapp: Boolean(canSend('whatsapp')) }
        }
    }


    function setConfig(input) {
        const weekday = Number(input.weekday)

        const hour = Number(input.hour)

        const minute = Number(input.minute ?? 0)

        if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
            throw new Error('Día inválido.')
        }

        if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
            throw new Error('Hora inválida.')
        }

        Object.assign(cfg, { enabled: Boolean(input.enabled), weekday, hour, minute, whatsapp: Boolean(input.whatsapp) })

        store.save()

        return config()
    }


    async function build(now = new Date()) {
        const week = metrics.range(7)

        let data = { groups: [], thisWeek: null, lastWeek: null }

        try {
            data = await getData()
        } catch (err) {
            logger.error?.(`Reporte: no pude leer MySQL: ${err.message}`)
        }

        const groups = data.groups?.length
            ? data.groups
            : Object.entries(week.groups).map(([ jid, g ]) => ({ jid, total: g.msgs })).sort((a, b) => b.total - a.total)

        const from = new Date(now.getTime() - 6 * DAY)

        const range = `${from.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} – ${now.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`

        const lines = [ `📊 Reporte semanal · ${range}`, '' ]

        if (data.thisWeek != null) {
            let delta = ''

            if (data.lastWeek > 0) {
                const pct = Math.round(((data.thisWeek - data.lastWeek) / data.lastWeek) * 100)

                delta = ` (${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct)} % contra la semana anterior)`
            }

            lines.push(`💬 Mensajes: ${fmt(data.thisWeek)}${delta}`)
        }

        const cmdTotal = Object.values(week.cmds).reduce((a, b) => a + b, 0)

        lines.push(`⌨️ Comandos usados: ${fmt(cmdTotal)}`, '')

        lines.push('🏘️ Grupos más activos')

        if (groups.length) {
            groups.slice(0, 5).forEach((g, i) => lines.push(`${i + 1}. ${groupName(g.jid)} — ${fmt(g.total)}`))
        } else {
            lines.push('Sin datos todavía.')
        }

        lines.push('', '🔥 Comandos más usados')

        const top = Object.entries(week.cmds).sort((a, b) => b[1] - a[1]).slice(0, 5)

        if (top.length) {
            top.forEach(([ name, n ], i) => lines.push(`${i + 1}. .${name} — ${fmt(n)}`))
        } else {
            lines.push('Sin datos todavía (el conteo empieza cuando instalas esta versión).')
        }

        lines.push('', `⚠️ Warns: ${fmt(await warnsThisWeek())} nuevos esta semana · ${fmt(await activeWarns())} activos ahora`)

        const up = uptime.summary(7)

        lines.push('', '🚨 Caídas')

        const drops = Object.values(up.perProfile)

        if (!up.outages.length && !drops.length) {
            lines.push('Ninguna. Todo estable.')
        } else {
            if (up.outages.length) {
                lines.push(`Bot completo: ${up.outages.length} (${fmt(up.downMinutes)} min en total)`)
            }

            for (const d of drops) {
                lines.push(`Perfil ${d.name}: ${d.drops} desconexión(es), ${fmt(d.minutes)} min`)
            }
        }

        lines.push(`Disponibilidad: ${up.availability.toFixed(2)} %`)

        if (week.errors) {
            lines.push('', `🐞 Errores al procesar mensajes: ${fmt(week.errors)}`)
        }

        return lines.join('\n')
    }


    async function deliver(text) {
        const sent = []

        if (canSend('telegram')) {
            await sendTelegram(text)

            sent.push('telegram')
        }

        if (cfg.whatsapp && sendWhatsApp && canSend('whatsapp')) {
            if (await sendWhatsApp(text)) {
                sent.push('whatsapp')
            }
        }

        if (!sent.length) {
            throw new Error('No hay ningún canal configurado. Pon ALERT_TELEGRAM_TOKEN y ALERT_TELEGRAM_CHAT en tu .env.')
        }

        return sent
    }


    async function sendNow() {
        const text = await build()

        const channels = await deliver(text)

        return { text, channels }
    }


    /* Último momento programado que ya pasó. */
    function lastDue(now = new Date()) {
        const d = new Date(now)

        d.setHours(cfg.hour, cfg.minute, 0, 0)

        d.setDate(d.getDate() - ((d.getDay() - cfg.weekday + 7) % 7))

        if (d > now) {
            d.setDate(d.getDate() - 7)
        }

        return d
    }


    async function tick() {
        if (!cfg.enabled) {
            return null
        }

        const due = lastDue()

        if (cfg.lastSent >= due.getTime() || Date.now() - due.getTime() > 36 * 3600000) {
            return null
        }

        cfg.lastSent = due.getTime()

        store.save()

        try {
            return await sendNow()
        } catch (err) {
            logger.error?.(`Reporte semanal: ${err.message}`)

            return null
        }
    }


    const timer = setInterval(tick, 60000)

    timer.unref?.()


    return { config, setConfig, build, sendNow, tick, lastDue, dayName: d => DAYS[d] }
}


module.exports = createReport

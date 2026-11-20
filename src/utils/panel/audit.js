/*
 * Registro de actividad del panel.
 *
 * Guarda una línea JSON por evento en database/panel-audit.log:
 *     { ts, user, role, ip, action, target, detail, ok }
 *
 * El bot también puede escribir en él (por ejemplo desde warn.js):
 *     global.panelAudit?.({ user: 'whatsapp:5216621234567', action: 'warn', target: '...', detail: '...' })
 */

const fs = require('fs')
const path = require('path')


const MAX_BYTES = 5 * 1024 * 1024


function createAudit({ file, logger = console }) {
    const listeners = new Set()

    fs.mkdirSync(path.dirname(file), { recursive: true })


    function log(entry) {
        const line = {
            ts: new Date().toISOString(),
            user: String(entry.user || 'sistema').slice(0, 64),
            role: entry.role || null,
            ip: entry.ip || null,
            action: String(entry.action || '').slice(0, 48),
            target: entry.target ? String(entry.target).slice(0, 160) : null,
            detail: entry.detail ? String(entry.detail).slice(0, 300) : null,
            ok: entry.ok !== false
        }

        try {
            if (fs.existsSync(file) && fs.statSync(file).size > MAX_BYTES) {
                fs.renameSync(file, file + '.1')
            }

            fs.appendFileSync(file, JSON.stringify(line) + '\n', 'utf8')
        } catch (err) {
            logger.error?.(`Panel audit: no pude escribir el registro: ${err.message}`)
        }

        for (const fn of listeners) {
            try { fn(line) } catch {}
        }

        return line
    }


    function tail(limit = 100, { action, user } = {}) {
        try {
            if (!fs.existsSync(file)) {
                return []
            }

            const rows = fs.readFileSync(file, 'utf8')
                .split('\n')
                .filter(Boolean)
                .map(l => {
                    try { return JSON.parse(l) } catch { return null }
                })
                .filter(Boolean)
                .filter(r => (!action || r.action === action) && (!user || r.user === user))

            return rows.slice(-Math.min(500, Math.max(1, limit))).reverse()
        } catch {
            return []
        }
    }


    return {
        log,
        tail,
        on: fn => {
            listeners.add(fn)

            return () => listeners.delete(fn)
        }
    }
}


module.exports = createAudit
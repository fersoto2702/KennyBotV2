/*
 * Plantillas de bienvenida y reglas, por grupo.
 *
 * Marcadores que se pueden usar en el texto:
 *     {usuario}   menciona a quien entró
 *     {grupo}     nombre del grupo
 *     {miembros}  cuántos miembros hay
 *     {fecha}     fecha de hoy
 *     {reglas}    el texto de las reglas del grupo
 *
 * La bienvenida solo actúa en los grupos donde está ACTIVADA. En los demás
 * sigue funcionando tu welcomeSystem de siempre.
 */

const createStore = require('./store')


function createTemplates({ file, logger = console }) {
    const store = createStore(file, { default: { welcome: { enabled: false, text: '' }, rules: '' }, groups: {} })

    const db = store.get()

    db.default ||= { welcome: { enabled: false, text: '' }, rules: '' }

    db.groups ||= {}


    function normalize(t = {}) {
        return {
            welcome: { enabled: Boolean(t.welcome?.enabled), text: String(t.welcome?.text || '') },
            rules: String(t.rules || '')
        }
    }


    /* Lo guardado para el grupo; lo que le falte lo toma de la plantilla general. */
    function forGroup(jid) {
        const own = db.groups[jid]

        const base = normalize(db.default)

        if (!own) {
            return { ...base, own: false }
        }

        const mine = normalize(own)

        return {
            welcome: {
                enabled: own.welcome?.enabled ?? base.welcome.enabled,
                text: mine.welcome.text || base.welcome.text
            },
            rules: mine.rules || base.rules,
            own: true
        }
    }


    function set(target, input) {
        const welcomeText = String(input.welcome?.text ?? input.welcome ?? '')

        const rules = String(input.rules ?? '')

        if (welcomeText.length > 1000) {
            throw new Error('La bienvenida es demasiado larga (máximo 1000 caracteres).')
        }

        if (rules.length > 2000) {
            throw new Error('Las reglas son demasiado largas (máximo 2000 caracteres).')
        }

        const value = {
            welcome: { enabled: Boolean(input.welcome?.enabled ?? input.welcomeEnabled), text: welcomeText },
            rules
        }

        if (target === 'default') {
            db.default = value
        } else if (String(target).endsWith('@g.us')) {
            db.groups[target] = value
        } else {
            throw new Error('Grupo inválido.')
        }

        store.save()

        return value
    }


    function remove(jid) {
        delete db.groups[jid]

        store.save()
    }


    function render(text, ctx = {}) {
        return String(text)
            .replaceAll('{usuario}', ctx.user || '@usuario')
            .replaceAll('{grupo}', ctx.group || 'el grupo')
            .replaceAll('{miembros}', String(ctx.members ?? '—'))
            .replaceAll('{fecha}', (ctx.date || new Date()).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }))
            .replaceAll('{reglas}', ctx.rules || '')
    }


    /* Devuelve true si ya mandó la bienvenida (para saltar la del bot). */
    async function welcome(sock, update) {
        if (update.action !== 'add') {
            return false
        }

        const jid = update.id

        const t = forGroup(jid)

        if (!t.welcome.enabled || !t.welcome.text.trim()) {
            return false
        }

        let meta = {}

        try {
            meta = await sock.groupMetadata(jid)
        } catch {}

        const ids = (update.participants || []).map(p => (typeof p === 'string' ? p : p.id || p.phoneNumber)).filter(Boolean)

        for (const id of ids) {
            const text = render(t.welcome.text, {
                user: `@${String(id).split('@')[0].split(':')[0]}`,
                group: meta.subject,
                members: meta.participants?.length,
                rules: t.rules
            })

            try {
                await sock.sendMessage(jid, { text, mentions: [ id ] })
            } catch (err) {
                logger.error?.(`Bienvenida en ${jid}: ${err.message}`)
            }
        }

        return true
    }


    return {
        all: () => ({ default: normalize(db.default), groups: Object.fromEntries(Object.entries(db.groups).map(([ k, v ]) => [ k, normalize(v) ])) }),
        forGroup,
        set,
        remove,
        render,
        welcome
    }
}


module.exports = createTemplates

/*
 * Datos de la web pública:
 *   - configuración editable desde el panel (nombre, administrador, reglas…)
 *   - perfiles públicos: cada usuario decide con .perfilweb si tiene uno.
 *     Sin ese paso, NADIE aparece en la web.
 */

const crypto = require('crypto')
const createStore = require('./store')

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'


const DEFAULT_CONFIG = {
    botName: 'KennyBot',
    description: 'Un bot de WhatsApp con niveles, economía, cartas y herramientas para tu grupo.',
    botNumber: '',
    adminName: '',
    adminContact: '',
    prefix: '.',
    rules: [
        'Respeta a los demás miembros.',
        'No hagas spam ni mandes cadenas.',
        'No uses el bot para acosar o estafar.',
        'Los administradores del bot pueden quitarlo de un grupo que abuse de él.'
    ],
    instructions: [
        'Escribe al administrador y pide que agregue el bot a tu grupo.',
        'Agrega el contacto del bot como un miembro más del grupo.',
        'Escribe .menu en el grupo para ver lo que puede hacer.',
        'Los administradores del grupo pueden activar o apagar funciones desde el panel del grupo.'
    ],
    hiddenFolders: [ 'owner', 'dev', 'system' ],
    hiddenCommands: []
}


const text = (v, max) => String(v ?? '').trim().slice(0, max)

const list = (v, maxItems, maxLen) => (Array.isArray(v) ? v : String(v || '').split('\n')).map(x => text(x, maxLen)).filter(Boolean).slice(0, maxItems)


function createPublicStore({ configFile, profilesFile }) {
    const cfg = createStore(configFile, {})

    const prof = createStore(profilesFile, { slugs: {} })

    prof.get().slugs ||= {}


    function config() {
        return { ...DEFAULT_CONFIG, ...cfg.get() }
    }


    function setConfig(input) {
        const next = {
            botName: text(input.botName, 40) || DEFAULT_CONFIG.botName,
            description: text(input.description, 240),
            botNumber: text(input.botNumber, 20).replace(/\D/g, ''),
            adminName: text(input.adminName, 40),
            adminContact: text(input.adminContact, 120),
            prefix: text(input.prefix, 3) || '.',
            rules: list(input.rules, 12, 200),
            instructions: list(input.instructions, 12, 240),
            hiddenFolders: list(input.hiddenFolders, 30, 40).map(x => x.toLowerCase()),
            hiddenCommands: list(input.hiddenCommands, 100, 40).map(x => x.toLowerCase())
        }

        const adminContact = next.adminContact

        if (adminContact && !/^\+?\d[\d\s-]{6,}$/.test(adminContact) && !/^https:\/\//i.test(adminContact)) {
            throw new Error('El contacto del administrador debe ser un número de teléfono o un enlace https.')
        }

        Object.keys(cfg.get()).forEach(k => delete cfg.get()[k])

        Object.assign(cfg.get(), next)

        cfg.save()

        return config()
    }


    const number = jid => String(jid || '').split('@')[0].split(':')[0]


    function newSlug() {
        const bytes = crypto.randomBytes(8)

        return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('')
    }


    function optIn({ jid, name }) {
        const slugs = prof.get().slugs

        const n = number(jid)

        let slug = Object.keys(slugs).find(s => number(slugs[s].jid) === n)

        if (!slug) {
            do {
                slug = newSlug()
            } while (slugs[slug])

            slugs[slug] = { jid, name: text(name, 24) || 'Jugador', since: Date.now() }
        } else {
            slugs[slug].jid = jid

            if (name) {
                slugs[slug].name = text(name, 24)
            }
        }

        prof.save()

        return { slug, ...slugs[slug] }
    }


    function optOut(jid) {
        const slugs = prof.get().slugs

        const n = number(jid)

        const found = Object.keys(slugs).filter(s => number(slugs[s].jid) === n)

        found.forEach(s => delete slugs[s])

        if (found.length) {
            prof.save()
        }

        return found.length > 0
    }


    return {
        config,
        setConfig,
        optIn,
        optOut,
        bySlug: slug => prof.get().slugs[String(slug).toLowerCase()] || null,
        count: () => Object.keys(prof.get().slugs).length
    }
}


module.exports = createPublicStore

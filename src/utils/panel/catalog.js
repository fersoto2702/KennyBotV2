/*
 * Catálogo público de comandos, generado leyendo tu carpeta /comandos.
 *
 * NO ejecuta tus archivos: los lee como texto y saca estos campos si existen:
 *     name, aliases, description (o desc/descripcion), usage (o uso),
 *     example (o ejemplo), category, y los marcadores hidden / ownerOnly /
 *     owner / devOnly (esos comandos no se publican).
 * Lo que falte se completa: nombre = archivo, categoría = carpeta,
 * ejemplo = ".nombre".
 */

const fs = require('fs')
const path = require('path')

const LABELS = {
    admin: 'Admin',
    config: 'Configuración',
    diversion: 'Diversión',
    downloads: 'Descargas',
    economy: 'Economía',
    general: 'General',
    grupos: 'Grupos',
    levels: 'Niveles',
    premium: 'Premium',
    profile: 'Perfil',
    welcome: 'Bienvenida',
    personalizados: 'Personalizados'
}

const CARDS = [ 'card', 'cardinfo', 'claim', 'collection', 'equip', 'events', 'myclub', 'objectives', 'openpack', 'packs', 'pick' ]


function field(src, keys) {
    for (const key of keys) {
        const m = src.match(new RegExp(`(?:^|[\\s{,])${key}\\s*:\\s*([\`'"])((?:\\\\[\\s\\S]|(?!\\1)[^\\\\])*)\\1`))

        if (m) {
            return m[2].replace(/\\n/g, ' ').replace(/\\(['"`])/g, '$1').replace(/\s+/g, ' ').trim()
        }
    }

    return ''
}


function strings(src, key) {
    const m = src.match(new RegExp(`(?:^|[\\s{,])${key}\\s*:\\s*\\[([^\\]]*)\\]`))

    if (!m) {
        return []
    }

    return [ ...m[1].matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g) ].map(x => x[2].trim()).filter(Boolean)
}


function parse(file, folder, root) {
    let src = ''

    try {
        src = fs.readFileSync(file, 'utf8').slice(0, 80000)
    } catch {
        return null
    }

    const base = path.basename(file, '.js')

    if (/(?:^|[\s{,])(hidden|ownerOnly|owner|devOnly)\s*:\s*true/.test(src)) {
        return null
    }

    const category = field(src, [ 'category', 'categoria' ])

    const examples = strings(src, 'examples').concat(strings(src, 'ejemplos'))

    return {
        name: (field(src, [ 'name' ]) || base).toLowerCase(),
        file: base,
        aliases: strings(src, 'aliases').map(a => a.toLowerCase()),
        description: field(src, [ 'description', 'desc', 'descripcion', 'descripción' ]),
        usage: field(src, [ 'usage', 'uso' ]),
        example: field(src, [ 'example', 'ejemplo' ]) || examples[0] || '',
        category: LABELS[folder] || (folder === root ? (CARDS.includes(base) ? 'Cartas' : 'Utilidad') : '') || category || folder,
        folder
    }
}


function createCatalog({ commandsDir, getConfig, ttlMs = 60000 }) {
    let cache = { at: 0, data: null }


    function build() {
        const config = getConfig()

        const hiddenFolders = new Set((config.hiddenFolders || []).map(x => x.toLowerCase()))

        const hidden = new Set((config.hiddenCommands || []).map(x => x.toLowerCase()))

        const commands = []

        for (const entry of fs.readdirSync(commandsDir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (hiddenFolders.has(entry.name.toLowerCase())) {
                    continue
                }

                for (const f of fs.readdirSync(path.join(commandsDir, entry.name))) {
                    if (f.endsWith('.js')) {
                        const c = parse(path.join(commandsDir, entry.name, f), entry.name, null)

                        c && commands.push(c)
                    }
                }
            } else if (entry.name.endsWith('.js')) {
                const c = parse(path.join(commandsDir, entry.name), '(raíz)', '(raíz)')

                c && commands.push(c)
            }
        }

        const prefix = config.prefix || '.'

        const out = commands
            .filter(c => !hidden.has(c.name) && !hidden.has(c.file))
            .map(c => ({
                name: c.name,
                aliases: c.aliases.filter(a => a !== c.name),
                description: c.description,
                usage: c.usage || `${prefix}${c.name}`,
                example: c.example || `${prefix}${c.name}`,
                category: c.category
            }))
            .sort((a, b) => a.category.localeCompare(b.category, 'es') || a.name.localeCompare(b.name, 'es'))

        const counts = {}

        out.forEach(c => (counts[c.category] = (counts[c.category] || 0) + 1))

        return {
            prefix,
            total: out.length,
            categories: Object.entries(counts).map(([ name, count ]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, 'es')),
            commands: out
        }
    }


    return {
        get() {
            if (!cache.data || Date.now() - cache.at > ttlMs) {
                cache = { at: Date.now(), data: build() }
            }

            return cache.data
        },
        refresh() {
            cache = { at: 0, data: null }
        }
    }
}


module.exports = createCatalog

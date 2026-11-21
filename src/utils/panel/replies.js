/*
 * Respuestas rápidas.
 *
 * Son comandos de texto fijo que creas desde el panel, sin tocar código:
 *
 *     nombre: "reglas"   texto: "1. Respeto..."   → .reglas responde ese texto
 *
 * El texto vive en database/panel-replies.json, así que editarlo se aplica
 * al instante. Al crear una respuesta se genera un archivo pequeño en
 * comandos/personalizados/ (con una plantilla fija, no con código tuyo) y
 * tu recarga automática lo detecta sola.
 */

const fs = require('fs')
const path = require('path')


const NAME_RE = /^[a-z0-9_]{2,24}$/
const MAX_TEXT = 3000


function template(name, aliases, relPath) {
    return `const fs =
    require('fs')

const path =
    require('path')


/* Archivo generado por el panel. El texto se edita desde el panel. */

const repliesPath =
    path.join(
        __dirname,
        ${JSON.stringify(relPath)}
    )


function readReply() {

    try {

        const data =
            JSON.parse(
                fs.readFileSync(
                    repliesPath,
                    'utf8'
                )
            )

        return data.replies?.[${JSON.stringify(name)}] || null

    } catch {

        return null

    }

}


module.exports = {

    name:
        ${JSON.stringify(name)},

    aliases:
        ${JSON.stringify(aliases)},

    description:
        'Respuesta rápida creada desde el panel',

    category:
        'personalizados',

    async execute({

        sock,
        from

    }) {

        const reply =
            readReply()

        if (!reply?.text) {

            return

        }

        const send =
            sock.safeSendMessage
                ? sock.safeSendMessage.bind(sock)
                : sock.sendMessage.bind(sock)

        await send(
            from,
            {
                text:
                    reply.text
            }
        )

    }

}
`
}


function createReplies({ file, commandsDir, existingNames = () => [] }) {
    const dir = path.join(commandsDir, 'personalizados')


    function read() {
        try {
            const data = JSON.parse(fs.readFileSync(file, 'utf8'))

            return data && typeof data.replies === 'object' ? data : { replies: {} }
        } catch {
            return { replies: {} }
        }
    }


    function write(data) {
        fs.mkdirSync(path.dirname(file), { recursive: true })

        const tmp = file + '.tmp'

        fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
        fs.renameSync(tmp, file)
    }


    const list = () => Object.entries(read().replies).map(([ name, r ]) => ({ name, ...r }))


    function save(name, { text, aliases = [] }) {
        name = String(name || '').trim().toLowerCase()

        if (!NAME_RE.test(name)) {
            throw new Error('El nombre debe tener de 2 a 24 caracteres: letras minúsculas, números o guion bajo.')
        }

        text = String(text || '').trim()

        if (!text || text.length > MAX_TEXT) {
            throw new Error(`El texto es obligatorio y debe tener máximo ${MAX_TEXT} caracteres.`)
        }

        aliases = [ ...new Set((aliases || []).map(a => String(a).trim().toLowerCase()).filter(a => NAME_RE.test(a) && a !== name)) ].slice(0, 5)

        const data = read()

        const isNew = !data.replies[name]

        /* No pisamos comandos que ya existen y no son respuestas rápidas. */
        const taken = existingNames()

        for (const n of [ name, ...aliases ]) {
            if (taken.includes(n) && !(data.replies[n] || Object.values(data.replies).some(r => r.aliases?.includes(n)))) {
                throw new Error(`".${n}" ya existe como comando del bot. Elige otro nombre.`)
            }
        }

        const prevAliases = data.replies[name]?.aliases || []

        data.replies[name] = {
            text,
            aliases,
            createdAt: data.replies[name]?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }

        write(data)

        const target = path.join(dir, `${name}.js`)

        const needsFile = isNew || !fs.existsSync(target) || JSON.stringify(prevAliases) !== JSON.stringify(aliases)

        if (needsFile) {
            fs.mkdirSync(dir, { recursive: true })

            fs.writeFileSync(target, template(name, aliases, path.relative(dir, file).replace(/\\/g, '/')), 'utf8')
        }

        return { ok: true, isNew, needsReload: needsFile }
    }


    function remove(name) {
        name = String(name || '').trim().toLowerCase()

        const data = read()

        if (!data.replies[name]) {
            throw new Error('Esa respuesta no existe')
        }

        delete data.replies[name]

        write(data)

        const target = path.join(dir, `${name}.js`)

        if (fs.existsSync(target)) {
            fs.unlinkSync(target)
        }

        return { ok: true, needsReload: true }
    }


    return {
        list,
        save,
        remove
    }
}


module.exports = createReplies

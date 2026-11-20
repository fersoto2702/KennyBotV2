/*
 * Editor de comandos desde el panel.
 *
 * ⚠️ Esto permite cambiar CÓDIGO de tu bot desde el navegador. Por eso:
 *   - Está APAGADO por defecto: hay que poner PANEL_ALLOW_EDIT=1 en el .env.
 *   - Solo lo puede usar el rol "admin".
 *   - Solo toca archivos .js dentro de /comandos (nada fuera de esa carpeta).
 *   - Revisa la sintaxis antes de guardar y rechaza código roto.
 *   - Guarda una copia del archivo anterior en database/panel-backups.
 *   - Cada guardado queda en el registro de actividad.
 */

const fs = require('fs')
const path = require('path')
const vm = require('vm')


const MAX_BYTES = 300 * 1024
const KEEP_BACKUPS = 20


function createEditor({ commandsDir, backupDir, allowEdit }) {
    const root = path.resolve(commandsDir)


    function safePath(rel, mustExist = false) {
        rel = String(rel || '').replace(/\\/g, '/')

        if (!rel || rel.includes('\0') || path.extname(rel) !== '.js') {
            throw new Error('Solo se pueden abrir archivos .js')
        }

        const full = path.resolve(root, rel)

        if (!full.startsWith(root + path.sep)) {
            throw new Error('Esa ruta queda fuera de la carpeta de comandos')
        }

        if (fs.existsSync(full)) {
            const real = fs.realpathSync(full)

            if (!real.startsWith(fs.realpathSync(root) + path.sep)) {
                throw new Error('Esa ruta apunta fuera de la carpeta de comandos')
            }
        } else if (mustExist) {
            throw new Error('Ese archivo no existe')
        }

        return full
    }


    function requireEnabled() {
        if (!allowEdit) {
            const err = new Error('El editor está apagado. Pon PANEL_ALLOW_EDIT=1 en tu .env y reinicia el bot si quieres usarlo.')

            err.code = 403

            throw err
        }
    }


    function list() {
        const out = []

        const walk = dir => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name)

                if (entry.isSymbolicLink()) {
                    continue
                }

                if (entry.isDirectory()) {
                    walk(full)
                } else if (entry.name.endsWith('.js')) {
                    const st = fs.statSync(full)

                    out.push({
                        path: path.relative(root, full).replace(/\\/g, '/'),
                        size: st.size,
                        mtime: st.mtimeMs
                    })
                }
            }
        }

        walk(root)

        return out.sort((a, b) => a.path.localeCompare(b.path))
    }


    function read(rel) {
        const full = safePath(rel, true)

        const st = fs.statSync(full)

        if (st.size > MAX_BYTES) {
            throw new Error('El archivo es demasiado grande para el editor')
        }

        return {
            path: rel,
            content: fs.readFileSync(full, 'utf8'),
            mtime: st.mtimeMs
        }
    }


    function checkSyntax(content, rel) {
        try {
            new vm.Script(
                `(function (exports, require, module, __filename, __dirname) {${content}\n})`,
                { filename: rel }
            )
        } catch (err) {
            const e = new Error(`Error de sintaxis: ${err.message}`)

            e.code = 422

            throw e
        }
    }


    function backupName(rel) {
        return rel.replace(/[\\/]/g, '__')
    }


    function backups(rel) {
        const prefix = backupName(rel) + '.'

        if (!fs.existsSync(backupDir)) {
            return []
        }

        return fs.readdirSync(backupDir)
            .filter(f => f.startsWith(prefix))
            .sort()
            .reverse()
            .map(f => ({
                name: f,
                at: Number(f.slice(prefix.length).replace(/\.bak$/, '')) || 0
            }))
    }


    function save(rel, content, { expectedMtime } = {}) {
        requireEnabled()

        if (typeof content !== 'string' || Buffer.byteLength(content) > MAX_BYTES) {
            throw new Error('Contenido inválido o demasiado grande (máximo 300 KB)')
        }

        const full = safePath(rel)

        checkSyntax(content, rel)

        let backup = null

        if (fs.existsSync(full)) {
            const current = fs.statSync(full)

            /* Si alguien más cambió el archivo mientras lo editabas, no lo pisamos. */
            if (expectedMtime && Math.abs(current.mtimeMs - expectedMtime) > 1) {
                const err = new Error('El archivo cambió en el disco mientras lo editabas. Ábrelo de nuevo para no perder esos cambios.')

                err.code = 409

                throw err
            }

            fs.mkdirSync(backupDir, { recursive: true })

            backup = `${backupName(rel)}.${Date.now()}.bak`

            fs.copyFileSync(full, path.join(backupDir, backup))

            for (const old of backups(rel).slice(KEEP_BACKUPS)) {
                try { fs.unlinkSync(path.join(backupDir, old.name)) } catch {}
            }
        } else {
            fs.mkdirSync(path.dirname(full), { recursive: true })
        }

        const tmp = full + '.panel-tmp'

        fs.writeFileSync(tmp, content, 'utf8')
        fs.renameSync(tmp, full)

        return {
            ok: true,
            backup,
            bytes: Buffer.byteLength(content),
            mtime: fs.statSync(full).mtimeMs
        }
    }


    function restore(rel, name) {
        requireEnabled()

        if (!/^[\w.@-]+\.bak$/.test(name) || !name.startsWith(backupName(rel) + '.')) {
            throw new Error('Copia de seguridad inválida')
        }

        const file = path.join(backupDir, name)

        if (!fs.existsSync(file)) {
            throw new Error('Esa copia ya no existe')
        }

        return save(rel, fs.readFileSync(file, 'utf8'))
    }


    return {
        enabled: Boolean(allowEdit),
        list,
        read,
        save,
        backups,
        restore
    }
}


module.exports = createEditor
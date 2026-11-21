/*
 * Archivo JSON pequeño con escritura atómica.
 * Si el archivo no existe o está dañado, arranca con `fallback`.
 */

const fs = require('fs')
const path = require('path')


function createStore(file, fallback) {
    let data

    function load() {
        try {
            const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))

            data = parsed && typeof parsed === 'object' ? parsed : structuredClone(fallback)
        } catch {
            data = structuredClone(fallback)
        }

        return data
    }

    load()

    function save() {
        fs.mkdirSync(path.dirname(file), { recursive: true })

        const tmp = `${file}.${process.pid}.tmp`

        fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')

        fs.renameSync(tmp, file)
    }

    return {
        get: () => data,
        save,
        reload: load
    }
}


module.exports = createStore

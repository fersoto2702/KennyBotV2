const fs = require('fs')
const path = require('path')

const ROOT = __dirname

const IGNORE = [
    'node_modules',
    '.git',
    'auth_info',
    'assets'
]

let scanned = 0
let modified = 0

function walk(dir) {

    const files = fs.readdirSync(dir)

    for (const file of files) {

        const full =
            path.join(dir, file)

        const stat =
            fs.statSync(full)

        if (stat.isDirectory()) {

            if (!IGNORE.includes(file)) {

                walk(full)

            }

            continue

        }

        if (!file.endsWith('.js')) continue

        processFile(full)

    }

}

function processFile(file) {

    scanned++

    let code =
        fs.readFileSync(file, 'utf8')

    const original =
        code

    // Eliminar iconPath
    code = code.replace(
        /const\s+iconPath\s*=\s*path\.join\([\s\S]*?\)\s*\n?/g,
        ''
    )

    // image: fs.readFileSync(iconPath)
    code = code.replace(
        /image\s*:\s*fs\.readFileSync\(iconPath\)\s*,?/g,
        ''
    )

    // image: { url: iconPath }
    code = code.replace(
        /image\s*:\s*\{\s*url\s*:\s*iconPath\s*\}\s*,?/g,
        ''
    )

    // caption:
    code = code.replace(
        /caption\s*:/g,
        'text:'
    )

    // Eliminar require('fs')
    if (
        !code.includes('fs.')
    ) {

        code = code.replace(
            /const\s+fs\s*=\s*require\('fs'\)\s*\n?/g,
            ''
        )

    }

    // Eliminar require('path')
    if (
        !code.includes('path.')
    ) {

        code = code.replace(
            /const\s+path\s*=\s*require\('path'\)\s*\n?/g,
            ''
        )

    }

    if (code !== original) {

        modified++

        fs.writeFileSync(
            file,
            code
        )

        console.log(
            `✔ ${path.relative(ROOT, file)}`
        )

    }

}

console.clear()

console.log('══════════════════════════════')
console.log(' KennyBot Icon Cleaner')
console.log('══════════════════════════════')

walk(ROOT)

console.log('\n──────────────')

console.log(`Archivos revisados : ${scanned}`)
console.log(`Archivos modificados : ${modified}`)

console.log('\n✅ Limpieza terminada.')
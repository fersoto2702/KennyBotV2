/*
 * Administra los usuarios del panel desde la terminal.
 *
 *     node tools/panel-user.js add kenny admin
 *     node tools/panel-user.js add ayudante mod
 *     node tools/panel-user.js list
 *     node tools/panel-user.js passwd kenny
 *     node tools/panel-user.js revoke kenny      (cierra todas sus sesiones)
 *     node tools/panel-user.js remove ayudante
 *
 * La contraseña se pide aquí, sin eco, y no queda en el historial.
 */

const path = require('path')
const readline = require('readline')

try { require('dotenv').config() } catch {}

const createAuth = require('../src/utils/panel/auth')


const usersFile = process.env.PANEL_USERS_FILE
    || path.join(__dirname, '..', 'database', 'panel-users.json')

const secret = process.env.PANEL_SECRET || process.env.PANEL_TOKEN || 'solo-para-administrar-usuarios'

const auth = createAuth({ usersFile, secret })


function ask(question, hidden = false) {
    return new Promise(resolve => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

        if (hidden) {
            rl._writeToOutput = () => {}
        }

        process.stdout.write(question)

        rl.question('', answer => {
            rl.close()

            if (hidden) {
                process.stdout.write('\n')
            }

            resolve(answer)
        })
    })
}


async function main() {
    const [ , , cmd, name, role ] = process.argv

    if (cmd === 'list') {
        const users = auth.listUsers()

        if (!users.length) {
            return console.log('Todavía no hay usuarios.')
        }

        return users.forEach(u => console.log(`${u.name.padEnd(20)} ${u.role}`))
    }

    if (cmd === 'add' || cmd === 'passwd') {
        if (!name) {
            return console.log(`Uso: node tools/panel-user.js ${cmd} <usuario>${cmd === 'add' ? ' <admin|mod|viewer>' : ''}`)
        }

        const current = auth.listUsers().find(u => u.name === name.toLowerCase())

        const finalRole = cmd === 'passwd' ? current?.role : (role || 'viewer')

        if (cmd === 'passwd' && !current) {
            return console.log('Ese usuario no existe.')
        }

        const one = await ask('Contraseña (mínimo 10 caracteres): ', true)
        const two = await ask('Repítela: ', true)

        if (one !== two) {
            return console.log('No coinciden. No se guardó nada.')
        }

        await auth.setUser(name, one, finalRole)

        return console.log(`Listo: ${name.toLowerCase()} (${finalRole}).`)
    }

    if (cmd === 'revoke') {
        return console.log(auth.revokeSessions(name) ? 'Sesiones cerradas.' : 'Ese usuario no existe.')
    }

    if (cmd === 'remove') {
        return console.log(auth.removeUser(name) ? 'Usuario eliminado.' : 'Ese usuario no existe.')
    }

    console.log('Comandos: add, list, passwd, revoke, remove')
}


main().catch(err => {
    console.error(err.message)

    process.exit(1)
})

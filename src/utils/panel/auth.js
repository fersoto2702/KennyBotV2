/*
 * Usuarios y sesiones del panel.
 *
 * - Las contraseñas se guardan con scrypt (nunca en texto plano).
 * - La sesión es un token firmado (HMAC-SHA256) que caduca solo.
 * - Hay límite de intentos fallidos por IP y por usuario.
 *
 * Roles:
 *     admin   → todo (reiniciar, editor, alertas)
 *     mod     → recargar, warns, grupos, comandos on/off
 *     viewer  → solo mirar
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')


const ROLES = [ 'admin', 'mod', 'viewer' ]

const PERMISSIONS = {
    admin: [ '*' ],
    mod: [ 'read', 'reload', 'warns', 'groups', 'commands' ],
    viewer: [ 'read' ]
}

const MIN_PASSWORD = 10


function b64(buffer) {
    return Buffer.from(buffer).toString('base64url')
}


function scrypt(password, salt) {
    return new Promise((resolve, reject) => {
        crypto.scrypt(String(password), salt, 64, (err, key) => {
            if (err) {
                return reject(err)
            }

            resolve(key)
        })
    })
}


function createAuth({
    usersFile,
    secret,
    sessionHours = 12,
    maxFailures = 8,
    lockMinutes = 15
}) {
    if (!secret || secret.length < 16) {
        throw new Error('Falta PANEL_SECRET (o PANEL_TOKEN) de al menos 16 caracteres para firmar las sesiones.')
    }

    const failures = new Map()


    /* ───────── archivo de usuarios ───────── */

    function read() {
        try {
            if (fs.existsSync(usersFile)) {
                const data = JSON.parse(fs.readFileSync(usersFile, 'utf8'))

                return data && typeof data.users === 'object' ? data : { users: {} }
            }
        } catch {}

        return { users: {} }
    }


    function write(data) {
        fs.mkdirSync(path.dirname(usersFile), { recursive: true })

        const tmp = usersFile + '.tmp'

        fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 })
        fs.renameSync(tmp, usersFile)
    }


    const hasUsers = () => Object.keys(read().users).length > 0


    /* ───────── alta y baja (la usa la herramienta de línea de comandos) ───────── */

    async function setUser(name, password, role = 'viewer') {
        name = String(name || '').trim().toLowerCase()

        if (!/^[a-z0-9_.-]{3,32}$/.test(name)) {
            throw new Error('El usuario debe tener de 3 a 32 caracteres: letras, números, punto, guion o guion bajo.')
        }

        if (!ROLES.includes(role)) {
            throw new Error(`Rol inválido. Usa: ${ROLES.join(', ')}`)
        }

        if (String(password || '').length < MIN_PASSWORD) {
            throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`)
        }

        const salt = crypto.randomBytes(16)
        const hash = await scrypt(password, salt)

        const data = read()

        data.users[name] = {
            role,
            salt: b64(salt),
            hash: b64(hash),
            version: (data.users[name]?.version || 0) + 1,
            createdAt: data.users[name]?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }

        write(data)

        return name
    }


    function removeUser(name) {
        const data = read()

        if (!data.users[name]) {
            return false
        }

        delete data.users[name]

        write(data)

        return true
    }


    const listUsers = () => Object.entries(read().users).map(([ name, u ]) => ({
        name,
        role: u.role,
        createdAt: u.createdAt
    }))


    function revokeSessions(name) {
        const data = read()

        if (!data.users[name]) {
            return false
        }

        data.users[name].version = (data.users[name].version || 0) + 1

        write(data)

        return true
    }


    /* ───────── límite de intentos ───────── */

    function lockedFor(key) {
        const f = failures.get(key)

        if (!f) {
            return 0
        }

        if (Date.now() - f.first > lockMinutes * 60000) {
            failures.delete(key)

            return 0
        }

        return f.count >= maxFailures
            ? Math.ceil((lockMinutes * 60000 - (Date.now() - f.first)) / 1000)
            : 0
    }


    function fail(key) {
        const f = failures.get(key)

        if (!f || Date.now() - f.first > lockMinutes * 60000) {
            failures.set(key, { count: 1, first: Date.now() })
        } else {
            f.count++
        }
    }


    /* ───────── login y sesiones ───────── */

    const DUMMY_SALT = crypto.randomBytes(16)


    async function login(name, password, ip) {
        name = String(name || '').trim().toLowerCase()

        const wait = Math.max(lockedFor('ip:' + ip), lockedFor('user:' + name))

        if (wait) {
            const err = new Error(`Demasiados intentos. Espera ${Math.ceil(wait / 60)} min e inténtalo de nuevo.`)

            err.code = 429

            throw err
        }

        const user = read().users[name]

        /* Siempre calculamos el hash, exista o no el usuario, para no revelar cuáles existen. */
        const hash = await scrypt(password, user ? Buffer.from(user.salt, 'base64url') : DUMMY_SALT)

        const ok = user
            && Buffer.from(user.hash, 'base64url').length === hash.length
            && crypto.timingSafeEqual(Buffer.from(user.hash, 'base64url'), hash)

        if (!ok) {
            fail('ip:' + ip)
            fail('user:' + name)

            const err = new Error('Usuario o contraseña incorrectos.')

            err.code = 401

            throw err
        }

        failures.delete('ip:' + ip)
        failures.delete('user:' + name)

        const exp = Date.now() + sessionHours * 3600000

        const payload = b64(JSON.stringify({
            u: name,
            r: user.role,
            v: user.version || 1,
            exp,
            n: crypto.randomBytes(6).toString('hex')
        }))

        const sig = b64(crypto.createHmac('sha256', secret).update(payload).digest())

        return {
            token: `${payload}.${sig}`,
            user: name,
            role: user.role,
            expiresAt: exp
        }
    }


    function check(token) {
        const [ payload, sig ] = String(token || '').split('.')

        if (!payload || !sig) {
            return null
        }

        const good = b64(crypto.createHmac('sha256', secret).update(payload).digest())

        if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) {
            return null
        }

        try {
            const p = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))

            if (!p.exp || p.exp < Date.now()) {
                return null
            }

            const user = read().users[p.u]

            if (!user || (user.version || 1) !== p.v) {
                return null
            }

            return { user: p.u, role: user.role }
        } catch {
            return null
        }
    }


    const can = (role, action) => {
        const list = PERMISSIONS[role] || []

        return list.includes('*') || list.includes(action)
    }


    return {
        hasUsers,
        setUser,
        removeUser,
        listUsers,
        revokeSessions,
        login,
        check,
        can,
        ROLES
    }
}


module.exports = createAuth

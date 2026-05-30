const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('./logger')

const warnPath =
    path.join(
        __dirname,
        '../../database/warnings.json'
    )

const ensureDb = () => {

    try {

        if (!fs.existsSync(warnPath)) {
            fs.writeFileSync(
                warnPath,
                JSON.stringify({}, null, 2)
            )
        }

    } catch (err) {

        logger.error(
            `Warn DB Init Error: ${err.message}`
        )

    }

}

ensureDb()

const normalize = value =>
    String(value || '').trim()

const readWarns = () => {

    try {

        ensureDb()

        const raw =
            fs.readFileSync(warnPath, 'utf8')

        return JSON.parse(raw)

    } catch (err) {

        logger.error(
            `Warn Read Error: ${err.message}`
        )

        return {}

    }

}

const saveWarns = data => {

    try {

        fs.writeFileSync(
            warnPath,
            JSON.stringify(data, null, 2)
        )

        return true

    } catch (err) {

        logger.error(
            `Warn Save Error: ${err.message}`
        )

        return false

    }

}

const addWarn = (group, user) => {

    try {

        const gid = normalize(group)
        const uid = normalize(user)

        if (!gid || !uid) return 0

        const data = readWarns()

        if (!data[gid]) {
            data[gid] = {}
        }

        if (typeof data[gid][uid] !== 'number') {
            data[gid][uid] = 0
        }

        data[gid][uid] += 1

        saveWarns(data)

        return data[gid][uid]

    } catch (err) {

        logger.error(
            `Add Warn Error: ${err.message}`
        )

        return 0

    }

}

const getWarns = (group, user) => {

    try {

        const gid = normalize(group)
        const uid = normalize(user)

        if (!gid || !uid) return 0

        const data = readWarns()

        return Number(data?.[gid]?.[uid] || 0)

    } catch {
        return 0
    }

}

const resetWarns = (group, user) => {

    try {

        const gid = normalize(group)
        const uid = normalize(user)

        if (!gid || !uid) return false

        const data = readWarns()

        if (!data?.[gid]?.[uid]) return false

        delete data[gid][uid]

        if (Object.keys(data[gid]).length === 0) {
            delete data[gid]
        }

        saveWarns(data)

        return true

    } catch (err) {

        logger.error(
            `Reset Warn Error: ${err.message}`
        )

        return false

    }

}

const clearGroupWarns = group => {

    try {

        const gid = normalize(group)

        if (!gid) return false

        const data = readWarns()

        if (!data[gid]) return false

        delete data[gid]

        saveWarns(data)

        return true

    } catch {
        return false
    }

}

const getTopWarns = (group, limit = 10) => {

    try {

        const gid = normalize(group)

        const data = readWarns()

        const users =
            Object.entries(data?.[gid] || {})

        return users
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)

    } catch {
        return []
    }

}

module.exports = {
    addWarn,
    getWarns,
    resetWarns,
    clearGroupWarns,
    getTopWarns
}
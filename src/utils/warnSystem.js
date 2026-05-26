const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('./logger')

// =========================
// PATH
// =========================

const warnPath =

    path.join(

        __dirname,

        '../../database/warnings.json'

    )

// =========================
// INIT
// =========================

const ensureDb = () => {

    try {

        if (
            !fs.existsSync(warnPath)
        ) {

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

// =========================
// NORMALIZE
// =========================

const normalize = value =>

    String(value || '')
        .trim()

// =========================
// READ
// =========================

const readWarns = () => {

    try {

        ensureDb()

        const raw =

            fs.readFileSync(
                warnPath,
                'utf8'
            )

        return JSON.parse(raw)

    } catch (err) {

        logger.error(

            `Warn Read Error: ${err.message}`

        )

        return {}

    }

}

// =========================
// SAVE
// =========================

const saveWarns = data => {

    try {

        fs.writeFileSync(

            warnPath,

            JSON.stringify(
                data,
                null,
                2
            )

        )

        return true

    } catch (err) {

        logger.error(

            `Warn Save Error: ${err.message}`

        )

        return false

    }

}

// =========================
// ADD WARN
// =========================

const addWarn = (

    group,
    user

) => {

    try {

        const gid =
            normalize(group)

        const uid =
            normalize(user)

        if (!gid || !uid)
            return 0

        const data =
            readWarns()

        // =========================
        // CREATE GROUP
        // =========================

        if (!data[gid]) {

            data[gid] = {}

        }

        // =========================
        // CREATE USER
        // =========================

        if (

            typeof data[gid][uid] !== 'number'

        ) {

            data[gid][uid] = 0

        }

        // =========================
        // ADD
        // =========================

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

// =========================
// GET WARNS
// =========================

const getWarns = (

    group,
    user

) => {

    try {

        const gid =
            normalize(group)

        const uid =
            normalize(user)

        if (!gid || !uid)
            return 0

        const data =
            readWarns()

        return Number(
            data?.[gid]?.[uid] || 0
        )

    } catch {

        return 0

    }

}

// =========================
// RESET USER WARNS
// =========================

const resetWarns = (

    group,
    user

) => {

    try {

        const gid =
            normalize(group)

        const uid =
            normalize(user)

        if (!gid || !uid)
            return false

        const data =
            readWarns()

        if (

            !data?.[gid]?.[uid]

        ) {

            return false

        }

        delete data[gid][uid]

        // =========================
        // CLEAN EMPTY GROUP
        // =========================

        if (

            Object.keys(data[gid]).length === 0

        ) {

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

// =========================
// CLEAR GROUP WARNS
// =========================

const clearGroupWarns = group => {

    try {

        const gid =
            normalize(group)

        if (!gid)
            return false

        const data =
            readWarns()

        if (!data[gid])
            return false

        delete data[gid]

        saveWarns(data)

        return true

    } catch {

        return false

    }

}

// =========================
// TOP WARNED USERS
// =========================

const getTopWarns = (

    group,
    limit = 10

) => {

    try {

        const gid =
            normalize(group)

        const data =
            readWarns()

        const users =
            Object.entries(
                data?.[gid] || {}
            )

        return users

            .sort(
                (a, b) => b[1] - a[1]
            )

            .slice(0, limit)

    } catch {

        return []

    }

}

// =========================
// EXPORTS
// =========================

module.exports = {

    addWarn,

    getWarns,

    resetWarns,

    clearGroupWarns,

    getTopWarns

}
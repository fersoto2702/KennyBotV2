const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('./logger')

// =========================
// PATH
// =========================

const togglesPath =

    path.join(

        __dirname,

        '../../database/toggles.json'

    )

// =========================
// INIT
// =========================

const ensureDb = () => {

    try {

        if (
            !fs.existsSync(togglesPath)
        ) {

            fs.writeFileSync(

                togglesPath,

                JSON.stringify({}, null, 2)

            )

        }

    } catch (err) {

        logger.error(

            `Toggle DB Init Error: ${err.message}`

        )

    }

}

ensureDb()

// =========================
// READ
// =========================

const getToggles = () => {

    try {

        ensureDb()

        const raw =

            fs.readFileSync(
                togglesPath,
                'utf8'
            )

        return JSON.parse(raw)

    } catch (err) {

        logger.error(

            `Toggle Read Error: ${err.message}`

        )

        return {}

    }

}

// =========================
// SAVE
// =========================

const saveToggles = data => {

    try {

        fs.writeFileSync(

            togglesPath,

            JSON.stringify(
                data,
                null,
                2
            )

        )

        return true

    } catch (err) {

        logger.error(

            `Toggle Save Error: ${err.message}`

        )

        return false

    }

}

// =========================
// NORMALIZE
// =========================

const normalize = value =>

    String(value || '')
        .trim()

// =========================
// CHECK
// =========================

const isEnabled = (

    group,
    feature

) => {

    try {

        const gid =
            normalize(group)

        const feat =
            normalize(feature)

        if (!gid || !feat)
            return true

        const data =
            getToggles()

        return data?.[gid]?.[feat] ?? true

    } catch {

        return true

    }

}

// =========================
// SET
// =========================

const setToggle = (

    group,
    feature,
    value

) => {

    try {

        const gid =
            normalize(group)

        const feat =
            normalize(feature)

        if (!gid || !feat)
            return false

        const data =
            getToggles()

        if (!data[gid]) {

            data[gid] = {}

        }

        data[gid][feat] =
            Boolean(value)

        return saveToggles(data)

    } catch (err) {

        logger.error(

            `Toggle Set Error: ${err.message}`

        )

        return false

    }

}

// =========================
// GET GROUP TOGGLES
// =========================

const getGroupToggles = group => {

    try {

        const gid =
            normalize(group)

        if (!gid)
            return {}

        const data =
            getToggles()

        return data[gid] || {}

    } catch {

        return {}

    }

}

// =========================
// REMOVE FEATURE
// =========================

const removeToggle = (

    group,
    feature

) => {

    try {

        const gid =
            normalize(group)

        const feat =
            normalize(feature)

        const data =
            getToggles()

        if (
            !data[gid] ||
            !data[gid][feat]
        ) {

            return false

        }

        delete data[gid][feat]

        return saveToggles(data)

    } catch {

        return false

    }

}

// =========================
// EXPORTS
// =========================

module.exports = {

    isEnabled,

    setToggle,

    getGroupToggles,

    removeToggle

}
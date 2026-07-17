const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('./logger')

const togglesPath =
    path.join(
        __dirname,
        '../../database/toggles.json'
    )

const ensureDb = () => {

    try {

        if (!fs.existsSync(togglesPath)) {
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

const getToggles = () => {

    try {

        ensureDb()

        const raw =
            fs.readFileSync(togglesPath, 'utf8')

        return JSON.parse(raw)

    } catch (err) {

        logger.error(
            `Toggle Read Error: ${err.message}`
        )

        return {}

    }

}

const saveToggles = data => {

    try {

        fs.writeFileSync(
            togglesPath,
            JSON.stringify(data, null, 2)
        )

        return true

    } catch (err) {

        logger.error(
            `Toggle Save Error: ${err.message}`
        )

        return false

    }

}

const normalize = value =>
    String(value || '').trim()

const DEFAULT_TOGGLES = {
    autolevelup: false

}

const isEnabled = (group, feature) => {

    try {

        const gid = normalize(group)
        const feat = normalize(feature)

        if (!gid || !feat) return true

        const data = getToggles()

        if (data?.[gid]?.[feat] !== undefined) {
            return data[gid][feat]
        }

        return DEFAULT_TOGGLES[feat] ?? true

    } catch {

        return DEFAULT_TOGGLES[feature] ?? true

    }

}

const setToggle = (group, feature, value) => {

    try {

        const gid = normalize(group)
        const feat = normalize(feature)

        if (!gid || !feat) return false

        const data = getToggles()

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

const getGroupToggles = group => {

    try {

        const gid = normalize(group)

        if (!gid) return {}

        const data = getToggles()

        return data[gid] || {}

    } catch {
        return {}
    }

}

const removeToggle = (group, feature) => {

    try {

        const gid = normalize(group)
        const feat = normalize(feature)

        const data = getToggles()

        if (!data[gid] || !data[gid][feat]) {
            return false
        }

        delete data[gid][feat]

        return saveToggles(data)

    } catch {
        return false
    }

}

module.exports = {
    isEnabled,
    setToggle,
    getGroupToggles,
    removeToggle
}
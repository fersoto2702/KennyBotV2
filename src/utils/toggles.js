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

const DEFAULT_TOGGLES = {

    autolevelup:
        false

}

function normalize(
    value
) {

    return String(
        value || ''
    )
        .trim()

}

function ensureDb() {

    try {

        const directory =
            path.dirname(
                togglesPath
            )

        if (
            !fs.existsSync(
                directory
            )
        ) {

            fs.mkdirSync(
                directory,
                {
                    recursive:
                        true
                }
            )

        }

        if (
            !fs.existsSync(
                togglesPath
            )
        ) {

            fs.writeFileSync(
                togglesPath,
                JSON.stringify(
                    {},
                    null,
                    2
                ),
                'utf8'
            )

        }

        return true

    } catch (err) {

        logger.error(
            `Toggle DB Init Error: ${err.stack || err.message}`
        )

        return false

    }

}

function getToggles() {

    try {

        ensureDb()

        const raw =
            fs.readFileSync(
                togglesPath,
                'utf8'
            )

        const data =
            JSON.parse(
                raw
            )

        if (
            !data ||
            typeof data !==
            'object' ||
            Array.isArray(
                data
            )
        ) {

            return {}

        }

        return data

    } catch (err) {

        logger.error(
            `Toggle Read Error: ${err.stack || err.message}`
        )

        return {}

    }

}

function saveToggles(
    data
) {

    try {

        ensureDb()

        fs.writeFileSync(
            togglesPath,
            JSON.stringify(
                data,
                null,
                2
            ),
            'utf8'
        )

        return true

    } catch (err) {

        logger.error(
            `Toggle Save Error: ${err.stack || err.message}`
        )

        return false

    }

}

function getDefaultValue(
    feature
) {

    const feat =
        normalize(
            feature
        )

    if (
        !feat
    ) {

        return false

    }

    if (
        Object.prototype.hasOwnProperty.call(
            DEFAULT_TOGGLES,
            feat
        )
    ) {

        return Boolean(
            DEFAULT_TOGGLES[
                feat
            ]
        )

    }

    return true

}

function isEnabled(
    group,
    feature
) {

    try {

        const gid =
            normalize(
                group
            )

        const feat =
            normalize(
                feature
            )

        if (
            !gid ||
            !feat
        ) {

            return false

        }

        const data =
            getToggles()

        if (
            Object.prototype.hasOwnProperty.call(
                data?.[gid] || {},
                feat
            )
        ) {

            return Boolean(
                data[gid][feat]
            )

        }

        return getDefaultValue(
            feat
        )

    } catch (err) {

        logger.error(
            `Toggle Check Error: ${err.stack || err.message}`
        )

        return getDefaultValue(
            feature
        )

    }

}

function setToggle(
    group,
    feature,
    value
) {

    try {

        const gid =
            normalize(
                group
            )

        const feat =
            normalize(
                feature
            )

        if (
            !gid ||
            !feat
        ) {

            return false

        }

        const data =
            getToggles()

        if (
            !data[gid] ||
            typeof data[gid] !==
            'object' ||
            Array.isArray(
                data[gid]
            )
        ) {

            data[gid] =
                {}

        }

        data[gid][feat] =
            Boolean(
                value
            )

        return saveToggles(
            data
        )

    } catch (err) {

        logger.error(
            `Toggle Set Error: ${err.stack || err.message}`
        )

        return false

    }

}

function getGroupToggles(
    group
) {

    try {

        const gid =
            normalize(
                group
            )

        if (
            !gid
        ) {

            return {}

        }

        const data =
            getToggles()

        const groupData =
            data?.[gid]

        if (
            !groupData ||
            typeof groupData !==
            'object' ||
            Array.isArray(
                groupData
            )
        ) {

            return {}

        }

        return {
            ...groupData
        }

    } catch (err) {

        logger.error(
            `Toggle Group Read Error: ${err.stack || err.message}`
        )

        return {}

    }

}

function removeToggle(
    group,
    feature
) {

    try {

        const gid =
            normalize(
                group
            )

        const feat =
            normalize(
                feature
            )

        if (
            !gid ||
            !feat
        ) {

            return false

        }

        const data =
            getToggles()

        if (
            !data[gid] ||
            !Object.prototype.hasOwnProperty.call(
                data[gid],
                feat
            )
        ) {

            return false

        }

        delete data[gid][feat]

        if (
            Object.keys(
                data[gid]
            ).length ===
            0
        ) {

            delete data[gid]

        }

        return saveToggles(
            data
        )

    } catch (err) {

        logger.error(
            `Toggle Remove Error: ${err.stack || err.message}`
        )

        return false

    }

}

module.exports = {

    isEnabled,

    setToggle,

    getGroupToggles,

    removeToggle

}
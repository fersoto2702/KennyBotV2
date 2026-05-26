const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../utils/logger')

const ui =
    require('../utils/ui')

const {

    isGroupLimited

} = require('./rateLimiter')

// =========================
// PATHS
// =========================

const welcomePath =

    path.join(

        __dirname,

        '../../database/welcome.json'

    )

const joinPath =

    path.join(

        __dirname,

        '../../database/joinMessages.json'

    )

// =========================
// CACHE
// =========================

const metadataCache =
    new Map()

// =========================
// JOIN TRACKER
// =========================

const joinTracker =
    new Map()

// =========================
// CONFIG
// =========================

const CONFIG = {

    cacheTime:
        60000,

    joinDelay:
        3000,

    maxMentions:
        5,

    antiRaidLimit:
        10,

    antiRaidInterval:
        15000

}

// =========================
// SLEEP
// =========================

const sleep = ms =>

    new Promise(

        resolve =>

            setTimeout(
                resolve,
                ms
            )

    )

// =========================
// ENSURE DB
// =========================

function ensureFiles() {

    const databases = [

        [welcomePath, []],

        [joinPath, {}]

    ]

    for (const [file, def] of databases) {

        if (!fs.existsSync(file)) {

            fs.writeFileSync(

                file,

                JSON.stringify(
                    def,
                    null,
                    2
                )

            )

        }

    }

}

// =========================
// GROUP CACHE
// =========================

async function getMetadata(

    sock,
    group

) {

    const cached =
        metadataCache.get(group)

    const now =
        Date.now()

    if (

        cached &&
        now - cached.timestamp <
        CONFIG.cacheTime

    ) {

        return cached.data

    }

    const metadata =

        await sock.groupMetadata(
            group
        )

    metadataCache.set(

        group,

        {

            data: metadata,

            timestamp: now

        }

    )

    return metadata

}

// =========================
// ANTI RAID
// =========================

function detectRaid(group) {

    const now =
        Date.now()

    const joins =

        joinTracker.get(group) || []

    const filtered =

        joins.filter(

            t =>

                now - t <
                CONFIG.antiRaidInterval

        )

    filtered.push(now)

    joinTracker.set(
        group,
        filtered
    )

    return (

        filtered.length >=
        CONFIG.antiRaidLimit

    )

}

// =========================
// EXPORT
// =========================

module.exports = async (

    sock,
    update

) => {

    try {

        ensureFiles()

        // =========================
        // ENABLED
        // =========================

        const welcomeGroups =

            JSON.parse(

                fs.readFileSync(
                    welcomePath
                )

            )

        if (

            !welcomeGroups.includes(
                update.id
            )

        ) return

        // =========================
        // RAID
        // =========================

        if (

            detectRaid(update.id)

        ) {

            logger.warn(

                `Raid detectado: ${update.id}`

            )

            return await sock.safeSendMessage(

                update.id,

                {

                    text:

                        ui.error(

                            'ANTI RAID',

                            'Demasiados usuarios entrando en poco tiempo.'

                        )

                }

            )

        }

        // =========================
        // GROUP FLOOD
        // =========================

        if (

            isGroupLimited(
                update.id,
                'joins'
            )

        ) {

            logger.warn(

                `Join flood: ${update.id}`

            )

            return

        }

        // =========================
        // METADATA
        // =========================

        const metadata =

            await getMetadata(

                sock,
                update.id

            )

        const groupName =
            metadata.subject

        // =========================
        // CUSTOM MSGS
        // =========================

        const joinMessages =

            JSON.parse(

                fs.readFileSync(
                    joinPath
                )

            )

        // =========================
        // PARTICIPANTS
        // =========================

        const participants =

            update.participants.slice(

                0,

                CONFIG.maxMentions

            )

        // =========================
        // JOIN
        // =========================

        if (
            update.action === 'add'
        ) {

            for (const user of participants) {

                await sleep(
                    CONFIG.joinDelay
                )

                logger.event(

                    `Join: ${user.split('@')[0]}`

                )

                // =========================
                // WELCOME
                // =========================

                await sock.safeSendMessage(

                    update.id,

                    {

                        text:

                            ui.success(

                                'BIENVENIDO',

                                [

                                    [

                                        'Usuario',

                                        `@${user.split('@')[0]}`

                                    ],

                                    [

                                        'Grupo',

                                        groupName

                                    ]

                                ]

                            ),

                        mentions: [user]

                    }

                )

                // =========================
                // CUSTOM
                // =========================

                const customMessages =

                    joinMessages[
                        update.id
                    ] || []

                for (const message of customMessages) {

                    await sleep(1000)

                    await sock.safeSendMessage(

                        update.id,

                        {

                            text:

                                message.replace(

                                    /@user/g,

                                    `@${user.split('@')[0]}`

                                ),

                            mentions: [user]

                        }

                    )

                }

            }

        }

        // =========================
        // REMOVE
        // =========================

        if (
            update.action === 'remove'
        ) {

            for (const user of participants) {

                await sleep(
                    1500
                )

                logger.event(

                    `Leave: ${user.split('@')[0]}`

                )

                await sock.safeSendMessage(

                    update.id,

                    {

                        text:

                            ui.info(

                                'HASTA LUEGO',

                                [

                                    [

                                        'Usuario',

                                        `@${user.split('@')[0]}`

                                    ],

                                    [

                                        'Grupo',

                                        groupName

                                    ]

                                ]

                            ),

                        mentions: [user]

                    }

                )

            }

        }

    } catch (err) {

        logger.error(

            `WelcomeSystem Error: ${err.message}`

        )

    }

}
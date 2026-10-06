const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../../src/utils/logger')

const getRank =
    require('../../src/utils/getRank')

const ui =
    require('../../src/utils/ui')


const badgesPath =
    path.join(
        __dirname,
        '../../database/badges.json'
    )

const economyPath =
    path.join(
        __dirname,
        '../../database/economy.json'
    )

const levelsPath =
    path.join(
        __dirname,
        '../../database/levels.json'
    )

const inventoryPath =
    path.join(
        __dirname,
        '../../database/inventory.json'
    )


function normalizeJid(
    jid
) {

    if (!jid) {

        return null

    }


    return String(jid)
        .trim()
        .replace(
            /:\d+@/,
            '@'
        )

}


function getNumber(
    jid
) {

    return String(
        jid || ''
    )
        .split('@')[0]
        .split(':')[0]

}


function ensureJsonFile(
    file
) {

    const directory =
        path.dirname(
            file
        )


    if (
        !fs.existsSync(
            directory
        )
    ) {

        fs.mkdirSync(
            directory,
            {
                recursive: true
            }
        )

    }


    if (
        !fs.existsSync(
            file
        )
    ) {

        fs.writeFileSync(
            file,
            JSON.stringify(
                {},
                null,
                2
            ),
            'utf8'
        )

    }

}


function safeRead(
    file
) {

    ensureJsonFile(
        file
    )


    try {

        const data =
            JSON.parse(
                fs.readFileSync(
                    file,
                    'utf8'
                )
            )


        return (
            data &&
            typeof data === 'object' &&
            !Array.isArray(data)
        )
            ? data
            : {}

    } catch (err) {

        logger.error(
            `Error leyendo ${path.basename(file)}: ${err.message}`
        )

        return {}

    }

}


function safeWrite(
    file,
    data
) {

    fs.writeFileSync(
        file,
        JSON.stringify(
            data,
            null,
            2
        ),
        'utf8'
    )

}


function normalizeNumericValue(
    value,
    fallback = 0
) {

    const number =
        Number(
            value
        )


    return Number.isFinite(number)
        ? number
        : fallback

}


function findExistingKey(
    database,
    jid
) {

    const normalizedTarget =
        normalizeJid(
            jid
        )


    if (!normalizedTarget) {

        return null

    }


    return Object.keys(
        database
    )
        .find(

            key =>
                normalizeJid(
                    key
                ) ===
                normalizedTarget

        ) || null

}


function migrateKey(
    database,
    sender
) {

    const normalizedSender =
        normalizeJid(
            sender
        )


    if (!normalizedSender) {

        return {
            key: null,
            changed: false
        }

    }


    const existingKey =
        findExistingKey(
            database,
            normalizedSender
        )


    if (!existingKey) {

        return {
            key: normalizedSender,
            changed: false
        }

    }


    if (
        existingKey ===
        normalizedSender
    ) {

        return {
            key: normalizedSender,
            changed: false
        }

    }


    database[normalizedSender] =
        database[existingKey]


    delete database[
        existingKey
    ]


    return {
        key: normalizedSender,
        changed: true
    }

}


function formatArray(
    items,
    emptyText
) {

    if (
        !Array.isArray(items) ||
        items.length === 0
    ) {

        return emptyText

    }


    return items
        .map(
            item =>
                String(item)
                    .trim()
        )
        .filter(Boolean)
        .join(', ') ||
        emptyText

}


module.exports = {

    name:
        'profile',

    aliases: [
        'perfil',
        'me',
        'stats'
    ],

    description:
        'Muestra tu perfil completo',

    category:
        'perfil',

    cooldown:
        5,


    async execute({

        sock,
        from,
        msg

    }) {

        try {

            /* ─────────────────────────────
               USUARIO
            ───────────────────────────── */

            const sender =
                normalizeJid(

                    msg.key.participant ||

                    msg.participant ||

                    msg.key.remoteJid

                )


            if (!sender) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE PERFIL',

                                'No se pudo identificar al usuario.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               LEER BASES
            ───────────────────────────── */

            const economy =
                safeRead(
                    economyPath
                )

            const levels =
                safeRead(
                    levelsPath
                )

            const inventory =
                safeRead(
                    inventoryPath
                )

            const badges =
                safeRead(
                    badgesPath
                )


            /* ─────────────────────────────
               MIGRAR CLAVES ANTIGUAS
            ───────────────────────────── */

            const economyMigration =
                migrateKey(
                    economy,
                    sender
                )

            const levelsMigration =
                migrateKey(
                    levels,
                    sender
                )

            const inventoryMigration =
                migrateKey(
                    inventory,
                    sender
                )

            const badgesMigration =
                migrateKey(
                    badges,
                    sender
                )


            let economyChanged =
                economyMigration.changed

            let levelsChanged =
                levelsMigration.changed

            let inventoryChanged =
                inventoryMigration.changed

            let badgesChanged =
                badgesMigration.changed


            /* ─────────────────────────────
               ECONOMÍA
            ───────────────────────────── */

            if (
                !economy[sender] ||
                typeof economy[sender] !== 'object' ||
                Array.isArray(
                    economy[sender]
                )
            ) {

                economy[sender] = {

                    coins: 0,

                    bank: 0

                }

                economyChanged =
                    true

            }


            const normalizedCoins =
                normalizeNumericValue(

                    economy[sender].coins,

                    0

                )


            const normalizedBank =
                normalizeNumericValue(

                    economy[sender].bank,

                    0

                )


            if (
                economy[sender].coins !==
                normalizedCoins
            ) {

                economy[sender].coins =
                    normalizedCoins

                economyChanged =
                    true

            }


            if (
                economy[sender].bank !==
                normalizedBank
            ) {

                economy[sender].bank =
                    normalizedBank

                economyChanged =
                    true

            }


            /* ─────────────────────────────
               NIVELES
            ───────────────────────────── */

            if (
                !levels[sender] ||
                typeof levels[sender] !== 'object' ||
                Array.isArray(
                    levels[sender]
                )
            ) {

                levels[sender] = {

                    xp: 0,

                    level: 1

                }

                levelsChanged =
                    true

            }


            const normalizedXp =
                normalizeNumericValue(

                    levels[sender].xp,

                    0

                )


            const normalizedLevel =
                Math.max(

                    1,

                    normalizeNumericValue(

                        levels[sender].level,

                        1

                    )

                )


            if (
                levels[sender].xp !==
                normalizedXp
            ) {

                levels[sender].xp =
                    normalizedXp

                levelsChanged =
                    true

            }


            if (
                levels[sender].level !==
                normalizedLevel
            ) {

                levels[sender].level =
                    normalizedLevel

                levelsChanged =
                    true

            }


            /* ─────────────────────────────
               INVENTARIO
            ───────────────────────────── */

            if (
                !Array.isArray(
                    inventory[sender]
                )
            ) {

                inventory[sender] =
                    []

                inventoryChanged =
                    true

            }


            /* ─────────────────────────────
               BADGES
            ───────────────────────────── */

            if (
                !Array.isArray(
                    badges[sender]
                )
            ) {

                badges[sender] =
                    []

                badgesChanged =
                    true

            }


            /* ─────────────────────────────
               GUARDAR SOLO SI CAMBIÓ
            ───────────────────────────── */

            if (
                economyChanged
            ) {

                safeWrite(
                    economyPath,
                    economy
                )

            }


            if (
                levelsChanged
            ) {

                safeWrite(
                    levelsPath,
                    levels
                )

            }


            if (
                inventoryChanged
            ) {

                safeWrite(
                    inventoryPath,
                    inventory
                )

            }


            if (
                badgesChanged
            ) {

                safeWrite(
                    badgesPath,
                    badges
                )

            }


            /* ─────────────────────────────
               DATOS DEL PERFIL
            ───────────────────────────── */

            const wallet =
                economy[sender].coins

            const bank =
                economy[sender].bank

            const total =
                wallet +
                bank

            const level =
                levels[sender].level

            const xp =
                levels[sender].xp

            const rankName =
                getRank(
                    level
                )


            /* ─────────────────────────────
               RANKING GLOBAL
            ───────────────────────────── */

            const users =
                Object.entries(
                    levels
                )
                    .filter(

                        ([
                            id,
                            data
                        ]) =>

                            Boolean(
                                normalizeJid(
                                    id
                                )
                            )

                            &&

                            data &&
                            typeof data === 'object'

                    )


            users.sort(

                (a, b) => {

                    const levelA =
                        normalizeNumericValue(
                            a[1]?.level,
                            1
                        )

                    const levelB =
                        normalizeNumericValue(
                            b[1]?.level,
                            1
                        )


                    if (
                        levelB !== levelA
                    ) {

                        return (
                            levelB -
                            levelA
                        )

                    }


                    const xpA =
                        normalizeNumericValue(
                            a[1]?.xp,
                            0
                        )

                    const xpB =
                        normalizeNumericValue(
                            b[1]?.xp,
                            0
                        )


                    return (
                        xpB -
                        xpA
                    )

                }

            )


            const rankIndex =
                users.findIndex(

                    ([id]) =>
                        normalizeJid(
                            id
                        ) ===
                        sender

                )


            const rankPos =
                rankIndex >= 0
                    ? rankIndex + 1
                    : users.length


            /* ─────────────────────────────
               INVENTARIO / BADGES
            ───────────────────────────── */

            const invText =
                formatArray(

                    inventory[sender],

                    'Vacío'

                )


            const badgeText =
                formatArray(

                    badges[sender],

                    'Sin logros'

                )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Profile check: ${getNumber(sender)}`

            )


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            return await sock.sendMessage(

                from,

                {

                    text: [

                        'ㅤ۟∩　ׅ　👤　ׅ　*PERFIL GLOBAL*　ׄᰙ',

                        '',

                        `𖣣ֶㅤ֯⌗ 👤  ׄ ⬭ *Usuario:* @${getNumber(sender)}`,

                        '',

                        'ㅤ۟∩　ׅ　⭐　ׅ　*PROGRESO*',

                        '',

                        `𖣣ֶㅤ֯⌗ ⭐  ׄ ⬭ *Nivel:* ${Number(level).toLocaleString()}`,

                        `𖣣ֶㅤ֯⌗ ✨  ׄ ⬭ *XP:* ${Number(xp).toLocaleString()}`,

                        `𖣣ֶㅤ֯⌗ 👑  ׄ ⬭ *Rango:* ${rankName}`,

                        `𖣣ֶㅤ֯⌗ 🏆  ׄ ⬭ *Global:* #${rankPos} de ${users.length}`,

                        '',

                        'ㅤ۟∩　ׅ　💰　ׅ　*ECONOMÍA*',

                        '',

                        `𖣣ֶㅤ֯⌗ 🪙  ׄ ⬭ *Wallet:* ${Number(wallet).toLocaleString()}`,

                        `𖣣ֶㅤ֯⌗ 🏦  ׄ ⬭ *Banco:* ${Number(bank).toLocaleString()}`,

                        `𖣣ֶㅤ֯⌗ 💸  ׄ ⬭ *Total:* ${Number(total).toLocaleString()}`,

                        '',

                        'ㅤ۟∩　ׅ　🎒　ׅ　*COLECCIÓN*',

                        '',

                        `𖣣ֶㅤ֯⌗ 🎒  ׄ ⬭ *Items:* ${invText}`,

                        `𖣣ֶㅤ֯⌗ 🏅  ׄ ⬭ *Badges:* ${badgeText}`,

                        '',

                        '╰─ 𓂃 Perfil actualizado'

                    ]
                        .filter(Boolean)
                        .join('\n'),

                    mentions: [
                        sender
                    ]

                }

            )


        } catch (err) {

            logger.error(

                `Error profile: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE PERFIL',

                                'No se pudo cargar tu perfil.'

                            )

                    }

                )

            } catch {}

        }

    }

}
const fs =
    require('fs')

const path =
    require('path')

const logger =
    require('../utils/logger')

const ui =
    require('../utils/ui')

const badgesPath =
    path.join(
        __dirname,
        '../../database/badges.json'
    )

const levelsPath =
    path.join(
        __dirname,
        '../../database/levels.json'
    )

const economyPath =
    path.join(
        __dirname,
        '../../database/economy.json'
    )

const MAX_BADGES_PER_MESSAGE =
    3

const BADGE_RULES = [

    {
        id:
            '🥉 Nivel 10',

        check:
            (lvl, money) =>
                lvl >= 10
    },

    {
        id:
            '🥈 Nivel 25',

        check:
            (lvl, money) =>
                lvl >= 25
    },

    {
        id:
            '🥇 Nivel 50',

        check:
            (lvl, money) =>
                lvl >= 50
    },

    {
        id:
            '💰 Millonario',

        check:
            (lvl, money) =>
                money >= 50000
    },

    {
        id:
            '💎 Multimillonario',

        check:
            (lvl, money) =>
                money >= 200000
    }

]

function normalizeJid(
    jid
) {

    if (!jid) {

        return null

    }

    return String(
        jid
    )
        .trim()
        .replace(
            /:\d+@/,
            '@'
        )

}

function getBotName(
    sock
) {

    return String(
        sock?.botProfile?.name ||
        'KennyBot'
    )
        .trim()

}

function ensureDirectory(
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
                recursive:
                    true
            }
        )

    }

}

function ensureDatabases() {

    const databases = [

        badgesPath,

        levelsPath,

        economyPath

    ]

    for (
        const file
        of databases
    ) {

        try {

            ensureDirectory(
                file
            )

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

        } catch (err) {

            logger.error(
                `Badge DB Init Error (${path.basename(file)}): ${err.stack || err.message}`
            )

        }

    }

}

function readJson(
    file
) {

    try {

        const raw =
            fs.readFileSync(
                file,
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
            `Badge DB Read Error (${path.basename(file)}): ${err.stack || err.message}`
        )

        return {}

    }

}

function writeJson(
    file,
    data
) {

    try {

        fs.writeFileSync(
            file,
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
            `Badge DB Write Error (${path.basename(file)}): ${err.stack || err.message}`
        )

        return false

    }

}

module.exports =
    async (
        sock,
        msg,
        from
    ) => {

        try {

            if (
                !msg?.message
            ) {

                return false

            }

            if (
                msg.key?.fromMe
            ) {

                return false

            }

            if (
                !from ||
                typeof from !==
                'string'
            ) {

                return false

            }

            const sender =
                normalizeJid(

                    msg.key?.participant ||

                    msg.participant ||

                    msg.key?.remoteJid

                )

            if (
                !sender
            ) {

                return false

            }

            const botName =
                getBotName(
                    sock
                )

            ensureDatabases()

            const badges =
                readJson(
                    badgesPath
                )

            const levels =
                readJson(
                    levelsPath
                )

            const economy =
                readJson(
                    economyPath
                )

            if (
                !Array.isArray(
                    badges[sender]
                )
            ) {

                badges[sender] =
                    []

            }

            const level =
                Math.max(
                    1,
                    Number(
                        levels[sender]?.level ||
                        1
                    )
                )

            const coins =
                Number(
                    economy[sender]?.coins ||
                    0
                )

            const bank =
                Number(
                    economy[sender]?.bank ||
                    0
                )

            const money =
                (
                    Number.isFinite(
                        coins
                    )
                        ? coins
                        : 0
                )
                +
                (
                    Number.isFinite(
                        bank
                    )
                        ? bank
                        : 0
                )

            const newBadges =
                []

            for (
                const rule
                of BADGE_RULES
            ) {

                if (
                    newBadges.length >=
                    MAX_BADGES_PER_MESSAGE
                ) {

                    break

                }

                let unlocked =
                    false

                try {

                    unlocked =
                        Boolean(
                            rule.check(
                                level,
                                money
                            )
                        )

                } catch {

                    unlocked =
                        false

                }

                const alreadyHas =
                    badges[sender].includes(
                        rule.id
                    )

                if (
                    unlocked &&
                    !alreadyHas
                ) {

                    badges[sender].push(
                        rule.id
                    )

                    newBadges.push(
                        rule.id
                    )

                }

            }

            if (
                newBadges.length ===
                0
            ) {

                return false

            }

            if (
                !writeJson(
                    badgesPath,
                    badges
                )
            ) {

                return false

            }

            logger.event(
                `${botName} | Badges: ${sender.split('@')[0]} → ${newBadges.join(', ')}`
            )

            const badgeText =
                newBadges
                    .map(
                        badge =>
                            `• ${badge}`
                    )
                    .join('\n')

            await sock.safeSendMessage(
                from,
                {
                    text:
                        ui.success(
                            'NUEVOS LOGROS DESBLOQUEADOS',
                            [
                                [
                                    'Usuario',
                                    `@${sender.split('@')[0]}`
                                ],
                                [
                                    'Logros',
                                    `${newBadges.length}`
                                ],
                                [
                                    'Badges',
                                    `\n${badgeText}`
                                ]
                            ]
                        ),

                    mentions:
                        [
                            sender
                        ]
                }
            )

            return true

        } catch (err) {

            logger.error(
                `BadgeHandler Error: ${err.stack || err.message}`
            )

            return false

        }

    }
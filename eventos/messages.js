const fs =
    require('fs')

const path =
    require('path')

const settings =
    require('../src/config/settings')

const badgeHandler =
    require('../src/handlers/badgeHandler')

const antiLinkHandler =
    require('../src/handlers/antiLinkHandler')

const commandHandler =
    require('../src/handlers/commandHandler')

const spamHandler =
    require('../src/handlers/spamHandler')

const levelHandler =
    require('../src/handlers/levelHandler')

const economyHandler =
    require('../src/handlers/economyHandler')

const messageStatsHandler =
    require('../src/handlers/messageStatsHandler')

const {
    ensureMember
} = require(
    '../src/database/repositories/memberRepository'
)

const {
    ensureInitialGoldCard
} = require(
    '../src/database/repositories/memberCardRepository'
)

const {
    registerValidMessage,
    registerCommand
} = require(
    '../src/database/repositories/activityRepository'
)

const {
    registerSeasonMessage,
    registerSeasonCommand
} = require(
    '../src/database/repositories/seasonRepository'
)

const {
    checkCardUnlock
} = require(
    '../src/services/cardUnlockService'
)

const {
    syncMemberObjectivesByType
} = require(
    '../src/services/objectiveProgressService'
)

const getText =
    require('../src/utils/getText')

const logger =
    require('../src/utils/logger')

const ui =
    require('../src/utils/ui')


const processedMessages =
    new Set()


setInterval(() => {

    try {

        processedMessages.clear()

    } catch {}

}, 1000 * 60 * 5)


const mutePath =
    path.join(
        __dirname,
        '../database/mute.json'
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


function isGroup(
    jid
) {

    return Boolean(
        jid &&
        jid.endsWith('@g.us')
    )

}


function ensureMuteDb() {

    try {

        const directory =
            path.dirname(
                mutePath
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
                mutePath
            )
        ) {

            fs.writeFileSync(
                mutePath,
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
            `Mute DB init error: ${err.stack || err.message}`
        )

    }

}


function readMuteDb() {

    ensureMuteDb()


    try {

        const data =
            JSON.parse(
                fs.readFileSync(
                    mutePath,
                    'utf8'
                )
            )


        if (
            !data ||
            typeof data !== 'object' ||
            Array.isArray(data)
        ) {

            return {}

        }


        return data


    } catch (err) {

        logger.error(
            `Mute DB read error: ${err.stack || err.message}`
        )

        return {}

    }

}


function isUserMuted(
    from,
    sender,
    senderAlt
) {

    const data =
        readMuteDb()


    const list =
        Array.isArray(
            data[from]
        )
            ? data[from]
            : []


    const normalizedList =
        list
            .map(
                normalizeJid
            )
            .filter(Boolean)


    const normalizedSender =
        normalizeJid(
            sender
        )


    const normalizedAlt =
        normalizeJid(
            senderAlt
        )


    return (

        normalizedList.includes(
            normalizedSender
        )

        ||

        (
            normalizedAlt &&

            normalizedList.includes(
                normalizedAlt
            )
        )

    )

}


async function syncMessageObjectives(
    memberId
) {

    const types = [

        'MESSAGES',

        'ACTIVE_DAYS',

        'STREAK'

    ]


    for (
        const type of types
    ) {

        try {

            await syncMemberObjectivesByType(

                memberId,

                type

            )

        } catch (err) {

            logger.error(

                `Objective ${type} Sync Error: ${err.stack || err.message}`

            )

        }

    }

}


async function syncCommandObjectives(
    memberId
) {

    try {

        await syncMemberObjectivesByType(

            memberId,

            'COMMANDS'

        )


    } catch (err) {

        logger.error(

            `Objective COMMANDS Sync Error: ${err.stack || err.message}`

        )

    }

}


module.exports = async (
    sock,
    messages
) => {

    try {

        /* ─────────────────────────────
           MENSAJE
        ───────────────────────────── */

        const msg =
            messages?.[0]


        if (!msg) return

        if (!msg.message) return

        if (
            msg.key?.fromMe
        ) return


        if (
            msg.key?.remoteJid ===
            'status@broadcast'
        ) {

            return

        }


        const from =
            msg.key?.remoteJid


        if (!from) {

            return

        }


        /* ─────────────────────────────
           IDENTIDAD
        ───────────────────────────── */

        const sender =
            normalizeJid(

                msg.key?.participant ||

                msg.participant ||

                msg.key?.remoteJid

            )


        const senderAlt =
            normalizeJid(

                msg.key?.participantAlt ||

                msg.participantAlt ||

                null

            )


        if (!sender) {

            return

        }


        /* ─────────────────────────────
           MUTE
        ───────────────────────────── */

        if (
            isGroup(from) &&
            isUserMuted(

                from,

                sender,

                senderAlt

            )
        ) {

            try {

                await sock.sendMessage(

                    from,

                    {

                        delete:
                            msg.key

                    }

                )

            } catch (err) {

                logger.error(

                    `Delete muted msg: ${err.stack || err.message}`

                )

            }


            return

        }


        /* ─────────────────────────────
           MENSAJES ANTIGUOS
        ───────────────────────────── */

        const timestamp =
            Number(
                msg.messageTimestamp ||
                0
            )


        const now =
            Math.floor(
                Date.now() / 1000
            )


        if (
            timestamp &&
            now - timestamp > 15
        ) {

            return

        }


        /* ─────────────────────────────
           ANTI DUPLICADOS
        ───────────────────────────── */

        const messageId =
            msg.key?.id


        if (!messageId) {

            return

        }


        if (
            processedMessages.has(
                messageId
            )
        ) {

            return

        }


        processedMessages.add(
            messageId
        )


        setTimeout(() => {

            processedMessages.delete(
                messageId
            )

        }, 30000)


        /* ─────────────────────────────
           TEXTO
        ───────────────────────────── */

        const text =
            getText(
                msg
            )
                ?.trim()


        if (!text) {

            return

        }


        logger.event(

            `${sender.split('@')[0]} -> ${text}`

        )


        /* ─────────────────────────────
           SPAM
        ───────────────────────────── */

        const isSpam =
            await spamHandler(

                sock,

                msg,

                from

            )


        if (
            isSpam
        ) {

            logger.warn(

                `Spam detectado: ${sender.split('@')[0]}`

            )


            return

        }


        /* ─────────────────────────────
           ANTILINK
        ───────────────────────────── */

        let antiLinkBlocked =
            false


        try {

            antiLinkBlocked =
                Boolean(

                    await antiLinkHandler(

                        sock,

                        msg,

                        from,

                        text

                    )

                )


        } catch (err) {

            logger.error(

                `AntiLink Handler Error: ${err.stack || err.message}`

            )

        }


        if (
            antiLinkBlocked
        ) {

            return

        }


        /* ─────────────────────────────
           MIEMBRO
        ───────────────────────────── */

        let member =
            null


        try {

            member =
                await ensureMember(

                    sender,

                    senderAlt,

                    msg.pushName ||
                    null

                )


            if (
                member
            ) {

                try {

                    await ensureInitialGoldCard(
                        member.id
                    )


                } catch (err) {

                    logger.error(

                        `Member Card DB Error: ${err.stack || err.message}`

                    )

                }

            }


        } catch (err) {

            logger.error(

                `Member DB Error: ${err.stack || err.message}`

            )

        }


        /* ─────────────────────────────
           ACTIVIDAD DE MENSAJES
        ───────────────────────────── */

        if (
            member
        ) {

            try {

                await registerValidMessage(
                    member.id
                )


                await registerSeasonMessage(
                    member.id
                )


                await syncMessageObjectives(
                    member.id
                )


                const unlock =
                    await checkCardUnlock(
                        member.id
                    )


                if (
                    unlock?.unlocked &&
                    unlock?.card
                ) {

                    const memberName =

                        member.display_name ||

                        msg.pushName ||

                        'Miembro'


                    logger.info(

                        `Nueva carta desbloqueada: ${memberName} | ${unlock.card.card_name} | OVR ${unlock.card.rating}`

                    )


                    await sock.safeSendMessage(

                        from,

                        {

                            text: [

                                'ㅤ۟∩　ׅ　🎉　ׅ　*NUEVA CARTA*　ׄᰙ',

                                '',

                                `𖣣ֶㅤ֯⌗ 👤  ׄ ⬭ *Jugador:* ${memberName}`,

                                `𖣣ֶㅤ֯⌗ 🃏  ׄ ⬭ *Carta:* ${unlock.card.card_name}`,

                                `𖣣ֶㅤ֯⌗ ⭐  ׄ ⬭ *OVR:* ${unlock.card.rating}`,

                                '',

                                '╰─ 𓂃 Usa .card para ver tu nueva carta'

                            ]
                                .filter(Boolean)
                                .join('\n')

                        }

                    )

                }


            } catch (err) {

                logger.error(

                    `Activity/Card DB Error: ${err.stack || err.message}`

                )

            }

        }


        /* ─────────────────────────────
           ESTADÍSTICAS
        ───────────────────────────── */

        try {

            await messageStatsHandler(

                msg,

                from

            )


        } catch (err) {

            logger.error(

                `Message Stats Handler Error: ${err.stack || err.message}`

            )

        }


        /* ─────────────────────────────
           NIVELES
        ───────────────────────────── */

        try {

            await levelHandler(

                sock,

                msg,

                from

            )


        } catch (err) {

            logger.error(

                `Level Handler Error: ${err.stack || err.message}`

            )

        }


        /* ─────────────────────────────
           ECONOMÍA
        ───────────────────────────── */

        try {

            await economyHandler(

                sock,

                msg,

                from

            )


        } catch (err) {

            logger.error(

                `Economy Handler Error: ${err.stack || err.message}`

            )

        }


        /* ─────────────────────────────
           BADGES
        ───────────────────────────── */

        try {

            await badgeHandler(

                sock,

                msg,

                from

            )


        } catch (err) {

            logger.error(

                `Badge Handler Error: ${err.stack || err.message}`

            )

        }


        /* ─────────────────────────────
           COMANDOS
        ───────────────────────────── */

        const prefixes =
            Array.isArray(
                settings.prefixes
            )
                ? settings.prefixes

                : [

                    settings.prefix ||
                    '/'

                ]


        const matchedPrefix =
            prefixes.find(

                prefix =>
                    typeof prefix === 'string' &&
                    prefix &&
                    text.startsWith(
                        prefix
                    )

            )


        if (
            !matchedPrefix
        ) {

            return

        }


        /*
            IMPORTANTE:

            Si commandHandler devuelve true
            solamente cuando encontró/ejecutó
            un comando válido, podemos registrar
            COMMANDS después.

            Si actualmente no devuelve nada,
            habría que modificar commandHandler
            para que devuelva true/false.
        */

        let commandProcessed =
            false


        try {

            commandProcessed =
                Boolean(

                    await commandHandler({

                        sock,

                        msg,

                        from,

                        text,

                        settings

                    })

                )


        } catch (err) {

            logger.error(

                `Command Handler Error: ${err.stack || err.message}`

            )


            return

        }


        if (
            commandProcessed &&
            member
        ) {

            try {

                await registerCommand(
                    member.id
                )


                await registerSeasonCommand(
                    member.id
                )


                await syncCommandObjectives(
                    member.id
                )


            } catch (err) {

                logger.error(

                    `Command Activity DB Error: ${err.stack || err.message}`

                )

            }

        }


    } catch (err) {

        logger.error(

            `Messages Event Error: ${err.stack || err.message}`

        )

    }

}
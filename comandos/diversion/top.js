const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const DEFAULT_AMOUNT =
    10

const MIN_AMOUNT =
    1

const MAX_AMOUNT =
    20

const CATEGORIES = {

    guapos: {
        title:
            'GUAPOS',
        emoji:
            '😎'
    },

    guapas: {
        title:
            'GUAPAS',
        emoji:
            '💅'
    },

    solteros: {
        title:
            'SOLTEROS',
        emoji:
            '💘'
    },

    solteras: {
        title:
            'SOLTERAS',
        emoji:
            '💖'
    },

    mijageros: {
        title:
            'MIJAGEROS',
        emoji:
            '🫦'
    },

    mijageras: {
        title:
            'MIJAGERAS',
        emoji:
            '💋'
    },

    celosos: {
        title:
            'CELOSOS',
        emoji:
            '👀'
    },

    celosas: {
        title:
            'CELOSAS',
        emoji:
            '👀'
    },

    toxicos: {
        title:
            'TÓXICOS',
        emoji:
            '☢️'
    },

    toxicas: {
        title:
            'TÓXICAS',
        emoji:
            '☢️'
    },

    intensos: {
        title:
            'INTENSOS',
        emoji:
            '🔥'
    },

    intensas: {
        title:
            'INTENSAS',
        emoji:
            '🔥'
    },

    romanticos: {
        title:
            'ROMÁNTICOS',
        emoji:
            '🌹'
    },

    romanticas: {
        title:
            'ROMÁNTICAS',
        emoji:
            '🌹'
    },

    infieles: {
        title:
            'INFIELES',
        emoji:
            '🤭'
    },

    dormilones: {
        title:
            'DORMILONES',
        emoji:
            '😴'
    },

    dormilonas: {
        title:
            'DORMILONAS',
        emoji:
            '😴'
    },

    lindos: {
        title:
            'LINDOS',
        emoji:
            '🥰'
    },

    lindas: {
        title:
            'LINDAS',
        emoji:
            '🥰'
    },

    graciosos: {
        title:
            'GRACIOSOS',
        emoji:
            '😂'
    },

    graciosas: {
        title:
            'GRACIOSAS',
        emoji:
            '😂'
    }

}

const CATEGORY_ALIASES = {

    guapo:
        'guapos',

    guapa:
        'guapas',

    soltero:
        'solteros',

    soltera:
        'solteras',

    mijagero:
        'mijageros',

    mijagera:
        'mijageras',

    celoso:
        'celosos',

    celosa:
        'celosas',

    toxico:
        'toxicos',

    tóxico:
        'toxicos',

    toxicos:
        'toxicos',

    tóxicos:
        'toxicos',

    toxica:
        'toxicas',

    tóxica:
        'toxicas',

    toxicas:
        'toxicas',

    tóxicas:
        'toxicas',

    intenso:
        'intensos',

    intensa:
        'intensas',

    romantico:
        'romanticos',

    romántico:
        'romanticos',

    romanticos:
        'romanticos',

    románticos:
        'romanticos',

    romantica:
        'romanticas',

    romántica:
        'romanticas',

    romanticas:
        'romanticas',

    románticas:
        'romanticas',

    infiel:
        'infieles',

    dormilon:
        'dormilones',

    dormilón:
        'dormilones',

    dormilona:
        'dormilonas',

    lindo:
        'lindos',

    linda:
        'lindas',

    gracioso:
        'graciosos',

    graciosa:
        'graciosas'

}

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

function normalizeWord(
    value
) {

    return String(
        value ||
        ''
    )
        .trim()
        .toLowerCase()

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

function getParticipantJid(
    participant
) {

    if (!participant) {

        return null

    }

    const candidates = [

        participant.phoneNumber,

        participant.id,

        participant.lid

    ]

    for (
        const candidate
        of candidates
    ) {

        const jid =
            normalizeJid(
                candidate
            )

        if (
            jid
        ) {

            return jid

        }

    }

    return null

}

function getBotJids(
    sock
) {

    return new Set(
        [
            sock?.user?.id,
            sock?.user?.lid
        ]
            .map(
                normalizeJid
            )
            .filter(
                Boolean
            )
    )

}

function shuffle(
    array
) {

    const result =
        [...array]

    for (
        let i =
            result.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (
                    i + 1
                )
            )

        const temporary =
            result[i]

        result[i] =
            result[j]

        result[j] =
            temporary

    }

    return result

}

function parseArguments(
    args
) {

    const values =
        Array.isArray(
            args
        )
            ? args
                .map(
                    value =>
                        String(
                            value ||
                            ''
                        )
                            .trim()
                )
                .filter(
                    Boolean
                )
            : []

    let amount =
        DEFAULT_AMOUNT

    let category =
        null

    for (
        const value
        of values
    ) {

        if (
            /^\d+$/.test(
                value
            )
        ) {

            amount =
                Number(
                    value
                )

            continue

        }

        if (
            !category
        ) {

            category =
                normalizeWord(
                    value
                )

        }

    }

    if (
        category &&
        CATEGORY_ALIASES[
            category
        ]
    ) {

        category =
            CATEGORY_ALIASES[
                category
            ]

    }

    return {
        amount,
        category
    }

}

function getPositionEmoji(
    index
) {

    const positions = [
        '🥇',
        '🥈',
        '🥉'
    ]

    if (
        positions[
            index
        ]
    ) {

        return positions[
            index
        ]

    }

    return `${index + 1}.`

}

function getDisplayUser(
    jid
) {

    const normalized =
        normalizeJid(
            jid
        )

    if (
        !normalized
    ) {

        return 'usuario'

    }

    return normalized
        .split(
            '@'
        )[0]

}

function buildCategoriesText() {

    const unique =
        Object.keys(
            CATEGORIES
        )

    return unique
        .map(
            category =>
                `• ${category}`
        )
        .join(
            '\n'
        )

}

async function sendMessage(
    sock,
    jid,
    content,
    options = {}
) {

    if (
        typeof sock.safeSendMessage ===
        'function'
    ) {

        return await sock.safeSendMessage(
            jid,
            content,
            options
        )

    }

    return await sock.sendMessage(
        jid,
        content,
        options
    )

}

module.exports = {

    name:
        'top',

    aliases: [
        'ranking',
        'rank'
    ],

    description:
        'Genera rankings aleatorios de los miembros del grupo',

    category:
        'diversion',

    groupOnly:
        true,

    async execute({
        sock,
        from,
        args,
        prefix = '.'
    }) {

        try {

            const {
                amount,
                category
            } =
                parseArguments(
                    args
                )

            if (
                !category
            ) {

                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.info(
                                'TOP DEL GRUPO',
                                [
                                    `Uso: ${prefix}top <cantidad> <categoría>`,
                                    '',
                                    'Ejemplos:',
                                    `${prefix}top 5 solteros`,
                                    `${prefix}top 3 guapas`,
                                    `${prefix}top mijageros`,
                                    `${prefix}top 10 toxicos`,
                                    '',
                                    'Categorías:',
                                    buildCategoriesText()
                                ]
                                    .join(
                                        '\n'
                                    )
                            )
                    }
                )

            }

            const categoryData =
                CATEGORIES[
                    category
                ]

            if (
                !categoryData
            ) {

                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.warn(
                                'CATEGORÍA NO ENCONTRADA',
                                [
                                    `No existe la categoría "${category}".`,
                                    '',
                                    'Usa:',
                                    `${prefix}top`,
                                    '',
                                    'para ver las categorías disponibles.'
                                ]
                                    .join(
                                        '\n'
                                    )
                            )
                    }
                )

            }

            if (
                !Number.isInteger(
                    amount
                ) ||
                amount <
                    MIN_AMOUNT
            ) {

                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.warn(
                                'CANTIDAD INVÁLIDA',
                                `La cantidad mínima es ${MIN_AMOUNT}.`
                            )
                    }
                )

            }

            if (
                amount >
                MAX_AMOUNT
            ) {

                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.warn(
                                'CANTIDAD INVÁLIDA',
                                `El máximo permitido es Top ${MAX_AMOUNT}.`
                            )
                    }
                )

            }

            const metadata =
                await sock.groupMetadata(
                    from
                )

            const rawParticipants =
                Array.isArray(
                    metadata?.participants
                )
                    ? metadata.participants
                    : []

            const botJids =
                getBotJids(
                    sock
                )

            const seen =
                new Set()

            const participants =
                rawParticipants
                    .map(
                        getParticipantJid
                    )
                    .filter(
                        jid => {

                            if (
                                !jid
                            ) {

                                return false

                            }

                            if (
                                botJids.has(
                                    jid
                                )
                            ) {

                                return false

                            }

                            if (
                                seen.has(
                                    jid
                                )
                            ) {

                                return false

                            }

                            seen.add(
                                jid
                            )

                            return true

                        }
                    )

            if (
                participants.length ===
                0
            ) {

                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.warn(
                                'SIN PARTICIPANTES',
                                'No encontré miembros disponibles para generar el ranking.'
                            )
                    }
                )

            }

            const finalAmount =
                Math.min(
                    amount,
                    participants.length
                )

            const selected =
                shuffle(
                    participants
                )
                    .slice(
                        0,
                        finalAmount
                    )

            const mentions =
                [...selected]

            const lines =
                selected.map(
                    (
                        jid,
                        index
                    ) => {

                        const number =
                            getDisplayUser(
                                jid
                            )

                        return (
                            `𖣣ֶㅤ֯⌗ ${getPositionEmoji(index)}  ׄ ⬭ @${number}`
                        )

                    }
                )

            const botName =
                getBotName(
                    sock
                )

            const title =
                `TOP ${finalAmount} ${categoryData.title}`

            const message = [

                `ㅤ۟∩　ׅ　${categoryData.emoji}　ׅ　*${title}*　ׄᰙ`,

                '',

                ...lines,

                '',

                `╰─ 𓂃 Ranking aleatorio generado por ${botName}`

            ]
                .join(
                    '\n'
                )

            await sendMessage(
                sock,
                from,
                {
                    text:
                        message,

                    mentions
                }
            )

            logger.event(
                `${botName} | Top ${finalAmount} ${category} | ${from}`
            )

            return true

        } catch (err) {

            logger.error(
                `${getBotName(sock)} | Error top: ${err.stack || err.message}`
            )

            try {

                await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.error(
                                'ERROR',
                                'No se pudo generar el ranking.'
                            )
                    }
                )

            } catch {}

            return false

        }

    }

}
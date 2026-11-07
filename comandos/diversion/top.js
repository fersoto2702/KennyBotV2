const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')

const DEFAULT_AMOUNT = 10
const MIN_AMOUNT = 1
const MAX_AMOUNT = 20

const CATEGORIES = {
    guapos: { title: 'GUAPOS', emoji: '😎' },
    guapas: { title: 'GUAPAS', emoji: '💅' },
    solteros: { title: 'SOLTEROS', emoji: '💘' },
    solteras: { title: 'SOLTERAS', emoji: '💖' },
    mijageros: { title: 'MIJAGEROS', emoji: '🫦' },
    mijageras: { title: 'MIJAGERAS', emoji: '💋' },
    celosos: { title: 'CELOSOS', emoji: '👀' },
    celosas: { title: 'CELOSAS', emoji: '👀' },
    toxicos: { title: 'TÓXICOS', emoji: '☢️' },
    toxicas: { title: 'TÓXICAS', emoji: '☢️' },
    intensos: { title: 'INTENSOS', emoji: '🔥' },
    intensas: { title: 'INTENSAS', emoji: '🔥' },
    romanticos: { title: 'ROMÁNTICOS', emoji: '🌹' },
    romanticas: { title: 'ROMÁNTICAS', emoji: '🌹' },
    infieles: { title: 'INFIELES', emoji: '🤭' },
    dormilones: { title: 'DORMILONES', emoji: '😴' },
    dormilonas: { title: 'DORMILONAS', emoji: '😴' },
    lindos: { title: 'LINDOS', emoji: '🥰' },
    lindas: { title: 'LINDAS', emoji: '🥰' },
    graciosos: { title: 'GRACIOSOS', emoji: '😂' },
    graciosas: { title: 'GRACIOSAS', emoji: '😂' },
    pendejos: { title: 'PENDEJOS', emoji: '🤡' },
    pendejas: { title: 'PENDEJAS', emoji: '🤡' },
    idiotas: { title: 'IDIOTAS', emoji: '🧠' },
    mensos: { title: 'MENSOS', emoji: '😵‍💫' },
    mensas: { title: 'MENSAS', emoji: '😵‍💫' },
    despistados: { title: 'DESPISTADOS', emoji: '🫠' },
    despistadas: { title: 'DESPISTADAS', emoji: '🫠' },
    racistas: { title: 'RACISTAS', emoji: '🚫' },
    narcisistas: { title: 'NARCISISTAS', emoji: '🪞' },
    mentirosos: { title: 'MENTIROSOS', emoji: '🤥' },
    mentirosas: { title: 'MENTIROSAS', emoji: '🤥' },
    chismosos: { title: 'CHISMOSOS', emoji: '🗣️' },
    chismosas: { title: 'CHISMOSAS', emoji: '🗣️' },
    flojos: { title: 'FLOJOS', emoji: '🛋️' },
    flojas: { title: 'FLOJAS', emoji: '🛋️' },
    orgullosos: { title: 'ORGULLOSOS', emoji: '👑' },
    orgullosas: { title: 'ORGULLOSAS', emoji: '👑' },
    dramaticos: { title: 'DRAMÁTICOS', emoji: '🎭' },
    dramaticas: { title: 'DRAMÁTICAS', emoji: '🎭' },
    manipuladores: { title: 'MANIPULADORES', emoji: '🕸️' },
    manipuladoras: { title: 'MANIPULADORAS', emoji: '🕸️' },
    presumidos: { title: 'PRESUMIDOS', emoji: '😏' },
    presumidas: { title: 'PRESUMIDAS', emoji: '😏' },
    fiesteros: { title: 'FIESTEROS', emoji: '🥳' },
    fiesteras: { title: 'FIESTERAS', emoji: '🥳' },
    mamones: { title: 'MAMONES', emoji: '🙄' },
    mamonas: { title: 'MAMONAS', emoji: '🙄' }
}

const CATEGORY_ALIASES = {
    guapo: 'guapos', guapa: 'guapas',
    soltero: 'solteros', soltera: 'solteras',
    mijagero: 'mijageros', mijagera: 'mijageras',
    celoso: 'celosos', celosa: 'celosas',
    toxico: 'toxicos', tóxico: 'toxicos', tóxicos: 'toxicos',
    toxica: 'toxicas', tóxica: 'toxicas', tóxicas: 'toxicas',
    intenso: 'intensos', intensa: 'intensas',
    romantico: 'romanticos', romántico: 'romanticos', románticos: 'romanticos',
    romantica: 'romanticas', romántica: 'romanticas', románticas: 'romanticas',
    infiel: 'infieles',
    dormilon: 'dormilones', dormilón: 'dormilones', dormilona: 'dormilonas',
    lindo: 'lindos', linda: 'lindas',
    gracioso: 'graciosos', graciosa: 'graciosas',
    pendejo: 'pendejos', pendeja: 'pendejas',
    idiota: 'idiotas',
    menso: 'mensos', mensa: 'mensas',
    despistado: 'despistados', despistada: 'despistadas',
    racista: 'racistas',
    narcisista: 'narcisistas', narcicista: 'narcisistas', narcicistas: 'narcisistas',
    mentiroso: 'mentirosos', mentirosa: 'mentirosas',
    chismoso: 'chismosos', chismosa: 'chismosas',
    flojo: 'flojos', floja: 'flojas',
    orgulloso: 'orgullosos', orgullosa: 'orgullosas',
    dramatico: 'dramaticos', dramático: 'dramaticos', dramatica: 'dramaticas', dramática: 'dramaticas',
    manipulador: 'manipuladores', manipuladora: 'manipuladoras',
    presumido: 'presumidos', presumida: 'presumidas',
    fiestero: 'fiesteros', fiestera: 'fiesteras',
    mamon: 'mamones', mamón: 'mamones', mamona: 'mamonas'
}

function normalizeJid(jid) {
    if (!jid) return null
    return String(jid).trim().replace(/:\d+@/, '@')
}

function normalizeWord(value) {
    return String(value || '').trim().toLowerCase()
}

function getBotName(sock) {
    return String(sock?.botProfile?.name || 'KennyBot').trim()
}

function getParticipantJid(participant) {
    if (!participant) return null
    for (const candidate of [participant.phoneNumber, participant.id, participant.lid]) {
        const jid = normalizeJid(candidate)
        if (jid) return jid
    }
    return null
}

function getBotJids(sock) {
    return new Set([sock?.user?.id, sock?.user?.lid].map(normalizeJid).filter(Boolean))
}

function shuffle(array) {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
}

function parseArguments(args) {
    const values = Array.isArray(args)
        ? args.map(v => String(v || '').trim()).filter(Boolean)
        : []

    let amount = DEFAULT_AMOUNT
    let category = null

    for (const value of values) {
        if (/^\d+$/.test(value)) {
            amount = Number(value)
            continue
        }
        if (!category) category = normalizeWord(value)
    }

    if (category && CATEGORY_ALIASES[category]) {
        category = CATEGORY_ALIASES[category]
    }

    return { amount, category }
}

function getPositionEmoji(index) {
    return ['🥇', '🥈', '🥉'][index] || `${index + 1}.`
}

function getDisplayUser(jid) {
    const normalized = normalizeJid(jid)
    return normalized ? normalized.split('@')[0] : 'usuario'
}

function buildCategoriesText() {
    return Object.entries(CATEGORIES)
        .map(([key, data]) => `𖣣ֶㅤ֯⌗ ${data.emoji}  ׄ ⬭ *${data.title}:* ${key}`)
        .join('\n')
}

function buildHelpText(prefix) {
    return [
        'ㅤ۟∩　ׅ　🏆　ׅ　*TOP DEL GRUPO*　ׄᰙ',
        '',
        `𖣣ֶㅤ֯⌗ ✦  ׄ ⬭ *Uso:* ${prefix}top <cantidad> <categoría>`,
        '',
        'ㅤ۟∩　ׅ　📌　ׅ　*EJEMPLOS*　ׄᰙ',
        '',
        `𖣣ֶㅤ֯⌗ •  ׄ ⬭ ${prefix}top 5 solteros`,
        `𖣣ֶㅤ֯⌗ •  ׄ ⬭ ${prefix}top 3 guapas`,
        `𖣣ֶㅤ֯⌗ •  ׄ ⬭ ${prefix}top pendejos`,
        `𖣣ֶㅤ֯⌗ •  ׄ ⬭ ${prefix}top 10 narcisistas`,
        '',
        'ㅤ۟∩　ׅ　📂　ׅ　*CATEGORÍAS DISPONIBLES*　ׄᰙ',
        '',
        buildCategoriesText(),
        '',
        `╰─ 𓂃 Puedes usar de ${MIN_AMOUNT} a ${MAX_AMOUNT} participantes.`
    ].join('\n')
}

async function sendMessage(sock, jid, content, options = {}) {
    if (typeof sock.safeSendMessage === 'function') {
        return await sock.safeSendMessage(jid, content, options)
    }
    return await sock.sendMessage(jid, content, options)
}

module.exports = {
    name: 'top',
    aliases: ['ranking', 'rank'],
    description: 'Genera rankings aleatorios de los miembros del grupo',
    category: 'diversion',
    groupOnly: true,

    async execute({ sock, from, args, prefix = '.' }) {
        try {
            const { amount, category } = parseArguments(args)

            if (!category) {
                return await sendMessage(sock, from, { text: buildHelpText(prefix) })
            }

            const categoryData = CATEGORIES[category]

            if (!categoryData) {
                return await sendMessage(sock, from, {
                    text: [
                        ui.warn('CATEGORÍA NO ENCONTRADA', `No existe la categoría "${category}".`),
                        '',
                        'ㅤ۟∩　ׅ　📂　ׅ　*CATEGORÍAS DISPONIBLES*　ׄᰙ',
                        '',
                        buildCategoriesText(),
                        '',
                        `╰─ 𓂃 Usa ${prefix}top <cantidad> <categoría>`
                    ].join('\n')
                })
            }

            if (!Number.isInteger(amount) || amount < MIN_AMOUNT) {
                return await sendMessage(sock, from, {
                    text: ui.warn('CANTIDAD INVÁLIDA', `La cantidad mínima es ${MIN_AMOUNT}.`)
                })
            }

            if (amount > MAX_AMOUNT) {
                return await sendMessage(sock, from, {
                    text: ui.warn('CANTIDAD INVÁLIDA', `El máximo permitido es Top ${MAX_AMOUNT}.`)
                })
            }

            const metadata = await sock.groupMetadata(from)
            const rawParticipants = Array.isArray(metadata?.participants)
                ? metadata.participants
                : []

            const botJids = getBotJids(sock)
            const seen = new Set()

            const participants = rawParticipants
                .map(getParticipantJid)
                .filter(jid => {
                    if (!jid || botJids.has(jid) || seen.has(jid)) return false
                    seen.add(jid)
                    return true
                })

            if (!participants.length) {
                return await sendMessage(sock, from, {
                    text: ui.warn(
                        'SIN PARTICIPANTES',
                        'No encontré miembros disponibles para generar el ranking.'
                    )
                })
            }

            const finalAmount = Math.min(amount, participants.length)
            const selected = shuffle(participants).slice(0, finalAmount)
            const mentions = [...selected]

            const lines = selected.map((jid, index) =>
                `𖣣ֶㅤ֯⌗ ${getPositionEmoji(index)}  ׄ ⬭ @${getDisplayUser(jid)}`
            )

            const botName = getBotName(sock)
            const title = `TOP ${finalAmount} ${categoryData.title}`

            await sendMessage(sock, from, {
                text: [
                    `ㅤ۟∩　ׅ　${categoryData.emoji}　ׅ　*${title}*　ׄᰙ`,
                    '',
                    ...lines,
                    '',
                    `╰─ 𓂃 Ranking aleatorio generado por ${botName}`
                ].join('\n'),
                mentions
            })

            logger.event(`${botName} | Top ${finalAmount} ${category} | ${from}`)
            return true
        } catch (err) {
            logger.error(`${getBotName(sock)} | Error top: ${err.stack || err.message}`)

            try {
                await sendMessage(sock, from, {
                    text: ui.error('ERROR', 'No se pudo generar el ranking.')
                })
            } catch {}

            return false
        }
    }
}
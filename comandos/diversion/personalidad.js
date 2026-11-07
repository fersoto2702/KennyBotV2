const logger = require('../../src/utils/logger')

function normalizeJid(jid) {
    if (!jid) return null
    return String(jid).trim().replace(/:\d+@/, '@')
}

function getBotName(sock) {
    return String(sock?.botProfile?.name || 'KennyBot').trim()
}

function getSender(msg) {
    return normalizeJid(
        msg?.key?.participant ||
        msg?.participant ||
        msg?.key?.remoteJid
    )
}

function getMentioned(msg) {
    const mentioned =
        msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
        msg?.message?.imageMessage?.contextInfo?.mentionedJid ||
        msg?.message?.videoMessage?.contextInfo?.mentionedJid ||
        []

    return Array.isArray(mentioned)
        ? mentioned.map(normalizeJid).filter(Boolean)
        : []
}

function getQuotedParticipant(msg) {
    return normalizeJid(
        msg?.message?.extendedTextMessage?.contextInfo?.participant
    )
}

function resolveTarget(msg) {
    return (
        getMentioned(msg)[0] ||
        getQuotedParticipant(msg) ||
        getSender(msg)
    )
}

function randomPercent() {
    return Math.floor(Math.random() * 101)
}

function bar(value) {
    const filled = Math.round(value / 10)
    return '█'.repeat(filled) + '░'.repeat(10 - filled)
}

function chooseType(scores) {
    const top = Object.entries(scores)
        .sort((a, b) => b[1] - a[1])[0]?.[0]

    const types = {
        carisma: '✨ CARISMÁTIC@',
        humor: '😂 COMEDIANTE',
        romanticismo: '🌹 ROMÁNTIC@',
        intensidad: '🔥 INTENS@',
        celos: '👀 CELOS@',
        toxicidad: '☢️ PELIGRO EMOCIONAL',
        paciencia: '🧘 PACIENTE',
        locura: '🤪 CAÓTIC@',
        lealtad: '🤝 LEAL',
        orgullo: '👑 ORGULLOS@',
        racismo: '🚫 POLÉMIC@',
        narcisismo: '🪞 MUCHO EGO',
        egocentrismo: '🎯 YO, YO Y YO',
        arrogancia: '😏 SOBRAD@',
        manipulacion: '🕸️ ESTRATEG@',
        sarcasmo: '🙃 SARCÁSTIC@',
        chisme: '🗣️ RADIO PASILLO',
        flojera: '🛋️ MODO AHORRO',
        dramatismo: '🎭 DRAMÁTIC@',
        sinceridad: '💬 SIN FILTRO',
        timidez: '🫣 TÍMID@',
        coqueteria: '😉 COQUET@',
        impulsividad: '⚡ IMPULSIV@',
        madurez: '🧠 MADUR@',
        responsabilidad: '📌 RESPONSABLE',
        creatividad: '🎨 CREATIV@'
    }

    return types[top] || '🧩 PERSONALIDAD ÚNICA'
}

async function sendMessage(sock, jid, content, options = {}) {
    if (typeof sock.safeSendMessage === 'function') {
        return await sock.safeSendMessage(jid, content, options)
    }

    return await sock.sendMessage(jid, content, options)
}

module.exports = {
    name: 'personalidad',
    aliases: ['personality', 'personal'],
    description: 'Genera un perfil de personalidad aleatorio y divertido',
    category: 'diversion',

    async execute({
        sock,
        from,
        msg
    }) {
        try {
            const target = resolveTarget(msg)

            if (!target) {
                return await sendMessage(sock, from, {
                    text: 'No pude identificar al usuario.'
                })
            }

            const scores = {
                carisma: randomPercent(),
                humor: randomPercent(),
                romanticismo: randomPercent(),
                intensidad: randomPercent(),
                celos: randomPercent(),
                toxicidad: randomPercent(),
                paciencia: randomPercent(),
                locura: randomPercent(),
                lealtad: randomPercent(),
                orgullo: randomPercent(),
                racismo: randomPercent(),
                narcisismo: randomPercent(),
                egocentrismo: randomPercent(),
                arrogancia: randomPercent(),
                manipulacion: randomPercent(),
                sarcasmo: randomPercent(),
                chisme: randomPercent(),
                flojera: randomPercent(),
                dramatismo: randomPercent(),
                sinceridad: randomPercent(),
                timidez: randomPercent(),
                coqueteria: randomPercent(),
                impulsividad: randomPercent(),
                madurez: randomPercent(),
                responsabilidad: randomPercent(),
                creatividad: randomPercent()
            }

            const user = target.split('@')[0]
            const type = chooseType(scores)

            const traits = [
                ['✨', 'Carisma', scores.carisma],
                ['😂', 'Humor', scores.humor],
                ['🌹', 'Romanticismo', scores.romanticismo],
                ['🔥', 'Intensidad', scores.intensidad],
                ['👀', 'Celos', scores.celos],
                ['☢️', 'Toxicidad', scores.toxicidad],
                ['🧘', 'Paciencia', scores.paciencia],
                ['🤪', 'Locura', scores.locura],
                ['🤝', 'Lealtad', scores.lealtad],
                ['👑', 'Orgullo', scores.orgullo],
                ['🚫', 'Racismo', scores.racismo],
                ['🪞', 'Narcisismo', scores.narcisismo],
                ['🎯', 'Egocentrismo', scores.egocentrismo],
                ['😏', 'Arrogancia', scores.arrogancia],
                ['🕸️', 'Manipulación', scores.manipulacion],
                ['🙃', 'Sarcasmo', scores.sarcasmo],
                ['🗣️', 'Chisme', scores.chisme],
                ['🛋️', 'Flojera', scores.flojera],
                ['🎭', 'Dramatismo', scores.dramatismo],
                ['💬', 'Sinceridad', scores.sinceridad],
                ['🫣', 'Timidez', scores.timidez],
                ['😉', 'Coquetería', scores.coqueteria],
                ['⚡', 'Impulsividad', scores.impulsividad],
                ['🧠', 'Madurez', scores.madurez],
                ['📌', 'Responsabilidad', scores.responsabilidad],
                ['🎨', 'Creatividad', scores.creatividad]
            ]

            const lines = [
                'ㅤ۟∩　ׅ　🧠　ׅ　*PERSONALIDAD*　ׄᰙ',
                '',
                `𖣣ֶㅤ֯⌗ 👤  ׄ ⬭ *@${user}*`,
                `𖣣ֶㅤ֯⌗ ✨  ׄ ⬭ *Tipo:* ${type}`,
                '',
                ...traits.flatMap(([emoji, label, value]) => [
                    `𖣣ֶㅤ֯⌗ ${emoji}  ׄ ⬭ *${label}:* ${value}%`,
                    `      ${bar(value)}`
                ]),
                '',
                '╰─ 𓂃 Resultado aleatorio de diversión; no es una evaluación real.'
            ]

            await sendMessage(
                sock,
                from,
                {
                    text: lines.join('\n'),
                    mentions: [target]
                }
            )

            logger.event(
                `${getBotName(sock)} | Personalidad | ${user} | ${from}`
            )

            return true
        } catch (err) {
            logger.error(
                `${getBotName(sock)} | Error personalidad: ${err.stack || err.message}`
            )

            try {
                await sendMessage(sock, from, {
                    text: 'No se pudo generar la personalidad.'
                })
            } catch {}

            return false
        }
    }
}
const {
    ensureMember
} = require('../src/database/repositories/memberRepository')

const {
    getMemberCardById
} = require('../src/database/repositories/memberCardRepository')

const logger =
    require('../src/utils/logger')

const ui =
    require('../src/utils/ui')


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


function safeNumber(
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


function safeText(
    value,
    fallback = 'N/A'
) {

    const text =
        String(
            value ?? ''
        )
            .trim()


    return text ||
        fallback

}


function formatDate(
    value
) {

    if (!value) {

        return 'Desconocida'

    }


    try {

        const date =
            new Date(
                value
            )


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return 'Desconocida'

        }


        return date.toLocaleDateString(
            'es-MX',
            {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }
        )


    } catch {

        return 'Desconocida'

    }

}


module.exports = {

    name:
        'cardinfo',

    aliases: [
        'infocard',
        'cartainfo'
    ],

    description:
        'Muestra la información de una carta de tu colección',

    category:
        'perfil',

    cooldown:
        5,


    async execute({

        sock,
        msg,
        from,
        args = []

    }) {

        try {

            /* ─────────────────────────────
               USUARIO
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

                    null

                )


            if (!sender) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE USUARIO',

                                'No pude identificar al usuario.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               ID DE CARTA
            ───────────────────────────── */

            const cardId =
                Number(
                    args[0]
                )


            if (
                !Number.isInteger(
                    cardId
                ) ||
                cardId <= 0
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'ID DE CARTA REQUERIDO',

                                [
                                    'Debes indicar el ID de una carta.',
                                    '',
                                    'Ejemplo:',
                                    '.cardinfo 2',
                                    '',
                                    'Puedes consultar tus IDs con:',
                                    '.collection'
                                ].join('\n')

                            )

                    }

                )

            }


            /* ─────────────────────────────
               PERFIL
            ───────────────────────────── */

            const member =
                await ensureMember(

                    sender,

                    senderAlt,

                    msg.pushName ||
                    null

                )


            if (!member) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE PERFIL',

                                'No pude cargar tu perfil.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               CARTA
            ───────────────────────────── */

            const card =
                await getMemberCardById(

                    member.id,

                    cardId

                )


            if (!card) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'CARTA NO ENCONTRADA',

                                `No encontré la carta #${cardId} en tu colección.`

                            )

                    }

                )

            }


            /* ─────────────────────────────
               INFORMACIÓN
            ───────────────────────────── */

            const obtained =
                formatDate(
                    card.obtained_at
                )


            const equipped =
                Number(
                    card.equipped
                ) === 1


            const cardName =
                safeText(
                    card.card_name,
                    'Carta'
                )


            const family =
                safeText(
                    card.family,
                    'PLAYER'
                )


            const promo =
                safeText(
                    card.promo_code,
                    'BASE'
                )


            const reason =
                safeText(
                    card.obtained_reason,
                    'No especificado'
                )


            const rating =
                safeNumber(
                    card.rating
                )


            const msgStat =
                safeNumber(
                    card.msg_stat
                )


            const actStat =
                safeNumber(
                    card.act_stat
                )


            const cmdStat =
                safeNumber(
                    card.cmd_stat
                )


            const racStat =
                safeNumber(
                    card.rac_stat
                )


            const antStat =
                safeNumber(
                    card.ant_stat
                )


            const intStat =
                safeNumber(
                    card.int_stat
                )


            /* ─────────────────────────────
               TEXTO
            ───────────────────────────── */

            const text = [

                'ㅤ۟∩　ׅ　🃏　ׅ　*CARD INFO*　ׄᰙ',

                '',

                `𖣣ֶㅤ֯⌗ 🃏  ׄ ⬭ *Carta:* ${cardName}`,

                `𖣣ֶㅤ֯⌗ ⭐  ׄ ⬭ *OVR:* ${rating}`,

                '',

                'ㅤ۟∩　ׅ　📋　ׅ　*DATOS*',

                '',

                `𖣣ֶㅤ֯⌗ 🆔  ׄ ⬭ *ID:* ${card.id}`,

                `𖣣ֶㅤ֯⌗ ✦  ׄ ⬭ *Familia:* ${family}`,

                `𖣣ֶㅤ֯⌗ 🎴  ׄ ⬭ *Tipo:* ${promo}`,

                `𖣣ֶㅤ֯⌗ ${equipped ? '⭐' : '📦'}  ׄ ⬭ *Estado:* ${equipped ? 'EQUIPADA' : 'GUARDADA'}`,

                '',

                'ㅤ۟∩　ׅ　📊　ׅ　*STATS*',

                '',

                `𖣣ֶㅤ֯⌗ 💬  ׄ ⬭ *MSG:* ${msgStat}`,

                `𖣣ֶㅤ֯⌗ ⚡  ׄ ⬭ *ACT:* ${actStat}`,

                `𖣣ֶㅤ֯⌗ ⚙️  ׄ ⬭ *CMD:* ${cmdStat}`,

                `𖣣ֶㅤ֯⌗ 🎯  ׄ ⬭ *RAC:* ${racStat}`,

                `𖣣ֶㅤ֯⌗ 🛡️  ׄ ⬭ *ANT:* ${antStat}`,

                `𖣣ֶㅤ֯⌗ 🧠  ׄ ⬭ *INT:* ${intStat}`,

                '',

                'ㅤ۟∩　ׅ　📜　ׅ　*HISTORIAL*',

                '',

                `𖣣ֶㅤ֯⌗ 📅  ׄ ⬭ *Obtenida:* ${obtained}`,

                `𖣣ֶㅤ֯⌗ ✎  ׄ ⬭ *Motivo:* ${reason}`,

                '',

                '╰─ 𓂃 KennyBot V2'

            ]
                .filter(Boolean)
                .join('\n')


            /* ─────────────────────────────
               ENVIAR
            ───────────────────────────── */

            await sock.safeSendMessage(

                from,

                {
                    text
                }

            )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `CardInfo consultada: member=${member.id} | card=${card.id} | ${cardName} | OVR ${rating}`

            )


        } catch (err) {

            logger.error(

                `Error cardinfo: ${err.stack || err.message}`

            )


            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR CARDINFO',

                                'Ocurrió un error al consultar la carta.'

                            )

                    }

                )

            } catch {}

        }

    }

}
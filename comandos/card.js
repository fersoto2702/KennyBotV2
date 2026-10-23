const {
    ensureMember
} = require('../src/database/repositories/memberRepository')

const {
    ensureInitialGoldCard,
    getEquippedMemberCard
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


module.exports = {

    name:
        'card',

    aliases: [
        'carta',
        'mycard'
    ],

    description:
        'Muestra tu carta activa de KennyBot',

    category:
        'perfil',
async execute({

        sock,
        msg,
        from

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
               CARTA INICIAL
            ───────────────────────────── */

            await ensureInitialGoldCard(
                member.id
            )


            /* ─────────────────────────────
               CARTA EQUIPADA
            ───────────────────────────── */

            const card =
                await getEquippedMemberCard(
                    member.id
                )


            if (!card) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'SIN CARTA EQUIPADA',

                                'No tienes ninguna carta equipada.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               INFORMACIÓN CARTA
            ───────────────────────────── */

            const familyNames = {

                PLAYER:
                    'PLAYER',

                HERO:
                    'HERO',

                ICON:
                    'ICON'

            }


            const playerName =
                safeText(

                    member.display_name ||

                    msg.pushName,

                    'Usuario'

                )


            const cardName =
                safeText(

                    card.card_name ||

                    card.promo_code,

                    'Carta'

                )


            const family =
                safeText(

                    familyNames[
                        card.family
                    ] ||

                    card.family,

                    'PLAYER'

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

                'ㅤ۟∩　ׅ　🃏　ׅ　*KENNYBOT CARD*　ׄᰙ',

                '',

                `𖣣ֶㅤ֯⌗ 👤  ׄ ⬭ *Jugador:* ${playerName}`,

                `𖣣ֶㅤ֯⌗ ⭐  ׄ ⬭ *OVR:* ${rating}`,

                `𖣣ֶㅤ֯⌗ 🃏  ׄ ⬭ *Carta:* ${cardName}`,

                `𖣣ֶㅤ֯⌗ ✦  ׄ ⬭ *Familia:* ${family}`,

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

                '╰─ 𓂃 Carta equipada',

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

                `Card consultada: member=${member.id} | ${playerName} | ${cardName} | OVR ${rating}`

            )


        } catch (err) {

            logger.error(

                `Error card: ${err.stack || err.message}`

            )


            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE CARTA',

                                'Ocurrió un error al cargar tu carta.'

                            )

                    }

                )

            } catch {}

        }

    }

}
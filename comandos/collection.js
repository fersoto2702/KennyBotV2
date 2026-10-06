const {
    ensureMember
} = require('../src/database/repositories/memberRepository')

const {
    ensureInitialGoldCard,
    getMemberCards
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


function getDateValue(
    value
) {

    if (!value) {

        return 0

    }


    const time =
        new Date(
            value
        )
            .getTime()


    return Number.isFinite(time)
        ? time
        : 0

}


module.exports = {

    name:
        'collection',

    aliases: [
        'coleccion',
        'cards',
        'cartas'
    ],

    description:
        'Muestra tu colección de cartas de KennyBot',

    category:
        'perfil',

    cooldown:
        5,


    async execute({

        sock,
        msg,
        from

    }) {

        try {

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
               COLECCIÓN
            ───────────────────────────── */

            const result =
                await getMemberCards(
                    member.id
                )


            const cards =
                Array.isArray(
                    result
                )
                    ? result
                    : []


            if (
                cards.length === 0
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'SIN CARTAS',

                                'Todavía no tienes cartas en tu colección.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               ORDENAR CARTAS
            ───────────────────────────── */

            const orderedCards =
                [...cards]
                    .sort(

                        (a, b) => {

                            const equippedDifference =

                                Number(
                                    b?.equipped
                                )

                                -

                                Number(
                                    a?.equipped
                                )


                            if (
                                equippedDifference !== 0
                            ) {

                                return equippedDifference

                            }


                            return (

                                getDateValue(
                                    b?.obtained_at
                                )

                                -

                                getDateValue(
                                    a?.obtained_at
                                )

                            )

                        }

                    )


            /* ─────────────────────────────
               NOMBRE DEL MIEMBRO
            ───────────────────────────── */

            const memberName =
                safeText(

                    member.display_name ||

                    msg.pushName,

                    'Usuario'

                )


            /* ─────────────────────────────
               FILAS DE CARTAS
            ───────────────────────────── */

            const rows =
                orderedCards
                    .map(

                        (
                            card,
                            index
                        ) => {

                            const equipped =
                                Number(
                                    card?.equipped
                                ) === 1


                            const cardName =
                                safeText(
                                    card?.card_name,
                                    'Carta'
                                )


                            const rating =
                                safeNumber(
                                    card?.rating
                                )


                            const family =
                                safeText(
                                    card?.family,
                                    'PLAYER'
                                )


                            const promo =
                                safeText(
                                    card?.promo_code,
                                    'BASE'
                                )


                            const id =
                                safeText(
                                    card?.id,
                                    '?'
                                )


                            return [

                                `𖣣ֶㅤ֯⌗ ${equipped ? '⭐' : '🃏'}  ׄ ⬭ *#${index + 1} ${cardName}*`,

                                `╰─ 𓂃 OVR ${rating} · ${family} · ${promo}`,

                                `╰─ 𓂃 ID: ${id}${equipped ? ' · EQUIPADA' : ''}`

                            ]
                                .join('\n')

                        }

                    )
                    .join('\n\n')


            /* ─────────────────────────────
               TEXTO FINAL
            ───────────────────────────── */

            const text = [

                'ㅤ۟∩　ׅ　🃏　ׅ　*CARD COLLECTION*　ׄᰙ',

                '',

                `𖣣ֶㅤ֯⌗ 👤  ׄ ⬭ *Miembro:* ${memberName}`,

                `𖣣ֶㅤ֯⌗ 🎴  ׄ ⬭ *Cartas:* ${orderedCards.length}`,

                '',

                'ㅤ۟∩　ׅ　📚　ׅ　*COLECCIÓN*',

                '',

                rows,

                '',

                '╰─ 𓂃 ⭐ = Carta equipada',

                '╰─ 𓂃 Usa .cardinfo ID para ver una carta',

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

                `Collection consultada: member=${member.id} | ${memberName} | cards=${orderedCards.length}`

            )


        } catch (err) {

            logger.error(

                `Error collection: ${err.stack || err.message}`

            )


            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE COLECCIÓN',

                                'Ocurrió un error al cargar tu colección.'

                            )

                    }

                )

            } catch {}

        }

    }

}
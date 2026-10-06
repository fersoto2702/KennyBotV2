const {
    ensureMember
} = require('../src/database/repositories/memberRepository')

const {
    equipMemberCard
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


module.exports = {

    name:
        'equip',

    aliases: [
        'equipar',
        'usecard'
    ],

    description:
        'Equipa una carta de tu colección',

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
                                    'Debes indicar el ID de la carta.',
                                    '',
                                    'Ejemplo:',
                                    '.equip 2',
                                    '',
                                    'Consulta tus cartas con:',
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
               EQUIPAR CARTA
            ───────────────────────────── */

            const result =
                await equipMemberCard(

                    member.id,

                    cardId

                )


            if (
                !result ||
                typeof result !== 'object'
            ) {

                throw new Error(
                    'equipMemberCard devolvió una respuesta inválida'
                )

            }


            /* ─────────────────────────────
               ERROR AL EQUIPAR
            ───────────────────────────── */

            if (
                !result.success
            ) {

                if (
                    result.reason ===
                    'CARD_NOT_FOUND'
                ) {

                    return await sock.safeSendMessage(

                        from,

                        {

                            text:
                                ui.warn(

                                    'CARTA NO ENCONTRADA',

                                    `La carta #${cardId} no existe en tu colección.`

                                )

                        }

                    )

                }


                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'NO SE PUDO EQUIPAR',

                                `No pude equipar esa carta.\n\nCódigo: ${safeText(
                                    result.reason,
                                    'UNKNOWN'
                                )}`

                            )

                    }

                )

            }


            /* ─────────────────────────────
               DATOS DE CARTA
            ───────────────────────────── */

            const card =
                result.card ||
                {}


            const cardName =
                safeText(
                    card.card_name,
                    'Carta'
                )


            const rating =
                safeNumber(
                    card.rating
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


            const id =
                safeText(
                    card.id,
                    cardId
                )


            /* ─────────────────────────────
               YA EQUIPADA
            ───────────────────────────── */

            if (
                !result.changed
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.info(

                                'CARTA YA EQUIPADA',

                                [

                                    [
                                        'Carta',
                                        cardName
                                    ],

                                    [
                                        'OVR',
                                        rating
                                    ],

                                    [
                                        'ID',
                                        id
                                    ]

                                ],

                                'Esta carta ya está equipada actualmente.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            const text = [

                'ㅤ۟∩　ׅ　⭐　ׅ　*CARD EQUIPPED*　ׄᰙ',

                '',

                `𖣣ֶㅤ֯⌗ 🃏  ׄ ⬭ *Carta:* ${cardName}`,

                `𖣣ֶㅤ֯⌗ ⭐  ׄ ⬭ *OVR:* ${rating}`,

                `𖣣ֶㅤ֯⌗ ✦  ׄ ⬭ *Familia:* ${family}`,

                `𖣣ֶㅤ֯⌗ 🎴  ׄ ⬭ *Tipo:* ${promo}`,

                `𖣣ֶㅤ֯⌗ 🆔  ׄ ⬭ *ID:* ${id}`,

                '',

                '╰─ 𓂃 Tu carta activa ha sido actualizada',

                '╰─ 𓂃 Usa .card para verla'

            ]
                .filter(Boolean)
                .join('\n')


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

                `Card equipada: member=${member.id} | card=${id} | ${cardName} | OVR ${rating}`

            )


        } catch (err) {

            logger.error(

                `Error equip: ${err.stack || err.message}`

            )


            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR EQUIP',

                                'Ocurrió un error al equipar la carta.'

                            )

                    }

                )

            } catch {}

        }

    }

}
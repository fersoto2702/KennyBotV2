const {
    ensureMember
} = require('../src/database/repositories/memberRepository')

const {
    getUserClub
} = require('../src/database/repositories/userClubRepository')

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


function getSender(
    msg
) {

    return normalizeJid(

        msg.key?.participant ||

        msg.participant ||

        msg.key?.remoteJid

    )

}


function getAltJid(
    msg
) {

    const sender =
        getSender(
            msg
        )


    const candidates = [

        msg.key?.participantAlt,

        msg.participantAlt

    ]


    for (
        const value of candidates
    ) {

        const normalized =
            normalizeJid(
                value
            )


        if (
            normalized &&
            normalized !== sender
        ) {

            return normalized

        }

    }


    return null

}


function getDisplayName(
    msg
) {

    const name =
        String(

            msg.pushName ||

            msg.verifiedBizName ||

            ''

        )
            .trim()


    return name ||
        null

}


function safeText(
    value,
    fallback = 'Desconocido'
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


function getPlayerName(
    card
) {

    return safeText(

        card?.known_as ||

        card?.player_name,

        'Jugador'

    )

}


function formatClub(
    member,
    club,
    prefix
) {

    const cards =
        Array.isArray(
            club?.cards
        )
            ? club.cards
            : []


    const total =
        safeNumber(
            club?.total,
            cards.length
        )


    const page =
        Math.max(

            1,

            safeNumber(
                club?.page,
                1
            )

        )


    const totalPages =
        Math.max(

            1,

            safeNumber(
                club?.totalPages,
                1
            )

        )


    const memberName =
        safeText(
            member?.display_name,
            'Miembro'
        )


    const lines = [

        'ㅤ۟∩　ׅ　⚽　ׅ　*MI CLUB*　ׄᰙ',

        '',

        `𖣣ֶㅤ֯⌗ 👤  ׄ ⬭ *Miembro:* ${memberName}`,

        `𖣣ֶㅤ֯⌗ 🎴  ׄ ⬭ *Cartas:* ${total}`,

        ''

    ]


    /* ─────────────────────────────
       CLUB VACÍO
    ───────────────────────────── */

    if (
        total === 0
    ) {

        lines.push(

            '╰─ 𓂃 Todavía no tienes cartas en tu club.',

            '',

            '𖣣ֶㅤ֯⌗ 📦  ׄ ⬭ Consigue Player Picks y añade jugadores a tu club.',

            '',

            '╰─ 𓂃 KennyBot V2'

        )


        return lines
            .filter(Boolean)
            .join('\n')

    }


    /* ─────────────────────────────
       PÁGINA INVÁLIDA
    ───────────────────────────── */

    if (
        cards.length === 0
    ) {

        lines.push(

            `𖣣ֶㅤ֯⌗ ❌  ׄ ⬭ *Página:* ${page}`,

            `𖣣ֶㅤ֯⌗ 📄  ׄ ⬭ *Disponibles:* ${totalPages}`,

            '',

            `╰─ 𓂃 Usa ${prefix}myclub 1`

        )


        return lines
            .filter(Boolean)
            .join('\n')

    }


    /* ─────────────────────────────
       CARTAS
    ───────────────────────────── */

    for (
        let index = 0;
        index < cards.length;
        index++
    ) {

        const card =
            cards[index]


        if (
            !card ||
            typeof card !== 'object'
        ) {

            continue

        }


        const rating =
            safeNumber(
                card.rating
            )


        const position =
            safeText(
                card.position,
                'N/A'
            )


        const playerName =
            getPlayerName(
                card
            )


        const promoName =
            safeText(
                card.promo_name,
                'BASE'
            )


        const gameCode =
            safeText(
                card.game_code,
                'N/A'
            )


        const clubName =
            safeText(
                card.club,
                ''
            )


        const clubEntryId =
            safeText(
                card.club_entry_id,
                '?'
            )


        lines.push(

            `𖣣ֶㅤ֯⌗ ⭐  ׄ ⬭ *${rating} ${position} — ${playerName}*`,

            `╰─ 𓂃 🎨 ${promoName}`,

            `╰─ 𓂃 🎮 ${gameCode}`

        )


        if (
            clubName
        ) {

            lines.push(

                `╰─ 𓂃 🏟️ ${clubName}`

            )

        }


        lines.push(

            `╰─ 𓂃 🆔 Club #${clubEntryId}`

        )


        if (
            index <
            cards.length - 1
        ) {

            lines.push(
                '',
                '━━━━━━━━━━━━━━━━━━━━━━━━━━',
                ''
            )

        }

    }


    /* ─────────────────────────────
       PAGINACIÓN
    ───────────────────────────── */

    lines.push(

        '',

        `𖣣ֶㅤ֯⌗ 📄  ׄ ⬭ *Página:* ${page}/${totalPages}`

    )


    if (
        page < totalPages
    ) {

        lines.push(

            `╰─ 𓂃 ▶️ ${prefix}myclub ${page + 1}`

        )

    }


    if (
        page > 1
    ) {

        lines.push(

            `╰─ 𓂃 ◀️ ${prefix}myclub ${page - 1}`

        )

    }


    lines.push(

        '',

        '╰─ 𓂃 KennyBot V2'

    )


    return lines
        .filter(Boolean)
        .join('\n')

}


module.exports = {

    name:
        'myclub',

    aliases: [
        'club',
        'miclub',
        'utclub'
    ],

    description:
        'Muestra tus cartas de Ultimate Team.',

    category:
        'ultimate-team',

    cooldown:
        5,


    async execute({

        sock,
        msg,
        from,
        args = [],
        prefix = '.'

    }) {

        try {

            /* ─────────────────────────────
               PÁGINA
            ───────────────────────────── */

            const page =
                args[0] === undefined

                    ? 1

                    : Number(
                        args[0]
                    )


            if (
                !Number.isInteger(
                    page
                ) ||
                page <= 0
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'PÁGINA INVÁLIDA',

                                [
                                    `Uso: ${prefix}myclub [página]`,
                                    '',
                                    `Ejemplo: ${prefix}myclub 2`
                                ].join('\n')

                            )

                    },

                    {
                        quoted:
                            msg
                    }

                )

            }


            /* ─────────────────────────────
               IDENTIDAD
            ───────────────────────────── */

            const sender =
                getSender(
                    msg
                )


            const altJid =
                getAltJid(
                    msg
                )


            const displayName =
                getDisplayName(
                    msg
                )


            if (!sender) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE USUARIO',

                                'No pude identificar tu cuenta.'

                            )

                    },

                    {
                        quoted:
                            msg
                    }

                )

            }


            /* ─────────────────────────────
               PERFIL
            ───────────────────────────── */

            const member =
                await ensureMember(

                    sender,

                    altJid,

                    displayName

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

                    },

                    {
                        quoted:
                            msg
                    }

                )

            }


            /* ─────────────────────────────
               CLUB
            ───────────────────────────── */

            const result =
                await getUserClub(

                    member.id,

                    page,

                    10

                )


            if (
                !result ||
                typeof result !== 'object'
            ) {

                throw new Error(
                    'getUserClub devolvió una respuesta inválida'
                )

            }


            /* ─────────────────────────────
               ENVIAR
            ───────────────────────────── */

            await sock.safeSendMessage(

                from,

                {

                    text:
                        formatClub(

                            member,

                            result,

                            prefix

                        )

                },

                {
                    quoted:
                        msg
                }

            )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `MyClub consultado: member=${member.id} | page=${page} | total=${safeNumber(result.total)}`

            )


        } catch (error) {

            logger.error(

                `Error myclub: ${error.stack || error.message}`

            )


            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE CLUB',

                                'No se pudo cargar tu club.'

                            )

                    },

                    {
                        quoted:
                            msg
                    }

                )

            } catch {}

        }

    }

}
const {
    ensureMember
} = require('../src/database/repositories/memberRepository')

const {
    claimPick
} = require('../src/services/packPickService')

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
    pick
) {

    return safeText(

        pick?.known_as ||

        pick?.player_name,

        'Jugador'

    )

}


function formatSuccess(
    result
) {

    const pick =
        result?.pick ||
        {}


    const playerName =
        getPlayerName(
            pick
        )


    const rating =
        safeNumber(
            pick.rating
        )


    const position =
        safeText(
            pick.position,
            'N/A'
        )


    const promoName =
        safeText(
            pick.promo_name,
            'BASE'
        )


    const gameCode =
        safeText(
            pick.game_code,
            'N/A'
        )


    const club =
        safeText(
            pick.club,
            ''
        )


    const clubEntryId =
        safeText(
            result?.clubEntryId,
            '?'
        )


    const remaining =
        Math.max(

            0,

            safeNumber(
                result?.remaining,
                0
            )

        )


    const lines = [

        'ㅤ۟∩　ׅ　✅　ׅ　*PLAYER PICK*　ׄᰙ',

        '',

        '𖣣ֶㅤ֯⌗ 🎉  ׄ ⬭ *¡Carta seleccionada!*',

        '',

        `𖣣ֶㅤ֯⌗ ⭐  ׄ ⬭ *${rating} ${position} — ${playerName}*`,

        `𖣣ֶㅤ֯⌗ 🎨  ׄ ⬭ *Promo:* ${promoName}`,

        `𖣣ֶㅤ֯⌗ 🎮  ׄ ⬭ *Juego:* ${gameCode}`

    ]


    if (
        club
    ) {

        lines.push(

            `𖣣ֶㅤ֯⌗ 🏟️  ׄ ⬭ *Club:* ${club}`

        )

    }


    lines.push(

        '',

        '𖣣ֶㅤ֯⌗ 📥  ׄ ⬭ *Estado:* Añadida a tu club',

        `𖣣ֶㅤ֯⌗ 🆔  ׄ ⬭ *Club ID:* #${clubEntryId}`

    )


    if (
        result?.status ===
        'PENDING_SELECTION'
    ) {

        lines.push(

            '',

            `𖣣ֶㅤ֯⌗ 🎴  ׄ ⬭ *Selecciones restantes:* ${remaining}`

        )

    } else {

        lines.push(

            '',

            '𖣣ֶㅤ֯⌗ 🔒  ׄ ⬭ *Player Pick:* COMPLETADO'

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
        'pick',

    aliases: [
        'elegir',
        'selectpick',
        'claimpick'
    ],

    description:
        'Selecciona una carta de un Player Pick abierto.',

    category:
        'ultimate-team',
async execute({

        sock,
        msg,
        from,
        args = [],
        prefix = '.'

    }) {

        try {

            /* ─────────────────────────────
               PARÁMETROS
            ───────────────────────────── */

            const packId =
                Number(
                    args[0]
                )


            const position =
                Number(
                    args[1]
                )


            if (
                !Number.isInteger(
                    packId
                ) ||
                packId <= 0 ||
                !Number.isInteger(
                    position
                ) ||
                position <= 0
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'DATOS DEL PICK REQUERIDOS',

                                [
                                    `Uso: ${prefix}pick <pack> <opción>`,
                                    '',
                                    `Ejemplo: ${prefix}pick 2 1`
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
               RECLAMAR PICK
            ───────────────────────────── */

            const result =
                await claimPick(

                    member.id,

                    packId,

                    position

                )


            if (
                !result ||
                typeof result !== 'object'
            ) {

                throw new Error(
                    'claimPick devolvió una respuesta inválida'
                )

            }


            /* ─────────────────────────────
               ESTADOS NO DISPONIBLES
            ───────────────────────────── */

            if (
                result.status ===
                'EXPIRED'
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'PLAYER PICK EXPIRADO',

                                'Este Player Pick ha expirado.'

                            )

                    },

                    {
                        quoted:
                            msg
                    }

                )

            }


            if (
                result.status ===
                'CANCELLED'
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'PLAYER PICK CANCELADO',

                                'Este Player Pick fue cancelado.'

                            )

                    },

                    {
                        quoted:
                            msg
                    }

                )

            }


            if (
                result.status ===
                'CLAIMED' &&
                !result.pick
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.info(

                                'PLAYER PICK RECLAMADO',

                                [],

                                'Este Player Pick ya fue completado.'

                            )

                    },

                    {
                        quoted:
                            msg
                    }

                )

            }


            if (
                !result.pick ||
                typeof result.pick !== 'object'
            ) {

                throw new Error(
                    'claimPick no devolvió la carta seleccionada'
                )

            }


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            await sock.safeSendMessage(

                from,

                {

                    text:
                        formatSuccess(
                            result
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

                `Pick reclamado: member=${member.id} | pack=${packId} | option=${position} | player=${getPlayerName(result.pick)} | status=${safeText(result.status, 'UNKNOWN')}`

            )


        } catch (error) {

            logger.error(

                `Error pick: ${error.stack || error.message}`

            )


            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE PLAYER PICK',

                                'No se pudo seleccionar la carta.'

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
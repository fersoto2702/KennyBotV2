const {
    ensureMember
} = require('../src/database/repositories/memberRepository')

const {
    openPack
} = require('../src/services/packOpeningService')

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


function formatStatValue(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return null

    }


    const number =
        Number(
            value
        )


    return Number.isFinite(number)
        ? number
        : null

}


function formatOutfieldStats(
    pick
) {

    const stats = [

        [
            'PAC',
            formatStatValue(
                pick?.pac
            )
        ],

        [
            'SHO',
            formatStatValue(
                pick?.sho
            )
        ],

        [
            'PAS',
            formatStatValue(
                pick?.pas
            )
        ],

        [
            'DRI',
            formatStatValue(
                pick?.dri
            )
        ],

        [
            'DEF',
            formatStatValue(
                pick?.def
            )
        ],

        [
            'PHY',
            formatStatValue(
                pick?.phy
            )
        ]

    ]


    return stats

        .filter(

            ([, value]) =>
                value !== null

        )

        .map(

            ([name, value]) =>
                `${name} ${value}`

        )

        .join(
            ' · '
        )

}


function formatGoalkeeperStats(
    pick
) {

    const stats = [

        [
            'DIV',
            formatStatValue(
                pick?.div_stat
            )
        ],

        [
            'HAN',
            formatStatValue(
                pick?.han
            )
        ],

        [
            'KIC',
            formatStatValue(
                pick?.kic
            )
        ],

        [
            'REF',
            formatStatValue(
                pick?.ref_stat
            )
        ],

        [
            'SPD',
            formatStatValue(
                pick?.spd
            )
        ],

        [
            'POS',
            formatStatValue(
                pick?.pos_stat
            )
        ]

    ]


    return stats

        .filter(

            ([, value]) =>
                value !== null

        )

        .map(

            ([name, value]) =>
                `${name} ${value}`

        )

        .join(
            ' · '
        )

}


function formatStats(
    pick
) {

    const position =
        String(
            pick?.position || ''
        )
            .trim()
            .toUpperCase()


    if (
        position === 'GK' ||
        position === 'POR'
    ) {

        return formatGoalkeeperStats(
            pick
        )

    }


    return formatOutfieldStats(
        pick
    )

}


function formatPicks(
    result,
    prefix
) {

    const pack =
        result?.pack ||
        {}


    const picks =
        Array.isArray(
            result?.picks
        )
            ? result.picks
            : []


    const packName =
        safeText(
            pack.pack_name,
            'Player Pick'
        )


    const poolName =
        safeText(
            pack.pool_name,
            'Desconocido'
        )


    const packId =
        safeText(
            pack.id,
            '?'
        )


    const lines = [

        'ㅤ۟∩　ׅ　🎴　ׅ　*PLAYER PICK*　ׄᰙ',

        '',

        `𖣣ֶㅤ֯⌗ 🎁  ׄ ⬭ *Pack:* ${packName}`,

        `𖣣ֶㅤ֯⌗ 🗂️  ׄ ⬭ *Pool:* ${poolName}`,

        `𖣣ֶㅤ֯⌗ 🆔  ׄ ⬭ *Pack:* #${packId}`,

        ''

    ]


    if (
        result?.reused
    ) {

        lines.push(

            '𖣣ֶㅤ֯⌗ 🔄  ׄ ⬭ *Estado:* Selección pendiente recuperada',

            ''

        )

    }


    if (
        picks.length === 0
    ) {

        lines.push(

            '╰─ 𓂃 No se encontraron opciones en este Player Pick.'

        )


        return lines
            .filter(Boolean)
            .join('\n')

    }


    for (
        let index = 0;
        index < picks.length;
        index++
    ) {

        const pick =
            picks[index]


        if (
            !pick ||
            typeof pick !== 'object'
        ) {

            continue

        }


        const name =
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


        const pickPosition =
            safeNumber(
                pick.pick_position,
                index + 1
            )


        const club =
            safeText(
                pick.club,
                ''
            )


        const stats =
            formatStats(
                pick
            )


        lines.push(

            `ㅤ۟∩　ׅ　⭐　ׅ　*OPCIÓN ${pickPosition}*`,

            '',

            `𖣣ֶㅤ֯⌗ ⭐  ׄ ⬭ *${rating} ${position} — ${name}*`,

            `𖣣ֶㅤ֯⌗ 🎨  ׄ ⬭ *Promo:* ${promoName}`,

            `𖣣ֶㅤ֯⌗ 🎮  ׄ ⬭ *Juego:* ${gameCode}`

        )


        if (
            club
        ) {

            lines.push(

                `𖣣ֶㅤ֯⌗ 🏟️  ׄ ⬭ *Club:* ${club}`

            )

        }


        if (
            stats
        ) {

            lines.push(

                `𖣣ֶㅤ֯⌗ 📊  ׄ ⬭ *Stats:* ${stats}`

            )

        }


        if (
            index <
            picks.length - 1
        ) {

            lines.push(
                '',
                '━━━━━━━━━━━━━━━━━━━━━━━━━━',
                ''
            )

        }

    }


    lines.push(

        '',

        `╰─ 𓂃 Elegir: ${prefix}pick ${packId} <opción>`,

        '╰─ 𓂃 KennyBot V2'

    )


    return lines
        .filter(Boolean)
        .join('\n')

}


function formatClosedPack(
    result
) {

    const pack =
        result?.pack ||
        {}


    const states = {

        CLAIMED:
            'Este Player Pick ya fue reclamado.',

        EXPIRED:
            'Este Player Pick ha expirado.',

        CANCELLED:
            'Este Player Pick fue cancelado.'

    }


    const packName =
        safeText(
            pack.pack_name,
            'Player Pick'
        )


    const packId =
        safeText(
            pack.id,
            '?'
        )


    const status =
        safeText(
            result?.status,
            'UNKNOWN'
        )


    const message =
        states[status] ||
        `Estado: ${status}`


    return [

        'ㅤ۟∩　ׅ　🎁　ׅ　*PLAYER PICK*　ׄᰙ',

        '',

        `𖣣ֶㅤ֯⌗ 🎁  ׄ ⬭ *Pack:* ${packName}`,

        `𖣣ֶㅤ֯⌗ 🆔  ׄ ⬭ *Pack:* #${packId}`,

        `𖣣ֶㅤ֯⌗ ⚠️  ׄ ⬭ *Estado:* ${message}`,

        '',

        '╰─ 𓂃 KennyBot V2'

    ]
        .filter(Boolean)
        .join('\n')

}


module.exports = {

    name:
        'openpack',

    aliases: [
        'abrirpack',
        'openpick',
        'abrirpick'
    ],

    description:
        'Abre un Player Pick de Ultimate Team.',

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
               ID DEL PACK
            ───────────────────────────── */

            const packId =
                Number(
                    args[0]
                )


            if (
                !Number.isInteger(
                    packId
                ) ||
                packId <= 0
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'ID DE PACK REQUERIDO',

                                [
                                    `Uso: ${prefix}openpack <id>`,
                                    '',
                                    `Ejemplo: ${prefix}openpack 2`
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
               ABRIR PACK
            ───────────────────────────── */

            const result =
                await openPack(

                    member.id,

                    packId

                )


            if (
                !result ||
                typeof result !== 'object'
            ) {

                throw new Error(
                    'openPack devolvió una respuesta inválida'
                )

            }


            /* ─────────────────────────────
               FORMATEAR
            ───────────────────────────── */

            let text


            if (
                result.status ===
                'PENDING_SELECTION'
            ) {

                text =
                    formatPicks(

                        result,

                        prefix

                    )

            } else {

                text =
                    formatClosedPack(
                        result
                    )

            }


            /* ─────────────────────────────
               ENVIAR
            ───────────────────────────── */

            await sock.safeSendMessage(

                from,

                {
                    text
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

                `OpenPack: member=${member.id} | pack=${packId} | status=${safeText(result.status, 'UNKNOWN')} | picks=${Array.isArray(result.picks) ? result.picks.length : 0}`

            )


        } catch (error) {

            logger.error(

                `Error openpack: ${error.stack || error.message}`

            )


            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE PLAYER PICK',

                                'No se pudo abrir el Player Pick.'

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
const {
    ensureMember,
    getMemberByJid
} = require(
    '../src/database/repositories/memberRepository'
)

const {
    getUserPacks,
    getUserPackCounts
} = require(
    '../src/database/repositories/userPackRepository'
)

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


function getIdentity(
    msg
) {

    const userJid =
        normalizeJid(

            msg.key?.participant ||

            msg.participant ||

            msg.key?.remoteJid

        )


    const altJid =
        normalizeJid(

            msg.key?.participantAlt ||

            msg.participantAlt ||

            null

        )


    const displayName =
        String(
            msg.pushName || ''
        )
            .trim() ||
        null


    return {

        userJid,

        altJid,

        displayName

    }

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


function getPackStatus(
    status
) {

    const statuses = {

        UNOPENED:
            '🔒 Sin abrir',

        PENDING_SELECTION:
            '🎴 Selección pendiente',

        CLAIMED:
            '✅ Reclamado',

        EXPIRED:
            '⌛ Expirado',

        CANCELLED:
            '🚫 Cancelado'

    }


    return (

        statuses[status] ||

        safeText(
            status,
            'Desconocido'
        )

    )

}


function formatDate(
    value
) {

    if (!value) {

        return 'Sin fecha'

    }


    const date =
        new Date(
            value
        )


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return 'Sin fecha'

    }


    try {

        return date.toLocaleString(

            'es-MX',

            {

                dateStyle:
                    'medium',

                timeStyle:
                    'short'

            }

        )


    } catch {

        return date.toLocaleString(
            'es-MX'
        )

    }

}


module.exports = {

    name:
        'packs',

    aliases: [
        'sobres',
        'picks',
        'playerpicks'
    ],

    description:
        'Muestra tus Player Picks disponibles',

    category:
        'ultimate-team',
async execute({

        sock,
        msg,
        from,
        prefix = '.'

    }) {

        try {

            /* ─────────────────────────────
               IDENTIDAD
            ───────────────────────────── */

            const {

                userJid,

                altJid,

                displayName

            } =
                getIdentity(
                    msg
                )


            if (!userJid) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE CUENTA',

                                'No pude identificar tu cuenta.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               PERFIL
            ───────────────────────────── */

            await ensureMember(

                userJid,

                altJid,

                displayName

            )


            const member =
                await getMemberByJid(
                    userJid
                )

                ||

                (
                    altJid

                        ? await getMemberByJid(
                            altJid
                        )

                        : null
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
               OBTENER PACKS
            ───────────────────────────── */

            const [
                packsResult,
                countsResult
            ] =
                await Promise.all([

                    getUserPacks(
                        member.id
                    ),

                    getUserPackCounts(
                        member.id
                    )

                ])


            const packs =
                Array.isArray(
                    packsResult
                )
                    ? packsResult
                    : []


            const counts =
                countsResult &&
                typeof countsResult === 'object'

                    ? countsResult

                    : {}


            const unopened =
                safeNumber(
                    counts.unopened
                )


            const pendingSelection =
                safeNumber(
                    counts.pendingSelection
                )


            const claimed =
                safeNumber(
                    counts.claimed
                )


            const expired =
                safeNumber(
                    counts.expired
                )


            const cancelled =
                safeNumber(
                    counts.cancelled
                )


            /* ─────────────────────────────
               SIN PACKS
            ───────────────────────────── */

            if (
                packs.length === 0
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.info(

                                'PLAYER PICKS',

                                [

                                    [
                                        'Jugador',
                                        safeText(
                                            member.display_name ||
                                            displayName,
                                            'Jugador'
                                        )
                                    ],

                                    [
                                        'Reclamados',
                                        claimed
                                    ]

                                ],

                                'No tienes Player Picks disponibles.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               ENCABEZADO
            ───────────────────────────── */

            const playerName =
                safeText(

                    member.display_name ||

                    displayName,

                    'Jugador'

                )


            const lines = [

                'ㅤ۟∩　ׅ　🎁　ׅ　*PLAYER PICKS*　ׄᰙ',

                '',

                `𖣣ֶㅤ֯⌗ 👤  ׄ ⬭ *Jugador:* ${playerName}`,

                `𖣣ֶㅤ֯⌗ 📦  ׄ ⬭ *Sin abrir:* ${unopened}`,

                `𖣣ֶㅤ֯⌗ 🎴  ׄ ⬭ *Selección pendiente:* ${pendingSelection}`,

                `𖣣ֶㅤ֯⌗ ✅  ׄ ⬭ *Reclamados:* ${claimed}`,

                `𖣣ֶㅤ֯⌗ ⌛  ׄ ⬭ *Expirados:* ${expired}`,

                `𖣣ֶㅤ֯⌗ 🚫  ׄ ⬭ *Cancelados:* ${cancelled}`,

                ''

            ]


            /* ─────────────────────────────
               LISTA DE PACKS
            ───────────────────────────── */

            for (
                let i = 0;
                i < packs.length;
                i++
            ) {

                const pack =
                    packs[i]


                if (
                    !pack ||
                    typeof pack !== 'object'
                ) {

                    continue

                }


                const packId =
                    safeText(
                        pack.id,
                        '?'
                    )


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


                const status =
                    safeText(
                        pack.status,
                        'UNKNOWN'
                    )


                lines.push(

                    `ㅤ۟∩　ׅ　🎁　ׅ　*#${packId} — ${packName}*`,

                    '',

                    `𖣣ֶㅤ֯⌗ 📌  ׄ ⬭ *Estado:* ${getPackStatus(
                        status
                    )}`,

                    `𖣣ֶㅤ֯⌗ 🗂️  ׄ ⬭ *Pool:* ${poolName}`,

                    `𖣣ֶㅤ֯⌗ 📅  ׄ ⬭ *Obtenido:* ${formatDate(
                        pack.obtained_at
                    )}`

                )


                if (
                    pack.obtained_reason
                ) {

                    lines.push(

                        `𖣣ֶㅤ֯⌗ 🎯  ׄ ⬭ *Motivo:* ${safeText(
                            pack.obtained_reason
                        )}`

                    )

                }


                if (
                    status ===
                    'UNOPENED'
                ) {

                    lines.push(

                        `╰─ 𓂃 ▶️ Abrir: ${prefix}openpack ${packId}`

                    )

                }


                if (
                    status ===
                    'PENDING_SELECTION'
                ) {

                    lines.push(

                        `╰─ 𓂃 🎴 Continuar: ${prefix}pick ${packId} <opción>`

                    )

                }


                if (
                    i <
                    packs.length - 1
                ) {

                    lines.push(
                        '',
                        '━━━━━━━━━━━━━━━━━━━━━━━━━━',
                        ''
                    )

                }

            }


            /* ─────────────────────────────
               FOOTER
            ───────────────────────────── */

            lines.push(

                '',

                '╰─ 𓂃 KennyBot V2'

            )


            /* ─────────────────────────────
               ENVIAR
            ───────────────────────────── */

            await sock.safeSendMessage(

                from,

                {

                    text:
                        lines
                            .filter(Boolean)
                            .join('\n')

                }

            )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Packs consultados: member=${member.id} | total=${packs.length} | unopened=${unopened} | pending=${pendingSelection}`

            )


        } catch (err) {

            logger.error(

                `Error packs: ${err.stack || err.message}`

            )


            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE PLAYER PICKS',

                                'No se pudieron cargar tus Player Picks.'

                            )

                    }

                )

            } catch {}

        }

    }

}
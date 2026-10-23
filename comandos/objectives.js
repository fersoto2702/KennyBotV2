const {
    ensureMember,
    getMemberByJid
} = require(
    '../src/database/repositories/memberRepository'
)

const {
    getMemberObjectives
} = require(
    '../src/database/repositories/objectiveRepository'
)

const {
    syncMemberObjectives
} = require(
    '../src/services/objectiveProgressService'
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


function getStatusIcon(
    status
) {

    const icons = {

        IN_PROGRESS:
            '🎯',

        COMPLETED:
            '✅',

        CLAIMED:
            '🎁',

        EXPIRED:
            '⌛',

        CANCELLED:
            '🚫'

    }


    return (
        icons[status] ||
        '🎯'
    )

}


function getPeriodLabel(
    periodType
) {

    const labels = {

        DAILY:
            'Diario',

        WEEKLY:
            'Semanal',

        SEASON:
            'Temporada',

        PERMANENT:
            'Permanente',

        EVENT:
            'Evento'

    }


    return (

        labels[periodType] ||

        safeText(
            periodType,
            'Desconocido'
        )

    )

}


function getStatusLabel(
    status
) {

    const labels = {

        IN_PROGRESS:
            'En progreso',

        COMPLETED:
            'Completado',

        CLAIMED:
            'Reclamado',

        EXPIRED:
            'Expirado',

        CANCELLED:
            'Cancelado'

    }


    return (

        labels[status] ||

        safeText(
            status,
            'Desconocido'
        )

    )

}


function createProgressBar(
    current,
    target
) {

    const totalBlocks =
        10


    const safeTarget =
        Math.max(

            1,

            safeNumber(
                target,
                1
            )

        )


    const safeCurrent =
        Math.max(

            0,

            safeNumber(
                current,
                0
            )

        )


    const ratio =
        Math.min(

            1,

            safeCurrent /
            safeTarget

        )


    const filled =
        Math.min(

            totalBlocks,

            Math.max(

                0,

                Math.round(
                    ratio *
                    totalBlocks
                )

            )

        )


    return (

        '█'.repeat(
            filled
        )

        +

        '░'.repeat(
            totalBlocks -
            filled
        )

    )

}


module.exports = {

    name:
        'objectives',

    aliases: [
        'objetivos',
        'objetivo'
    ],

    description:
        'Muestra tus objetivos y progreso',

    category:
        'perfil',
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
               SINCRONIZAR OBJETIVOS
            ───────────────────────────── */

            await syncMemberObjectives(
                member.id
            )


            /* ─────────────────────────────
               OBTENER OBJETIVOS
            ───────────────────────────── */

            const result =
                await getMemberObjectives(
                    member.id
                )


            const objectives =
                Array.isArray(
                    result
                )
                    ? result
                    : []


            if (
                objectives.length === 0
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.info(

                                'OBJETIVOS',

                                [],

                                'No tienes objetivos disponibles en este momento.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               OBJETIVOS ACTIVOS
            ───────────────────────────── */

            const active =
                objectives.filter(

                    objective =>

                        objective &&
                        (
                            objective.status ===
                            'IN_PROGRESS'

                            ||

                            objective.status ===
                            'COMPLETED'
                        )

                )


            if (
                active.length === 0
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.info(

                                'OBJETIVOS',

                                [],

                                [
                                    'No tienes objetivos activos.',
                                    '',
                                    'Los objetivos completados, reclamados o expirados siguen guardados en tu historial.'
                                ].join('\n')

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

                'ㅤ۟∩　ׅ　🎯　ׅ　*OBJETIVOS*　ׄᰙ',

                '',

                `𖣣ֶㅤ֯⌗ 👤  ׄ ⬭ *Jugador:* ${playerName}`,

                `𖣣ֶㅤ֯⌗ 📋  ׄ ⬭ *Activos:* ${active.length}`,

                ''

            ]


            /* ─────────────────────────────
               LISTA
            ───────────────────────────── */

            for (
                let i = 0;
                i < active.length;
                i++
            ) {

                const objective =
                    active[i]


                const target =
                    Math.max(

                        0,

                        safeNumber(
                            objective.target_value,
                            0
                        )

                    )


                const rawCurrent =
                    Math.max(

                        0,

                        safeNumber(
                            objective.current_value,
                            0
                        )

                    )


                const current =
                    target > 0

                        ? Math.min(
                            rawCurrent,
                            target
                        )

                        : rawCurrent


                const icon =
                    getStatusIcon(
                        objective.status
                    )


                const bar =
                    createProgressBar(

                        current,

                        target

                    )


                const objectiveName =
                    safeText(

                        objective.objective_name,

                        `Objetivo #${objective.id ?? '?'}`
                    )


                const objectiveId =
                    safeText(
                        objective.id,
                        '?'
                    )


                lines.push(

                    `ㅤ۟∩　ׅ　${icon}　ׅ　*${objectiveName}*`,

                    '',

                    `𖣣ֶㅤ֯⌗ 🆔  ׄ ⬭ *ID:* ${objectiveId}`

                )


                if (
                    objective.objective_description
                ) {

                    lines.push(

                        `𖣣ֶㅤ֯⌗ ✎  ׄ ⬭ *Descripción:* ${safeText(
                            objective.objective_description
                        )}`

                    )

                }


                lines.push(

                    `𖣣ֶㅤ֯⌗ 📊  ׄ ⬭ *Progreso:* ${bar}`,

                    `𖣣ֶㅤ֯⌗ 🔢  ׄ ⬭ *Avance:* ${current}/${target}`,

                    `𖣣ֶㅤ֯⌗ 📅  ׄ ⬭ *Periodo:* ${getPeriodLabel(
                        objective.period_type
                    )}`,

                    `𖣣ֶㅤ֯⌗ 📌  ׄ ⬭ *Estado:* ${getStatusLabel(
                        objective.status
                    )}`

                )


                if (
                    objective.status ===
                    'COMPLETED'
                ) {

                    lines.push(

                        `╰─ 𓂃 🎁 Reclamar: ${prefix}claim ${objective.id}`

                    )

                }


                if (
                    i <
                    active.length - 1
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

                `Objectives consultados: member=${member.id} | total=${objectives.length} | activos=${active.length}`

            )


        } catch (err) {

            logger.error(

                `Error objectives: ${err.stack || err.message}`

            )


            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE OBJETIVOS',

                                'Ocurrió un error al cargar tus objetivos.'

                            )

                    }

                )

            } catch {}

        }

    }

}
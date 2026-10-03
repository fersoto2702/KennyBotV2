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

function getIdentity(msg) {

    const userJid =
        msg.key.participant ||
        msg.participant ||
        msg.key.remoteJid

    const altJid =
        msg.key.participantAlt ||
        msg.participantAlt ||
        null

    const displayName =
        msg.pushName ||
        null

    return {
        userJid,
        altJid,
        displayName
    }
}

function getStatusIcon(status) {

    if (status === 'COMPLETED') {
        return '✅'
    }

    if (status === 'CLAIMED') {
        return '🎁'
    }

    if (status === 'EXPIRED') {
        return '⌛'
    }

    if (status === 'CANCELLED') {
        return '🚫'
    }

    return '🎯'
}

function getPeriodLabel(periodType) {

    const labels = {
        DAILY: 'Diario',
        WEEKLY: 'Semanal',
        SEASON: 'Temporada',
        PERMANENT: 'Permanente',
        EVENT: 'Evento'
    }

    return (
        labels[periodType] ||
        periodType
    )
}

function getStatusLabel(status) {

    const labels = {
        IN_PROGRESS: 'En progreso',
        COMPLETED: 'Completado',
        CLAIMED: 'Reclamado',
        EXPIRED: 'Expirado',
        CANCELLED: 'Cancelado'
    }

    return (
        labels[status] ||
        status
    )
}

function createProgressBar(
    current,
    target
) {

    const totalBlocks = 10

    const safeTarget =
        Math.max(
            1,
            Number(target) || 1
        )

    const safeCurrent =
        Math.max(
            0,
            Number(current) || 0
        )

    const ratio =
        Math.min(
            1,
            safeCurrent /
            safeTarget
        )

    const filled =
        Math.round(
            ratio *
            totalBlocks
        )

    return (
        '█'.repeat(filled) +
        '░'.repeat(
            totalBlocks -
            filled
        )
    )
}

module.exports = {
    name: 'objectives',

    aliases: [
        'objectives',
        'objetivos',
        'objetivo'
    ],

    description:
        'Muestra tus objetivos y progreso',

    category:
        'perfil',

    cooldown: 5,

    async execute({
        sock,
        msg,
        from,
        prefix
    }) {

        const {
            userJid,
            altJid,
            displayName
        } =
            getIdentity(msg)

        if (!userJid) {

            return await sock.safeSendMessage(
                from,
                {
                    text:
                        '❌ No pude identificar tu cuenta.'
                }
            )
        }

        await ensureMember(
            userJid,
            altJid,
            displayName
        )

        const member =
            await getMemberByJid(
                userJid
            ) ||
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
                        '❌ No pude cargar tu perfil.'
                }
            )
        }

        await syncMemberObjectives(
            member.id
        )

        const objectives =
            await getMemberObjectives(
                member.id
            )

        if (!objectives.length) {

            return await sock.safeSendMessage(
                from,
                {
                    text: [
                        '╭─〔 🎯 OBJETIVOS 〕',
                        '│',
                        '│ No tienes objetivos disponibles',
                        '│ en este momento.',
                        '│',
                        '╰─────────────'
                    ].join('\n')
                }
            )
        }

        const active =
            objectives.filter(
                objective =>
                    objective.status ===
                        'IN_PROGRESS' ||
                    objective.status ===
                        'COMPLETED'
            )

        if (!active.length) {

            return await sock.safeSendMessage(
                from,
                {
                    text: [
                        '╭─〔 🎯 OBJETIVOS 〕',
                        '│',
                        '│ No tienes objetivos activos.',
                        '│',
                        '│ Los objetivos completados y',
                        '│ reclamados siguen guardados',
                        '│ en tu historial.',
                        '│',
                        '╰─────────────'
                    ].join('\n')
                }
            )
        }

        const lines = [
            '╭─〔 🎯 OBJETIVOS 〕',
            '│',
            `│ 👤 ${member.display_name || displayName || 'Jugador'}`,
            '│'
        ]

        for (
            let i = 0;
            i < active.length;
            i++
        ) {

            const objective =
                active[i]

            const current =
                Math.min(
                    Number(
                        objective.current_value
                    ) || 0,
                    Number(
                        objective.target_value
                    ) || 0
                )

            const target =
                Number(
                    objective.target_value
                ) || 0

            const icon =
                getStatusIcon(
                    objective.status
                )

            const bar =
                createProgressBar(
                    current,
                    target
                )

            lines.push(
                `│ ${icon} *${objective.objective_name}*`
            )

            if (
                objective.objective_description
            ) {

                lines.push(
                    `│ ${objective.objective_description}`
                )
            }

            lines.push(
                `│ ${bar}`,
                `│ ${current}/${target}`,
                `│ 📅 ${getPeriodLabel(objective.period_type)}`,
                `│ 📌 ${getStatusLabel(objective.status)}`
            )

            if (
                objective.status ===
                'COMPLETED'
            ) {

                lines.push(
                    `│ 🎁 Usa ${prefix}claim ${objective.id}`
                )
            }

            if (
                i <
                active.length - 1
            ) {

                lines.push(
                    '│',
                    '├─────────────',
                    '│'
                )
            }
        }

        lines.push(
            '│',
            '╰─────────────'
        )

        await sock.safeSendMessage(
            from,
            {
                text:
                    lines.join('\n')
            }
        )
    }
}
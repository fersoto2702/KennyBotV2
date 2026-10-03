const {
    ensureMember,
    getMemberByJid
} = require(
    '../src/database/repositories/memberRepository'
)

const {
    getAvailableEvents,
    getMemberEvents
} = require(
    '../src/database/repositories/eventRepository'
)

const {
    syncEventStatuses
} = require(
    '../src/services/eventService'
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

function getEventStatus(status) {

    const statuses = {
        UPCOMING: '🕒 Próximamente',
        ACTIVE: '🟢 Activo',
        FINISHED: '🏁 Finalizado',
        CANCELLED: '🚫 Cancelado'
    }

    return (
        statuses[status] ||
        status
    )
}

function getEventType(type) {

    const types = {
        COMMUNITY: '👥 Comunidad',
        SEASONAL: '🏆 Temporada',
        CHALLENGE: '🎯 Desafío',
        TOURNAMENT: '⚽ Torneo',
        SPECIAL: '✨ Especial'
    }

    return (
        types[type] ||
        type
    )
}

function getParticipationStatus(status) {

    const statuses = {
        REGISTERED: '📝 Inscrito',
        PARTICIPATING: '🎮 Participando',
        COMPLETED: '✅ Completado',
        WITHDRAWN: '↩️ Retirado',
        DISQUALIFIED: '🚫 Descalificado'
    }

    return (
        statuses[status] ||
        status
    )
}

function formatDate(value) {

    if (!value) {
        return 'Sin fecha'
    }

    const date =
        new Date(value)

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return 'Sin fecha'
    }

    return date.toLocaleString(
        'es-MX',
        {
            dateStyle: 'medium',
            timeStyle: 'short'
        }
    )
}

module.exports = {
    name: 'events',

    aliases: [
        'events',
        'eventos',
        'evento'
    ],

    description:
        'Muestra los eventos disponibles',

    category:
        'general',

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

        await syncEventStatuses()

        const [
            events,
            memberEvents
        ] =
            await Promise.all([
                getAvailableEvents(),
                getMemberEvents(
                    member.id
                )
            ])

        if (!events.length) {

            return await sock.safeSendMessage(
                from,
                {
                    text: [
                        '╭─〔 🏆 EVENTOS 〕',
                        '│',
                        '│ No hay eventos disponibles',
                        '│ en este momento.',
                        '│',
                        '╰─────────────'
                    ].join('\n')
                }
            )
        }

        const participationMap =
            new Map(
                memberEvents.map(
                    item => [
                        Number(
                            item.event_id
                        ),
                        item
                    ]
                )
            )

        const lines = [
            '╭─〔 🏆 EVENTOS 〕',
            '│',
            `│ 👤 ${member.display_name || displayName || 'Jugador'}`,
            `│ 📅 Disponibles: ${events.length}`,
            '│'
        ]

        for (
            let i = 0;
            i < events.length;
            i++
        ) {

            const event =
                events[i]

            const participation =
                participationMap.get(
                    Number(event.id)
                )

            lines.push(
                `│ 🏆 *${event.name}*`,
                `│ 🔑 ${event.code}`,
                `│ ${getEventType(event.event_type)}`,
                `│ ${getEventStatus(event.status)}`
            )

            if (
                event.description
            ) {

                lines.push(
                    `│ ${event.description}`
                )
            }

            lines.push(
                `│ 🗓 Inicio: ${formatDate(event.starts_at)}`,
                `│ 🏁 Fin: ${formatDate(event.ends_at)}`
            )

            if (participation) {

                lines.push(
                    `│ ${getParticipationStatus(participation.status)}`
                )

            } else {

                lines.push(
                    `│ 📥 ${prefix}join ${event.code}`
                )
            }

            if (
                i <
                events.length - 1
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
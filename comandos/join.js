const {
    ensureMember,
    getMemberByJid
} = require(
    '../src/database/repositories/memberRepository'
)

const {
    joinEvent
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
    name: 'join',

    aliases: [
        'join',
        'unirse',
        'inscribir'
    ],

    description:
        'Te registra en un evento',

    category:
        'general',

    cooldown: 3,

    async execute({
        sock,
        msg,
        from,
        args,
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

        const eventIdentifier =
            args?.[0]?.trim()

        if (!eventIdentifier) {

            return await sock.safeSendMessage(
                from,
                {
                    text: [
                        '╭─〔 🏆 INSCRIPCIÓN 〕',
                        '│',
                        '│ Debes indicar el código',
                        '│ del evento.',
                        '│',
                        `│ Usa ${prefix}events para`,
                        '│ consultar los disponibles.',
                        '│',
                        `│ Ejemplo: ${prefix}join EVENTO01`,
                        '│',
                        '╰─────────────'
                    ].join('\n')
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

        const result =
            await joinEvent(
                member.id,
                eventIdentifier
            )

        if (!result.processed) {

            if (
                result.reason ===
                'EVENT_NOT_FOUND'
            ) {

                return await sock.safeSendMessage(
                    from,
                    {
                        text: [
                            '╭─〔 ❌ EVENTO 〕',
                            '│',
                            '│ No encontré ese evento.',
                            '│',
                            `│ Usa ${prefix}events para`,
                            '│ consultar los disponibles.',
                            '│',
                            '╰─────────────'
                        ].join('\n')
                    }
                )
            }

            if (
                result.reason ===
                    'EVENT_NOT_AVAILABLE' ||
                result.reason ===
                    'EVENT_FINISHED'
            ) {

                return await sock.safeSendMessage(
                    from,
                    {
                        text: [
                            '╭─〔 🏁 EVENTO 〕',
                            '│',
                            '│ Este evento ya no está',
                            '│ disponible para inscripción.',
                            '│',
                            '╰─────────────'
                        ].join('\n')
                    }
                )
            }

            return await sock.safeSendMessage(
                from,
                {
                    text: [
                        '╭─〔 ❌ EVENTO 〕',
                        '│',
                        '│ No fue posible realizar',
                        '│ la inscripción.',
                        '│',
                        `│ Código: ${result.reason || 'UNKNOWN'}`,
                        '│',
                        '╰─────────────'
                    ].join('\n')
                }
            )
        }

        const event =
            result.event

        if (
            result.alreadyRegistered
        ) {

            return await sock.safeSendMessage(
                from,
                {
                    text: [
                        '╭─〔 📝 EVENTO 〕',
                        '│',
                        `│ 🏆 *${event.name}*`,
                        `│ 🔑 ${event.code}`,
                        '│',
                        '│ Ya estás inscrito en',
                        '│ este evento.',
                        '│',
                        '╰─────────────'
                    ].join('\n')
                }
            )
        }

        await sock.safeSendMessage(
            from,
            {
                text: [
                    '╭─〔 🎉 INSCRIPCIÓN 〕',
                    '│',
                    '│ Inscripción realizada.',
                    '│',
                    `│ 🏆 *${event.name}*`,
                    `│ 🔑 ${event.code}`,
                    `│ ${getEventType(event.event_type)}`,
                    '│',
                    `│ 🗓 Inicio: ${formatDate(event.starts_at)}`,
                    `│ 🏁 Fin: ${formatDate(event.ends_at)}`,
                    '│',
                    '│ Estado: 📝 Inscrito',
                    '│',
                    '╰─────────────'
                ].join('\n')
            }
        )
    }
}
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


function getEventStatus(
    status
) {

    const statuses = {

        UPCOMING:
            '🕒 Próximamente',

        ACTIVE:
            '🟢 Activo',

        FINISHED:
            '🏁 Finalizado',

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


function getEventType(
    type
) {

    const types = {

        COMMUNITY:
            '👥 Comunidad',

        SEASONAL:
            '🏆 Temporada',

        CHALLENGE:
            '🎯 Desafío',

        TOURNAMENT:
            '⚽ Torneo',

        SPECIAL:
            '✨ Especial'

    }


    return (

        types[type] ||

        safeText(
            type,
            'Evento'
        )

    )

}


function getParticipationStatus(
    status
) {

    const statuses = {

        REGISTERED:
            '📝 Inscrito',

        PARTICIPATING:
            '🎮 Participando',

        COMPLETED:
            '✅ Completado',

        WITHDRAWN:
            '↩️ Retirado',

        DISQUALIFIED:
            '🚫 Descalificado'

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
        'events',

    aliases: [
        'eventos',
        'evento'
    ],

    description:
        'Muestra los eventos disponibles',

    category:
        'general',

    cooldown:
        5,


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
               SINCRONIZAR EVENTOS
            ───────────────────────────── */

            await syncEventStatuses()


            /* ─────────────────────────────
               OBTENER EVENTOS
            ───────────────────────────── */

            const [
                eventsResult,
                memberEventsResult
            ] =
                await Promise.all([

                    getAvailableEvents(),

                    getMemberEvents(
                        member.id
                    )

                ])


            const events =
                Array.isArray(
                    eventsResult
                )
                    ? eventsResult
                    : []


            const memberEvents =
                Array.isArray(
                    memberEventsResult
                )
                    ? memberEventsResult
                    : []


            /* ─────────────────────────────
               SIN EVENTOS
            ───────────────────────────── */

            if (
                events.length === 0
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.info(

                                'EVENTOS',

                                [],

                                'No hay eventos disponibles en este momento.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               PARTICIPACIONES
            ───────────────────────────── */

            const participationMap =
                new Map(

                    memberEvents
                        .filter(
                            item =>
                                item &&
                                Number.isFinite(
                                    Number(
                                        item.event_id
                                    )
                                )
                        )
                        .map(

                            item => [

                                Number(
                                    item.event_id
                                ),

                                item

                            ]

                        )

                )


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

                'ㅤ۟∩　ׅ　🏆　ׅ　*EVENTOS*　ׄᰙ',

                '',

                `𖣣ֶㅤ֯⌗ 👤  ׄ ⬭ *Jugador:* ${playerName}`,

                `𖣣ֶㅤ֯⌗ 📅  ׄ ⬭ *Disponibles:* ${events.length}`,

                ''

            ]


            /* ─────────────────────────────
               EVENTOS
            ───────────────────────────── */

            for (
                let i = 0;
                i < events.length;
                i++
            ) {

                const event =
                    events[i]


                if (
                    !event ||
                    typeof event !== 'object'
                ) {

                    continue

                }


                const eventId =
                    Number(
                        event.id
                    )


                const participation =
                    Number.isFinite(
                        eventId
                    )
                        ? participationMap.get(
                            eventId
                        )
                        : null


                const eventName =
                    safeText(
                        event.name,
                        'Evento'
                    )


                const eventCode =
                    safeText(
                        event.code,
                        'SIN-CÓDIGO'
                    )


                lines.push(

                    `ㅤ۟∩　ׅ　🏆　ׅ　*${eventName}*`,

                    '',

                    `𖣣ֶㅤ֯⌗ 🔑  ׄ ⬭ *Código:* ${eventCode}`,

                    `𖣣ֶㅤ֯⌗ 🎮  ׄ ⬭ *Tipo:* ${getEventType(
                        event.event_type
                    )}`,

                    `𖣣ֶㅤ֯⌗ 📊  ׄ ⬭ *Estado:* ${getEventStatus(
                        event.status
                    )}`

                )


                if (
                    event.description
                ) {

                    lines.push(

                        `𖣣ֶㅤ֯⌗ ✎  ׄ ⬭ *Descripción:* ${safeText(
                            event.description
                        )}`

                    )

                }


                lines.push(

                    `𖣣ֶㅤ֯⌗ 🗓  ׄ ⬭ *Inicio:* ${formatDate(
                        event.starts_at
                    )}`,

                    `𖣣ֶㅤ֯⌗ 🏁  ׄ ⬭ *Fin:* ${formatDate(
                        event.ends_at
                    )}`

                )


                if (
                    participation
                ) {

                    lines.push(

                        `𖣣ֶㅤ֯⌗ 🎟️  ׄ ⬭ *Participación:* ${getParticipationStatus(
                            participation.status
                        )}`

                    )

                } else {

                    lines.push(

                        `╰─ 𓂃 Unirse: ${prefix}join ${eventCode}`

                    )

                }


                if (
                    i <
                    events.length - 1
                ) {

                    lines.push(
                        '',
                        ui.divider,
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

                `Events consultados: member=${member.id} | disponibles=${events.length} | participaciones=${memberEvents.length}`

            )


        } catch (err) {

            logger.error(

                `Error events: ${err.stack || err.message}`

            )


            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE EVENTOS',

                                'Ocurrió un error al cargar los eventos.'

                            )

                    }

                )

            } catch {}

        }

    }

}
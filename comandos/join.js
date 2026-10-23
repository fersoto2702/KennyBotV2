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
        'join',

    aliases: [
        'unirse',
        'inscribir'
    ],

    description:
        'Te registra en un evento',

    category:
        'general',
async execute({

        sock,
        msg,
        from,
        args = [],
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
               CÓDIGO DEL EVENTO
            ───────────────────────────── */

            const eventIdentifier =
                String(
                    args[0] || ''
                )
                    .trim()


            if (!eventIdentifier) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'CÓDIGO DE EVENTO REQUERIDO',

                                [
                                    'Debes indicar el código del evento.',
                                    '',
                                    `Usa ${prefix}events para consultar los disponibles.`,
                                    '',
                                    `Ejemplo: ${prefix}join EVENTO01`
                                ].join('\n')

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
               INSCRIPCIÓN
            ───────────────────────────── */

            const result =
                await joinEvent(

                    member.id,

                    eventIdentifier

                )


            if (
                !result ||
                typeof result !== 'object'
            ) {

                throw new Error(
                    'joinEvent devolvió una respuesta inválida'
                )

            }


            /* ─────────────────────────────
               NO PROCESADO
            ───────────────────────────── */

            if (
                !result.processed
            ) {

                if (
                    result.reason ===
                    'EVENT_NOT_FOUND'
                ) {

                    return await sock.safeSendMessage(

                        from,

                        {

                            text:
                                ui.warn(

                                    'EVENTO NO ENCONTRADO',

                                    [
                                        'No encontré ese evento.',
                                        '',
                                        `Usa ${prefix}events para consultar los disponibles.`
                                    ].join('\n')

                                )

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

                            text:
                                ui.warn(

                                    'EVENTO NO DISPONIBLE',

                                    'Este evento ya no está disponible para inscripción.'

                                )

                        }

                    )

                }


                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE INSCRIPCIÓN',

                                `No fue posible realizar la inscripción.\n\nCódigo: ${safeText(
                                    result.reason,
                                    'UNKNOWN'
                                )}`

                            )

                    }

                )

            }


            /* ─────────────────────────────
               EVENTO
            ───────────────────────────── */

            const event =
                result.event


            if (
                !event ||
                typeof event !== 'object'
            ) {

                throw new Error(
                    'joinEvent no devolvió los datos del evento'
                )

            }


            const eventName =
                safeText(
                    event.name,
                    'Evento'
                )


            const eventCode =
                safeText(
                    event.code,
                    eventIdentifier
                )


            /* ─────────────────────────────
               YA INSCRITO
            ───────────────────────────── */

            if (
                result.alreadyRegistered
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.info(

                                'YA ESTÁS INSCRITO',

                                [

                                    [
                                        'Evento',
                                        eventName
                                    ],

                                    [
                                        'Código',
                                        eventCode
                                    ],

                                    [
                                        'Estado',
                                        '📝 INSCRITO'
                                    ]

                                ],

                                'Ya formas parte de este evento.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            const text = [

                'ㅤ۟∩　ׅ　🎉　ׅ　*INSCRIPCIÓN COMPLETADA*　ׄᰙ',

                '',

                `𖣣ֶㅤ֯⌗ 🏆  ׄ ⬭ *Evento:* ${eventName}`,

                `𖣣ֶㅤ֯⌗ 🔑  ׄ ⬭ *Código:* ${eventCode}`,

                `𖣣ֶㅤ֯⌗ 🎮  ׄ ⬭ *Tipo:* ${getEventType(
                    event.event_type
                )}`,

                '',

                `𖣣ֶㅤ֯⌗ 🗓  ׄ ⬭ *Inicio:* ${formatDate(
                    event.starts_at
                )}`,

                `𖣣ֶㅤ֯⌗ 🏁  ׄ ⬭ *Fin:* ${formatDate(
                    event.ends_at
                )}`,

                '',

                '𖣣ֶㅤ֯⌗ 📝  ׄ ⬭ *Estado:* INSCRITO',

                '',

                '╰─ 𓂃 Inscripción realizada correctamente'

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

                `Event join: member=${member.id} | event=${eventCode} | ${eventName}`

            )


        } catch (err) {

            logger.error(

                `Error join event: ${err.stack || err.message}`

            )


            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE EVENTO',

                                'Ocurrió un error al realizar la inscripción.'

                            )

                    }

                )

            } catch {}

        }

    }

}
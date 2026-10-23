const {
    ensureMember,
    getMemberByJid
} = require(
    '../src/database/repositories/memberRepository'
)

const {
    claimObjective
} = require(
    '../src/services/objectiveRewardService'
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


function getRewardLabel(
    grant
) {

    if (
        !grant ||
        typeof grant !== 'object'
    ) {

        return '🎁 Recompensa'

    }


    if (
        grant.reward_type ===
        'MEMBER_CARD'
    ) {

        const family =
            safeText(
                grant.card_family,
                'PLAYER'
            )


        const rating =
            Number(
                grant.card_rating
            )


        const ratingText =
            Number.isFinite(
                rating
            )
                ? ` ${rating}`
                : ''


        return (
            `🃏 Carta ${family}${ratingText}`
        )

    }


    if (
        grant.reward_type ===
        'USER_PACK'
    ) {

        return '📦 Sobre Ultimate Team'

    }


    return '🎁 Recompensa'

}


module.exports = {

    name:
        'claim',

    aliases: [
        'reclamar'
    ],

    description:
        'Reclama la recompensa de un objetivo completado',

    category:
        'perfil',
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
               ID DEL OBJETIVO
            ───────────────────────────── */

            const objectiveId =
                Number(
                    args[0]
                )


            if (
                !Number.isInteger(
                    objectiveId
                ) ||
                objectiveId <= 0
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'ID DE OBJETIVO REQUERIDO',

                                [
                                    'Debes indicar el ID del objetivo.',
                                    '',
                                    `Ejemplo: ${prefix}claim 27`,
                                    '',
                                    `Usa ${prefix}objectives para consultar tus objetivos.`
                                ].join('\n')

                            )

                    }

                )

            }


            /* ─────────────────────────────
               ASEGURAR PERFIL
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
               RECLAMAR
            ───────────────────────────── */

            const result =
                await claimObjective(

                    member.id,

                    objectiveId

                )


            if (
                !result ||
                typeof result !== 'object'
            ) {

                throw new Error(
                    'claimObjective devolvió una respuesta inválida'
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
                    'MEMBER_OBJECTIVE_NOT_FOUND'
                ) {

                    return await sock.safeSendMessage(

                        from,

                        {

                            text:
                                ui.warn(

                                    'OBJETIVO NO ENCONTRADO',

                                    [
                                        'Ese objetivo no existe o no pertenece a tu cuenta.',
                                        '',
                                        `Usa ${prefix}objectives para consultar tus objetivos.`
                                    ].join('\n')

                                )

                        }

                    )

                }


                if (
                    result.reason ===
                    'OBJECTIVE_NOT_COMPLETED'
                ) {

                    return await sock.safeSendMessage(

                        from,

                        {

                            text:
                                ui.info(

                                    'OBJETIVO EN PROGRESO',

                                    [

                                        [
                                            'Estado',
                                            safeText(
                                                result.status,
                                                'IN_PROGRESS'
                                            )
                                        ]

                                    ],

                                    'Todavía no puedes reclamar esta recompensa.'

                                )

                        }

                    )

                }


                if (
                    result.reason ===
                    'OBJECTIVE_HAS_NO_REWARDS'
                ) {

                    return await sock.safeSendMessage(

                        from,

                        {

                            text:
                                ui.warn(

                                    'SIN RECOMPENSAS',

                                    'El objetivo está completado, pero no tiene recompensas configuradas.'

                                )

                        }

                    )

                }


                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR AL RECLAMAR',

                                `No fue posible reclamar la recompensa.\n\nCódigo: ${safeText(
                                    result.reason,
                                    'UNKNOWN'
                                )}`

                            )

                    }

                )

            }


            /* ─────────────────────────────
               RECOMPENSAS
            ───────────────────────────── */

            const grants =
                Array.isArray(
                    result.grants
                )
                    ? result.grants
                    : []


            /* ─────────────────────────────
               YA RECLAMADO
            ───────────────────────────── */

            if (
                result.alreadyClaimed
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.info(

                                'RECOMPENSA YA RECLAMADA',

                                [

                                    [
                                        'Objetivo',
                                        safeText(
                                            result.objectiveName,
                                            `#${objectiveId}`
                                        )
                                    ],

                                    [
                                        'Recompensas',
                                        grants.length
                                    ]

                                ],

                                'Este objetivo ya había sido reclamado.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               LISTA DE RECOMPENSAS
            ───────────────────────────── */

            const rewardLines =
                grants.length > 0

                    ? grants.map(

                        (
                            grant,
                            index
                        ) =>
                            `𖣣ֶㅤ֯⌗ 🎁  ׄ ⬭ *${index + 1}.* ${getRewardLabel(grant)}`

                    )

                    : [
                        '╰─ 𓂃 Sin detalles de recompensa'
                    ]


            /* ─────────────────────────────
               RESPUESTA FINAL
            ───────────────────────────── */

            const text = [

                'ㅤ۟∩　ׅ　🎉　ׅ　*OBJETIVO COMPLETADO*　ׄᰙ',

                '',

                `𖣣ֶㅤ֯⌗ 🎯  ׄ ⬭ *Objetivo:* ${safeText(
                    result.objectiveName,
                    `#${objectiveId}`
                )}`,

                `𖣣ֶㅤ֯⌗ 🆔  ׄ ⬭ *ID:* ${objectiveId}`,

                '',

                'ㅤ۟∩　ׅ　🎁　ׅ　*RECOMPENSAS*',

                '',

                ...rewardLines,

                '',

                '𖣣ֶㅤ֯⌗ ✅  ׄ ⬭ *Estado:* ENTREGADA',

                '',

                '╰─ 𓂃 Recompensa reclamada correctamente'

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

                `Objective claimed: member=${member.id} | objective=${objectiveId} | rewards=${grants.length}`

            )


        } catch (err) {

            logger.error(

                `Error claim: ${err.stack || err.message}`

            )


            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR CLAIM',

                                'Ocurrió un error al reclamar la recompensa.'

                            )

                    }

                )

            } catch {}

        }

    }

}
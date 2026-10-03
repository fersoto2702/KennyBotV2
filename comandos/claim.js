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

function getRewardLabel(grant) {

    if (
        grant.reward_type ===
        'MEMBER_CARD'
    ) {

        const family =
            grant.card_family ||
            'PLAYER'

        const rating =
            grant.card_rating
                ? ` ${grant.card_rating}`
                : ''

        return (
            `🃏 Carta ${family}${rating}`
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
    name: 'claim',

    aliases: [
        'claim',
        'reclamar'
    ],

    description:
        'Reclama la recompensa de un objetivo completado',

    category:
        'perfil',

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

        const objectiveId =
            Number(
                args?.[0]
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
                    text: [
                        '╭─〔 🎁 RECLAMAR 〕',
                        '│',
                        '│ Debes indicar el ID del objetivo.',
                        '│',
                        `│ Ejemplo: ${prefix}claim 27`,
                        '│',
                        `│ Usa ${prefix}objectives para`,
                        '│ consultar tus objetivos.',
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
            await claimObjective(
                member.id,
                objectiveId
            )

        if (!result.processed) {

            if (
                result.reason ===
                'MEMBER_OBJECTIVE_NOT_FOUND'
            ) {

                return await sock.safeSendMessage(
                    from,
                    {
                        text: [
                            '╭─〔 ❌ OBJETIVO 〕',
                            '│',
                            '│ Ese objetivo no existe',
                            '│ o no pertenece a tu cuenta.',
                            '│',
                            `│ Usa ${prefix}objectives`,
                            '│ para consultar los tuyos.',
                            '│',
                            '╰─────────────'
                        ].join('\n')
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
                        text: [
                            '╭─〔 ⏳ OBJETIVO 〕',
                            '│',
                            '│ Todavía no puedes reclamar',
                            '│ esta recompensa.',
                            '│',
                            `│ Estado: ${result.status || 'IN_PROGRESS'}`,
                            '│',
                            '╰─────────────'
                        ].join('\n')
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
                        text: [
                            '╭─〔 ⚠️ OBJETIVO 〕',
                            '│',
                            '│ El objetivo está completado,',
                            '│ pero no tiene recompensas',
                            '│ configuradas.',
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
                        '╭─〔 ❌ ERROR 〕',
                        '│',
                        '│ No fue posible reclamar',
                        '│ esta recompensa.',
                        '│',
                        `│ Código: ${result.reason || 'UNKNOWN'}`,
                        '│',
                        '╰─────────────'
                    ].join('\n')
                }
            )
        }

        const grants =
            result.grants || []

        if (
            result.alreadyClaimed
        ) {

            return await sock.safeSendMessage(
                from,
                {
                    text: [
                        '╭─〔 🎁 RECOMPENSA 〕',
                        '│',
                        '│ Este objetivo ya había',
                        '│ sido reclamado.',
                        '│',
                        `│ Recompensas: ${grants.length}`,
                        '│',
                        '╰─────────────'
                    ].join('\n')
                }
            )
        }

        const rewardLines =
            grants.map(
                grant =>
                    `│ ${getRewardLabel(grant)}`
            )

        const text = [
            '╭─〔 🎉 OBJETIVO COMPLETADO 〕',
            '│',
            `│ ${result.objectiveName || 'Objetivo'}`,
            '│',
            '│ Recompensa reclamada:',
            '│',
            ...rewardLines,
            '│',
            '│ Estado de entrega:',
            '│ ⏳ Procesando',
            '│',
            '╰─────────────'
        ].join('\n')

        await sock.safeSendMessage(
            from,
            {
                text
            }
        )
    }
}
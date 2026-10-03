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

function getPackStatus(status) {
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
    name: 'packs',

    aliases: [
        'packs',
        'sobres',
        'picks',
        'playerpicks'
    ],

    description:
        'Muestra tus Player Picks disponibles',

    category:
        'ultimate-team',

    cooldown: 3,

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

        const [
            packs,
            counts
        ] =
            await Promise.all([
                getUserPacks(
                    member.id
                ),
                getUserPackCounts(
                    member.id
                )
            ])

        if (!packs.length) {
            return await sock.safeSendMessage(
                from,
                {
                    text: [
                        '╭─〔 🎁 PLAYER PICKS 〕',
                        '│',
                        `│ 👤 ${member.display_name || displayName || 'Jugador'}`,
                        '│',
                        '│ No tienes Player Picks',
                        '│ disponibles.',
                        '│',
                        `│ ✅ Reclamados: ${counts.claimed}`,
                        '│',
                        '╰─────────────'
                    ].join('\n')
                }
            )
        }

        const lines = [
            '╭─〔 🎁 PLAYER PICKS 〕',
            '│',
            `│ 👤 ${member.display_name || displayName || 'Jugador'}`,
            `│ 📦 Sin abrir: ${counts.unopened}`,
            `│ 🎴 Selección pendiente: ${counts.pendingSelection}`,
            '│'
        ]

        for (
            let i = 0;
            i < packs.length;
            i++
        ) {
            const pack =
                packs[i]

            lines.push(
                `│ 🎁 *#${pack.id} — ${pack.pack_name}*`,
                `│ ${getPackStatus(pack.status)}`,
                `│ 🗂 Pool: ${pack.pool_name}`,
                `│ 📅 ${formatDate(pack.obtained_at)}`
            )

            if (
                pack.obtained_reason
            ) {
                lines.push(
                    `│ 🎯 ${pack.obtained_reason}`
                )
            }

            lines.push('│')

            if (
                pack.status ===
                'UNOPENED'
            ) {
                lines.push(
                    `│ ▶️ ${prefix}openpack ${pack.id}`
                )
            }

            if (
                pack.status ===
                'PENDING_SELECTION'
            ) {
                lines.push(
                    `│ 🎴 ${prefix}pick ${pack.id}`
                )
            }

            if (
                i <
                packs.length - 1
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
const {
    ensureMember
} = require('../src/database/repositories/memberRepository')

const {
    getUserClub
} = require('../src/database/repositories/userClubRepository')

function getSender(msg) {
    return (
        msg.key.participant ||
        msg.participant ||
        msg.key.remoteJid
    )
}

function getAltJid(msg) {
    const sender = getSender(msg)

    const candidates = [
        msg.key.participantAlt,
        msg.participantAlt
    ]

    for (const value of candidates) {
        if (
            value &&
            value !== sender
        ) {
            return value
        }
    }

    return null
}

function getDisplayName(msg) {
    return (
        msg.pushName ||
        msg.verifiedBizName ||
        null
    )
}

function getPlayerName(card) {
    return (
        card.known_as ||
        card.player_name ||
        'Jugador'
    )
}

function formatClub(
    member,
    club,
    prefix
) {
    const lines = [
        '╭─〔 ⚽ MI CLUB 〕',
        '│',
        `│ 👤 ${member.display_name || 'Miembro'}`,
        `│ 🎴 Cartas: ${club.total}`,
        '│'
    ]

    if (club.total === 0) {
        lines.push(
            '│ 📭 Todavía no tienes cartas.',
            '│',
            '│ Consigue Player Picks y',
            '│ añade jugadores a tu club.',
            '│',
            '╰─────────────'
        )

        return lines.join('\n')
    }

    if (club.cards.length === 0) {
        lines.push(
            `│ ❌ La página ${club.page} no existe.`,
            `│ 📄 Páginas disponibles: ${club.totalPages}`,
            '│',
            `│ ▶️ ${prefix}myclub 1`,
            '│',
            '╰─────────────'
        )

        return lines.join('\n')
    }

    for (const card of club.cards) {
        lines.push(
            `│ ⭐ *${card.rating} ${card.position} — ${getPlayerName(card)}*`,
            `│ 🎨 ${card.promo_name}`,
            `│ 🎮 ${card.game_code}`
        )

        if (card.club) {
            lines.push(
                `│ 🏟 ${card.club}`
            )
        }

        lines.push(
            `│ 🆔 Club #${card.club_entry_id}`,
            '│'
        )
    }

    lines.push(
        `│ 📄 Página ${club.page}/${club.totalPages}`
    )

    if (club.page < club.totalPages) {
        lines.push(
            `│ ▶️ ${prefix}myclub ${club.page + 1}`
        )
    }

    if (club.page > 1) {
        lines.push(
            `│ ◀️ ${prefix}myclub ${club.page - 1}`
        )
    }

    lines.push(
        '│',
        '╰─────────────'
    )

    return lines.join('\n')
}

module.exports = {
    name: 'myclub',
    aliases: [
        'club',
        'miclub',
        'utclub'
    ],
    description:
        'Muestra tus cartas de Ultimate Team.',
    category: 'ultimate-team',
    cooldown: 5,

    async execute({
        sock,
        msg,
        from,
        args,
        prefix
    }) {
        const page =
            args?.[0] === undefined
                ? 1
                : Number(args[0])

        if (
            !Number.isInteger(page) ||
            page <= 0
        ) {
            await sock.sendMessage(
                from,
                {
                    text:
                        `Uso: ${prefix}myclub [página]\n` +
                        `Ejemplo: ${prefix}myclub 2`
                },
                {
                    quoted: msg
                }
            )

            return
        }

        try {
            const member =
                await ensureMember(
                    getSender(msg),
                    getAltJid(msg),
                    getDisplayName(msg)
                )

            const club =
                await getUserClub(
                    member.id,
                    page,
                    10
                )

            await sock.sendMessage(
                from,
                {
                    text:
                        formatClub(
                            member,
                            club,
                            prefix
                        )
                },
                {
                    quoted: msg
                }
            )
        } catch (error) {
            await sock.sendMessage(
                from,
                {
                    text:
                        '❌ No se pudo cargar tu club.\n\n' +
                        error.message
                },
                {
                    quoted: msg
                }
            )
        }
    }
}
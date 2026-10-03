const {
    ensureMember
} = require('../src/database/repositories/memberRepository')

const {
    claimPick
} = require('../src/services/packPickService')

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

function getPlayerName(pick) {
    return (
        pick.known_as ||
        pick.player_name ||
        'Jugador'
    )
}

function formatSuccess(result) {
    const pick = result.pick
    const playerName =
        getPlayerName(pick)

    const lines = [
        '╭─〔 ✅ PLAYER PICK 〕',
        '│',
        '│ 🎉 *¡Carta seleccionada!*',
        '│',
        `│ ⭐ ${pick.rating} ${pick.position}`,
        `│ 👤 *${playerName}*`,
        `│ 🎨 ${pick.promo_name}`,
        `│ 🎮 ${pick.game_code}`
    ]

    if (pick.club) {
        lines.push(
            `│ 🏟 ${pick.club}`
        )
    }

    lines.push(
        '│',
        '│ 📥 Añadida a tu club',
        `│ 🆔 Club #${result.clubEntryId}`
    )

    if (
        result.status ===
        'PENDING_SELECTION'
    ) {
        lines.push(
            '│',
            `│ 🎴 Selecciones restantes: ${result.remaining}`
        )
    } else {
        lines.push(
            '│',
            '│ 🔒 Player Pick completado'
        )
    }

    lines.push(
        '│',
        '╰─────────────'
    )

    return lines.join('\n')
}

module.exports = {
    name: 'pick',
    aliases: [
        'elegir',
        'selectpick',
        'claimpick'
    ],
    description:
        'Selecciona una carta de un Player Pick abierto.',
    category: 'ultimate-team',
    cooldown: 5,

    async execute({
        sock,
        msg,
        from,
        args,
        prefix
    }) {
        const packId =
            Number(args?.[0])

        const position =
            Number(args?.[1])

        if (
            !Number.isInteger(packId) ||
            packId <= 0 ||
            !Number.isInteger(position) ||
            position <= 0
        ) {
            await sock.sendMessage(
                from,
                {
                    text:
                        `Uso: ${prefix}pick <pack> <opción>\n` +
                        `Ejemplo: ${prefix}pick 2 1`
                },
                {
                    quoted: msg
                }
            )

            return
        }

        try {
            const sender =
                getSender(msg)

            const altJid =
                getAltJid(msg)

            const displayName =
                getDisplayName(msg)

            const member =
                await ensureMember(
                    sender,
                    altJid,
                    displayName
                )

            const result =
                await claimPick(
                    member.id,
                    packId,
                    position
                )

            if (
                result.status ===
                'EXPIRED'
            ) {
                await sock.sendMessage(
                    from,
                    {
                        text:
                            '❌ Este Player Pick ha expirado.'
                    },
                    {
                        quoted: msg
                    }
                )

                return
            }

            await sock.sendMessage(
                from,
                {
                    text:
                        formatSuccess(result)
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
                        '❌ No se pudo seleccionar la carta.\n\n' +
                        error.message
                },
                {
                    quoted: msg
                }
            )
        }
    }
}
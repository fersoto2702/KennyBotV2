const {
    ensureMember
} = require('../src/database/repositories/memberRepository')

const {
    openPack
} = require('../src/services/packOpeningService')

function getSender(msg) {
    return (
        msg.key.participant ||
        msg.participant ||
        msg.key.remoteJid
    )
}

function getAltJid(msg) {
    const candidates = [
        msg.key.participantAlt,
        msg.participantAlt
    ]

    for (const value of candidates) {
        if (
            value &&
            value !== getSender(msg)
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

function formatOutfieldStats(pick) {
    const stats = [
        ['PAC', pick.pac],
        ['SHO', pick.sho],
        ['PAS', pick.pas],
        ['DRI', pick.dri],
        ['DEF', pick.def],
        ['PHY', pick.phy]
    ]

    return stats
        .filter(([, value]) =>
            value !== null &&
            value !== undefined
        )
        .map(([name, value]) =>
            `${name} ${value}`
        )
        .join(' · ')
}

function formatGoalkeeperStats(pick) {
    const stats = [
        ['DIV', pick.div_stat],
        ['HAN', pick.han],
        ['KIC', pick.kic],
        ['REF', pick.ref_stat],
        ['SPD', pick.spd],
        ['POS', pick.pos_stat]
    ]

    return stats
        .filter(([, value]) =>
            value !== null &&
            value !== undefined
        )
        .map(([name, value]) =>
            `${name} ${value}`
        )
        .join(' · ')
}

function formatStats(pick) {
    const position =
        String(pick.position || '')
            .toUpperCase()

    if (
        position === 'GK' ||
        position === 'POR'
    ) {
        return formatGoalkeeperStats(pick)
    }

    return formatOutfieldStats(pick)
}

function formatPicks(result, prefix) {
    const lines = [
        '╭─〔 🎴 PLAYER PICK 〕',
        '│',
        `│ 🎁 *${result.pack.pack_name}*`,
        `│ 🗂 Pool: ${result.pack.pool_name}`,
        `│ 🆔 Pack #${result.pack.id}`,
        '│'
    ]

    if (result.reused) {
        lines.push(
            '│ 🔄 Selección pendiente recuperada',
            '│'
        )
    }

    for (const pick of result.picks) {
        const name =
            getPlayerName(pick)

        const stats =
            formatStats(pick)

        lines.push(
            `│ *${pick.pick_position}.* ${pick.rating} ${pick.position} — ${name}`,
            `│ 🎨 ${pick.promo_name}`,
            `│ 🎮 ${pick.game_code}`
        )

        if (pick.club) {
            lines.push(
                `│ 🏟 ${pick.club}`
            )
        }

        if (stats) {
            lines.push(
                `│ 📊 ${stats}`
            )
        }

        lines.push('│')
    }

    lines.push(
        `│ ▶️ ${prefix}pick ${result.pack.id} <opción>`,
        '│',
        '╰─────────────'
    )

    return lines.join('\n')
}

function formatClosedPack(result) {
    const states = {
        CLAIMED:
            'Este Player Pick ya fue reclamado.',
        EXPIRED:
            'Este Player Pick ha expirado.',
        CANCELLED:
            'Este Player Pick fue cancelado.'
    }

    return [
        '╭─〔 🎁 PLAYER PICK 〕',
        '│',
        `│ 🎁 *${result.pack.pack_name}*`,
        `│ 🆔 Pack #${result.pack.id}`,
        `│ ⚠️ ${states[result.status] || result.status}`,
        '│',
        '╰─────────────'
    ].join('\n')
}

module.exports = {
    name: 'openpack',
    aliases: [
        'abrirpack',
        'openpick',
        'abrirpick'
    ],
    description:
        'Abre un Player Pick de Ultimate Team.',
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

        if (
            !Number.isInteger(packId) ||
            packId <= 0
        ) {
            await sock.sendMessage(
                from,
                {
                    text:
                        `Uso: ${prefix}openpack <id>\n` +
                        `Ejemplo: ${prefix}openpack 2`
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
                await openPack(
                    member.id,
                    packId
                )

            let text

            if (
                result.status ===
                'PENDING_SELECTION'
            ) {
                text =
                    formatPicks(
                        result,
                        prefix
                    )
            } else {
                text =
                    formatClosedPack(
                        result
                    )
            }

            await sock.sendMessage(
                from,
                { text },
                {
                    quoted: msg
                }
            )
        } catch (error) {
            await sock.sendMessage(
                from,
                {
                    text:
                        '❌ No se pudo abrir el Player Pick.\n\n' +
                        error.message
                },
                {
                    quoted: msg
                }
            )
        }
    }
}
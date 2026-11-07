const logger = require('../../src/utils/logger')
const ui = require('../../src/utils/ui')
const { getInactive } = require('../../src/database/mysql')

function normalizeJid(jid) {
    if (!jid) return null

    return String(jid)
        .trim()
        .replace(/:\d+@/, '@')
}

function getParticipantJid(participant) {
    if (!participant) return null

    return normalizeJid(
        participant.phoneNumber ||
        participant.id ||
        participant.lid
    )
}

function getSender(msg) {
    return normalizeJid(
        msg?.key?.participant ||
        msg?.participant ||
        msg?.key?.remoteJid
    )
}

function isAdminParticipant(participant) {
    return (
        participant?.admin === 'admin' ||
        participant?.admin === 'superadmin'
    )
}

function buildUserLines(users) {
    return users.map((user, index) => {
        const number =
            String(user.usuario)
                .split('@')[0]

        return (
            `𖣣ֶㅤ֯⌗ ${index + 1}.  ׄ ⬭ *@${number}*`
        )
    })
}

async function sendMessage(
    sock,
    jid,
    content
) {
    if (
        typeof sock.safeSendMessage ===
        'function'
    ) {
        return await sock.safeSendMessage(
            jid,
            content
        )
    }

    return await sock.sendMessage(
        jid,
        content
    )
}

async function removeUsers(
    sock,
    groupJid,
    users
) {
    const removed = []
    const failed = []

    for (
        const jid of users
    ) {
        try {
            if (
                typeof sock.safeGroupParticipantsUpdate ===
                'function'
            ) {
                await sock.safeGroupParticipantsUpdate(
                    groupJid,
                    [jid],
                    'remove'
                )
            } else {
                await sock.groupParticipantsUpdate(
                    groupJid,
                    [jid],
                    'remove'
                )
            }

            removed.push(
                jid
            )
        } catch (err) {
            failed.push(
                {
                    jid,
                    error:
                        err?.message ||
                        'UNKNOWN_ERROR'
                }
            )

            logger.warn(
                `Inactive Kick Error | ${jid} | ${err?.message || err}`
            )
        }
    }

    return {
        removed,
        failed
    }
}

module.exports = {
    name: 'inactive',

    aliases: [
        'inactivos',
        'deadchat'
    ],

    description:
        'Muestra los usuarios menos activos del grupo',

    category:
        'general',

    async execute({
        sock,
        from,
        args,
        msg
    }) {
        try {
            if (
                !from.endsWith(
                    '@g.us'
                )
            ) {
                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.error(
                                'SOLO GRUPOS',
                                'Este comando solo funciona dentro de grupos.'
                            )
                    }
                )
            }

            const action =
                String(
                    args?.[0] ||
                    ''
                )
                    .trim()
                    .toLowerCase()

            const confirm =
                String(
                    args?.[1] ||
                    ''
                )
                    .trim()
                    .toLowerCase() ===
                'confirm'

            const users =
                await getInactive(
                    from
                )

            if (
                !Array.isArray(users) ||
                users.length ===
                    0
            ) {
                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.warn(
                                'SIN DATOS',
                                'No hay usuarios inactivos registrados.'
                            )
                    }
                )
            }

            const metadata =
                await sock.groupMetadata(
                    from
                )

            const participants =
                Array.isArray(
                    metadata?.participants
                )
                    ? metadata.participants
                    : []

            const participantMap =
                new Map()

            for (
                const participant of participants
            ) {
                const jid =
                    getParticipantJid(
                        participant
                    )

                if (jid) {
                    participantMap.set(
                        jid,
                        participant
                    )
                }
            }

            const botJids =
                new Set(
                    [
                        normalizeJid(
                            sock?.user?.id
                        ),
                        normalizeJid(
                            sock?.user?.lid
                        )
                    ]
                        .filter(
                            Boolean
                        )
                )

            const seen =
                new Set()

            const validUsers =
                users
                    .map(
                        user => {
                            if (
                                !user ||
                                typeof user.usuario !==
                                    'string'
                            ) {
                                return null
                            }

                            const jid =
                                normalizeJid(
                                    user.usuario
                                )

                            if (
                                !jid ||
                                seen.has(
                                    jid
                                ) ||
                                botJids.has(
                                    jid
                                )
                            ) {
                                return null
                            }

                            const participant =
                                participantMap.get(
                                    jid
                                )

                            if (
                                !participant
                            ) {
                                return null
                            }

                            seen.add(
                                jid
                            )

                            return {
                                ...user,
                                usuario:
                                    jid,
                                participant
                            }
                        }
                    )
                    .filter(
                        Boolean
                    )

            if (
                validUsers.length ===
                    0
            ) {
                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.warn(
                                'SIN DATOS',
                                'No se encontraron usuarios inactivos que sigan dentro del grupo.'
                            )
                    }
                )
            }

            if (
                action !==
                    'kick'
            ) {
                const mentions =
                    validUsers.map(
                        user =>
                            user.usuario
                    )

                await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            [
                                'ㅤ۟∩　ׅ　💀　ׅ　*USUARIOS MÁS INACTIVOS*　ׄᰙ',
                                '',
                                ...buildUserLines(
                                    validUsers
                                ),
                                '',
                                `╰─ 𓂃 Total: ${validUsers.length}`
                            ]
                                .join(
                                    '\n'
                                ),
                        mentions
                    }
                )

                logger.event(
                    `Inactive: ${from.split('@')[0]} | ${validUsers.length} usuarios`
                )

                return true
            }

            const sender =
                getSender(
                    msg
                )

            const senderParticipant =
                participantMap.get(
                    sender
                )

            if (
                !senderParticipant ||
                !isAdminParticipant(
                    senderParticipant
                )
            ) {
                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.error(
                                'SOLO ADMINS',
                                'Solo los administradores pueden eliminar usuarios inactivos.'
                            )
                    }
                )
            }

            const botParticipant =
                participants.find(
                    participant =>
                        botJids.has(
                            getParticipantJid(
                                participant
                            )
                        )
                )

            if (
                !botParticipant ||
                !isAdminParticipant(
                    botParticipant
                )
            ) {
                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.error(
                                'BOT SIN ADMIN',
                                'Necesito ser administrador para eliminar participantes.'
                            )
                    }
                )
            }

            const removableUsers =
                validUsers.filter(
                    user =>
                        !isAdminParticipant(
                            user.participant
                        ) &&
                        user.usuario !==
                            sender
                )

            const protectedUsers =
                validUsers.filter(
                    user =>
                        isAdminParticipant(
                            user.participant
                        ) ||
                        user.usuario ===
                            sender
                )

            if (
                removableUsers.length ===
                    0
            ) {
                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.warn(
                                'SIN USUARIOS ELIMINABLES',
                                'Los usuarios detectados están protegidos o son administradores.'
                            )
                    }
                )
            }

            if (
                !confirm
            ) {
                const mentions =
                    removableUsers.map(
                        user =>
                            user.usuario
                    )

                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            [
                                'ㅤ۟∩　ׅ　⚠️　ׅ　*CONFIRMAR ELIMINACIÓN*　ׄᰙ',
                                '',
                                ...buildUserLines(
                                    removableUsers
                                ),
                                '',
                                `𖣣ֶㅤ֯⌗ 👥  ׄ ⬭ *A eliminar:* ${removableUsers.length}`,
                                `𖣣ֶㅤ֯⌗ 🛡️  ׄ ⬭ *Protegidos:* ${protectedUsers.length}`,
                                '',
                                '╰─ 𓂃 Usa *.inactive kick confirm* para continuar.'
                            ]
                                .join(
                                    '\n'
                                ),
                        mentions
                    }
                )
            }

            const result =
                await removeUsers(
                    sock,
                    from,
                    removableUsers.map(
                        user =>
                            user.usuario
                    )
                )

            await sendMessage(
                sock,
                from,
                {
                    text:
                        [
                            'ㅤ۟∩　ׅ　🧹　ׅ　*LIMPIEZA DE INACTIVOS*　ׄᰙ',
                            '',
                            `𖣣ֶㅤ֯⌗ ✅  ׄ ⬭ *Eliminados:* ${result.removed.length}`,
                            `𖣣ֶㅤ֯⌗ 🛡️  ׄ ⬭ *Protegidos:* ${protectedUsers.length}`,
                            `𖣣ֶㅤ֯⌗ ❌  ׄ ⬭ *Errores:* ${result.failed.length}`,
                            '',
                            '╰─ 𓂃 Limpieza terminada.'
                        ]
                            .join(
                                '\n'
                            ),
                    mentions:
                        [
                            ...result.removed,
                            ...result.failed.map(
                                item =>
                                    item.jid
                            )
                        ]
                }
            )

            logger.event(
                `Inactive Kick: ${from.split('@')[0]} | Eliminados: ${result.removed.length} | Errores: ${result.failed.length}`
            )

            return true
        } catch (err) {
            logger.error(
                `Inactive Error: ${err.stack || err.message}`
            )

            try {
                await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.error(
                                'ERROR DE INACTIVOS',
                                'No se pudo consultar la actividad del grupo.'
                            )
                    }
                )
            } catch {}

            return false
        }
    }
}
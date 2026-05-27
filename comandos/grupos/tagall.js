const isGroupAdmin =
    require('../../src/utils/isAdmin')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const { PhoneNumberUtil } =
    require('google-libphonenumber')

const phoneUtil =
    PhoneNumberUtil.getInstance()

// =========================
// CONFIG
// =========================

const MAX_MENTIONS = 200

// =========================
// EMOJI DE BANDERA POR CÓDIGO ISO
// =========================

function isoToFlag(iso) {

    if (!iso || iso.length !== 2) return '🌐'

    return [...iso.toUpperCase()]
        .map(c =>
            String.fromCodePoint(
                0x1F1E6 - 65 + c.charCodeAt(0)
            )
        )
        .join('')

}

// =========================
// GET FLAG
// =========================

function getFlag(jid) {

    try {

        const number =
            jid.split('@')[0]

        const parsed =
            phoneUtil.parse('+' + number)

        const regionCode =
            phoneUtil.getRegionCodeForNumber(parsed)

        return isoToFlag(regionCode)

    } catch {

        return '🌐'

    }

}

module.exports = {

    name:
        'tagall',

    aliases: [

        'todos',
        'notifyall'

    ],

    description:
        'Menciona a todos los miembros del grupo',

    category:
        'grupos',

    adminOnly: true,

    groupOnly: true,

    cooldown: 20,

    async execute({

        sock,
        from,
        msg

    }) {

        try {

            // =========================
            // GROUP
            // =========================

            if (
                !from.endsWith('@g.us')
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'SOLO GRUPOS',

                                'Este comando solo funciona en grupos.'

                            )

                    }

                )

            }

            // =========================
            // TYPING
            // =========================

            await sock.sendPresenceUpdate(
                'composing',
                from
            )

            // =========================
            // ADMIN
            // =========================

            const sender =

                msg.key.participant ||

                msg.participant

            const admin =

                await isGroupAdmin(

                    sock,
                    from,
                    sender

                )

            if (!admin) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ACCESO DENEGADO',

                                'Solo administradores pueden usar este comando.'

                            )

                    }

                )

            }

            // =========================
            // METADATA
            // =========================

            const metadata =

                await sock.groupMetadata(
                    from
                )

            const participants =
                metadata.participants || []

            if (
                participants.length === 0
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'GRUPO VACÍO',

                                'No hay participantes.'

                            )

                    }

                )

            }

            // =========================
            // LIMIT
            // =========================

            const limitedParticipants =

                participants.slice(
                    0,
                    MAX_MENTIONS
                )

            // =========================
            // SPLIT
            // =========================

            const admins =
                limitedParticipants.filter(

                    p =>
                        p.admin === 'admin' ||
                        p.admin === 'superadmin'

                )

            const members =
                limitedParticipants.filter(

                    p =>
                        !p.admin

                )

            // =========================
            // MENTIONS
            // =========================

            const mentions =

                limitedParticipants.map(
                    p => p.id
                )

            // =========================
            // BUILD
            // =========================

            const adminList =

                admins.length

                    ? admins.map(p => {

                        const flag = getFlag(p.id)
                        const number = p.id.split('@')[0]
                        return `👑 ${flag} @${number}`

                    }).join('\n')

                    : 'Sin admins'

            const memberList =

                members.length

                    ? members.map(p => {

                        const flag = getFlag(p.id)
                        const number = p.id.split('@')[0]
                        return `👤 ${flag} @${number}`

                    }).join('\n')

                    : 'Sin miembros'

            // =========================
            // SEND
            // =========================

            await sock.safeSendMessage(

                from,

                {

                    text: [

                        `📢 TAGALL`,

                        ui.divider,

                        `👥 Miembros: ${participants.length}`,

                        `👑 Admins: ${admins.length}`,

                        ui.divider,

                        `👑 ADMINISTRADORES\n`,

                        adminList,

                        ui.divider,

                        `👥 MIEMBROS\n`,

                        memberList,

                        ui.divider,

                        participants.length > MAX_MENTIONS

                            ? `⚠️ Solo se mencionaron ${MAX_MENTIONS} usuarios para evitar flood.`

                            : ''

                    ].join('\n'),

                    mentions

                }

            )

            logger.event(

                `Tagall usado: ${from.split('@')[0]}`

            )

        } catch (err) {

            logger.error(

                `Error tagall: ${err.message}`

            )

            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR',

                                'No se pudo ejecutar el tagall.'

                            )

                    }

                )

            } catch {}

        }

    }

}
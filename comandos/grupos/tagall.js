const isGroupAdmin =
    require('../../src/utils/isAdmin')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const {
    PhoneNumberUtil
} = require('google-libphonenumber')


const phoneUtil =
    PhoneNumberUtil.getInstance()


const MAX_MENTIONS =
    1000


function isoToFlag(iso) {

    if (
        !iso ||
        iso.length !== 2
    ) {

        return '🌐'

    }


    return [...iso.toUpperCase()]
        .map(
            char =>
                String.fromCodePoint(
                    0x1F1E6 -
                    65 +
                    char.charCodeAt(0)
                )
        )
        .join('')

}


function normalizeJid(participant) {

    if (!participant)
        return null


    return (
        participant.phoneNumber ||
        participant.id ||
        null
    )

}


function getNumberFromJid(jid = '') {

    return String(jid)
        .split('@')[0]
        .replace(/\D/g, '')

}


function getFlag(jid) {

    try {

        /*
            @lid no siempre contiene un número
            telefónico real, así que ahí no
            intentamos resolver país.
        */

        if (
            !jid ||
            jid.endsWith('@lid')
        ) {

            return '🌐'

        }


        const number =
            getNumberFromJid(jid)


        if (!number)
            return '🌐'


        const parsed =
            phoneUtil.parse(
                `+${number}`
            )


        const regionCode =
            phoneUtil.getRegionCodeForNumber(
                parsed
            )


        return isoToFlag(
            regionCode
        )


    } catch {

        return '🌐'

    }

}


function getDisplayUser(jid) {

    if (!jid)
        return '@desconocido'


    if (
        jid.endsWith('@lid')
    ) {

        return `@${jid.split('@')[0]}`

    }


    const number =
        getNumberFromJid(jid)


    return number
        ? `@${number}`
        : '@desconocido'

}


function uniqueJids(jids = []) {

    return [
        ...new Set(
            jids.filter(Boolean)
        )
    ]

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

    adminOnly:
        true,

    groupOnly:
        true,

    cooldown:
        5,


    async execute({

        sock,
        from,
        msg

    }) {

        try {

            /* ─────────────────────────────
               SOLO GRUPOS
            ───────────────────────────── */

            if (
                !from ||
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


            /* ─────────────────────────────
               PRESENCIA
            ───────────────────────────── */

            try {

                await sock.sendPresenceUpdate(
                    'composing',
                    from
                )

            } catch {}


            /* ─────────────────────────────
               USUARIO
            ───────────────────────────── */

            const sender =

                msg.key.participant ||

                msg.participant ||

                msg.key.remoteJid


            if (!sender) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE USUARIO',

                                'No se pudo identificar al usuario que ejecutó el comando.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               VERIFICAR ADMIN
            ───────────────────────────── */

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


            /* ─────────────────────────────
               METADATA
            ───────────────────────────── */

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


            const groupName =
                metadata?.subject ||
                'Grupo sin nombre'


            if (
                participants.length === 0
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'GRUPO VACÍO',

                                'No se encontraron participantes en el grupo.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               PARTICIPANTES VÁLIDOS
            ───────────────────────────── */

            const validParticipants =

                participants

                    .map(participant => {

                        const jid =
                            normalizeJid(
                                participant
                            )


                        return {
                            ...participant,
                            jid
                        }

                    })

                    .filter(
                        participant =>
                            Boolean(
                                participant.jid
                            )
                    )


            const limitedParticipants =
                validParticipants.slice(
                    0,
                    MAX_MENTIONS
                )


            const admins =

                limitedParticipants.filter(
                    participant =>
                        participant.admin === 'admin' ||
                        participant.admin === 'superadmin'
                )


            const members =

                limitedParticipants.filter(
                    participant =>
                        !participant.admin
                )


            const mentions =
                uniqueJids(

                    limitedParticipants.map(
                        participant =>
                            participant.jid
                    )

                )


            /* ─────────────────────────────
               LISTA DE ADMINS
            ───────────────────────────── */

            const adminList =

                admins.length

                    ? admins.map(
                        participant => {

                            const jid =
                                participant.jid


                            return (
                                `𖣣ֶㅤ֯⌗ 👑 ${getFlag(jid)}  ׄ ⬭ ${getDisplayUser(jid)}`
                            )

                        }
                    ).join('\n')

                    : '╰─ 𓂃 Sin administradores'


            /* ─────────────────────────────
               LISTA DE MIEMBROS
            ───────────────────────────── */

            const memberList =

                members.length

                    ? members.map(
                        participant => {

                            const jid =
                                participant.jid


                            return (
                                `𖣣ֶㅤ֯⌗ 👤 ${getFlag(jid)}  ׄ ⬭ ${getDisplayUser(jid)}`
                            )

                        }
                    ).join('\n')

                    : '╰─ 𓂃 Sin miembros'


            /* ─────────────────────────────
               TEXTO FINAL
            ───────────────────────────── */

            const text = [

                'ㅤ۟∩　ׅ　📢　ׅ　*TAG ALL*　ׄᰙ',

                '',

                `𖣣ֶㅤ֯⌗ 🏷️  ׄ ⬭ *Grupo:* ${groupName}`,

                `𖣣ֶㅤ֯⌗ 👥  ׄ ⬭ *Miembros:* ${participants.length}`,

                `𖣣ֶㅤ֯⌗ 👑  ׄ ⬭ *Admins:* ${admins.length}`,

                '',

                'ㅤ۟∩　ׅ　👑　ׅ　*ADMINISTRADORES*',
                '',
                adminList,

                '',

                'ㅤ۟∩　ׅ　👥　ׅ　*MIEMBROS*',
                '',
                memberList,

                participants.length > MAX_MENTIONS
                    ? `\n╰─ 𓂃 ⚠️ Solo se mencionaron los primeros ${MAX_MENTIONS} usuarios.`
                    : '',

                '',
                `╰─ 𓂃 Ejecutado por ${getDisplayUser(sender)}`

            ]
                .filter(Boolean)
                .join('\n')


            /* ─────────────────────────────
               ENVIAR
            ───────────────────────────── */

            await sock.safeSendMessage(

                from,

                {

                    text,

                    mentions:
                        mentions

                }

            )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Tagall usado en ${from.split('@')[0]} por ${sender.split('@')[0]} | ${mentions.length} menciones`

            )


        } catch (err) {

            logger.error(

                `Error tagall: ${err.stack || err.message}`

            )


            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR TAGALL',

                                'No se pudo mencionar a los miembros del grupo.'

                            )

                    }

                )

            } catch {}

        }

    }

}
const isGroupAdmin =
    require('../../src/utils/isAdmin')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const {
    PhoneNumberUtil,
    PhoneNumberFormat
} = require('google-libphonenumber')


const phoneUtil =
    PhoneNumberUtil.getInstance()


const MAX_MENTIONS =
    1000


const SECTION_DIVIDER =
    '━━━━━━━━━━━━━━━━━━━━━━━━━━'


/* ─────────────────────────────
   BANDERA DESDE ISO
───────────────────────────── */

function isoToFlag(
    iso
) {

    if (
        !iso ||
        iso.length !== 2
    ) {

        return '🌐'

    }


    return [
        ...iso.toUpperCase()
    ]
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


/* ─────────────────────────────
   NORMALIZAR JID
───────────────────────────── */

function cleanJid(
    jid
) {

    if (!jid) {

        return null

    }


    return String(jid)
        .replace(
            /:\d+@/,
            '@'
        )

}


/* ─────────────────────────────
   OBTENER JIDS DE PARTICIPANTE
───────────────────────────── */

function getParticipantJids(
    participant
) {

    if (!participant) {

        return []

    }


    return [

        participant.phoneNumber,

        participant.id,

        participant.lid

    ]
        .filter(Boolean)
        .map(
            cleanJid
        )

}


/* ─────────────────────────────
   MEJOR JID PARA MOSTRAR
───────────────────────────── */

function getBestJid(
    participant
) {

    if (!participant) {

        return null

    }


    /*
        Prioridad:

        1. phoneNumber
        2. id normal
        3. lid
        4. id
    */


    if (
        participant.phoneNumber
    ) {

        return cleanJid(
            participant.phoneNumber
        )

    }


    if (
        participant.id &&
        !String(
            participant.id
        ).endsWith('@lid')
    ) {

        return cleanJid(
            participant.id
        )

    }


    if (
        participant.lid
    ) {

        return cleanJid(
            participant.lid
        )

    }


    if (
        participant.id
    ) {

        return cleanJid(
            participant.id
        )

    }


    return null

}


/* ─────────────────────────────
   NÚMERO DESDE JID
───────────────────────────── */

function getNumberFromJid(
    jid = ''
) {

    return String(jid)
        .split('@')[0]
        .split(':')[0]
        .replace(
            /\D/g,
            ''
        )

}


/* ─────────────────────────────
   DETECTAR LID
───────────────────────────── */

function isLid(
    jid
) {

    return String(
        jid || ''
    )
        .endsWith(
            '@lid'
        )

}


/* ─────────────────────────────
   NORMALIZAR NÚMERO TELEFÓNICO
───────────────────────────── */

function normalizePhoneNumber(
    jid
) {

    let number =
        getNumberFromJid(
            jid
        )


    if (!number) {

        return ''

    }


    /*
        Algunos JIDs antiguos mexicanos
        todavía pueden aparecer como:

        5216681234567

        Se convierte para mostrar:

        +52 668 123 4567
    */

    if (
        number.startsWith('521') &&
        number.length === 13
    ) {

        number =
            '52' +
            number.slice(3)

    }


    return number

}


/* ─────────────────────────────
   FORMATO INTERNACIONAL
───────────────────────────── */

function formatPhoneNumber(
    jid
) {

    if (!jid) {

        return 'Desconocido'

    }


    if (
        isLid(
            jid
        )
    ) {

        return `@${getNumberFromJid(jid)}`

    }


    const number =
        normalizePhoneNumber(
            jid
        )


    if (!number) {

        return 'Desconocido'

    }


    try {

        const parsed =
            phoneUtil.parse(
                `+${number}`
            )


        if (
            phoneUtil.isPossibleNumber(
                parsed
            )
        ) {

            return phoneUtil.format(

                parsed,

                PhoneNumberFormat.INTERNATIONAL

            )

        }

    } catch {}


    return `+${number}`

}


/* ─────────────────────────────
   BANDERA DEL NÚMERO
───────────────────────────── */

function getFlag(
    jid
) {

    try {

        if (
            !jid ||
            isLid(jid)
        ) {

            return '🌐'

        }


        const number =
            normalizePhoneNumber(
                jid
            )


        if (!number) {

            return '🌐'

        }


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


/* ─────────────────────────────
   BUSCAR PARTICIPANTE
───────────────────────────── */

function findParticipantByJid(
    participants,
    jid
) {

    const target =
        cleanJid(
            jid
        )


    if (!target) {

        return null

    }


    /*
        Coincidencia directa entre:

        id
        phoneNumber
        lid
    */

    const exact =
        participants.find(

            participant => {

                const candidates =
                    getParticipantJids(
                        participant
                    )


                return candidates.includes(
                    target
                )

            }

        )


    if (
        exact
    ) {

        return exact

    }


    /*
        Si tenemos un número telefónico,
        hacemos una comparación secundaria
        por número.

        No hacemos esto con un LID.
    */

    if (
        !isLid(
            target
        )
    ) {

        const targetNumber =
            getNumberFromJid(
                target
            )


        return participants.find(

            participant => {

                const candidates =
                    getParticipantJids(
                        participant
                    )


                return candidates.some(

                    candidate => {

                        if (
                            isLid(
                                candidate
                            )
                        ) {

                            return false

                        }


                        return (
                            getNumberFromJid(
                                candidate
                            ) ===
                            targetNumber
                        )

                    }

                )

            }

        ) || null

    }


    return null

}


/* ─────────────────────────────
   DISPLAY DE PARTICIPANTE
───────────────────────────── */

function getParticipantDisplay(
    participant
) {

    const jid =
        getBestJid(
            participant
        )


    if (!jid) {

        return '@desconocido'

    }


    /*
        Si solo tenemos un LID,
        no fingimos que sea teléfono.
    */

    if (
        isLid(
            jid
        )
    ) {

        return `@${getNumberFromJid(jid)}`

    }


    /*
        IMPORTANTE:

        Dejamos la mención real @numero
        para que WhatsApp pueda resolver
        el nombre/contacto.

        Después mostramos el teléfono
        correctamente separado.
    */

    const mentionNumber =
        getNumberFromJid(
            jid
        )


    const formattedNumber =
        formatPhoneNumber(
            jid
        )


    return (
        `@${mentionNumber}  ·  ${formattedNumber}`
    )

}


/* ─────────────────────────────
   JIDS ÚNICOS
───────────────────────────── */

function uniqueJids(
    jids = []
) {

    return [

        ...new Set(

            jids
                .filter(Boolean)
                .map(
                    cleanJid
                )

        )

    ]

}


/* ─────────────────────────────
   COMANDO
───────────────────────────── */

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
               USUARIO QUE EJECUTÓ
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
               RESOLVER EJECUTOR
            ───────────────────────────── */

            const senderParticipant =
                findParticipantByJid(

                    participants,

                    sender

                )


            const senderDisplayJid =

                senderParticipant?.phoneNumber ||

                (
                    senderParticipant
                        ? getBestJid(
                            senderParticipant
                        )
                        : null
                ) ||

                cleanJid(
                    sender
                )


            const senderPushName =
                String(
                    msg.pushName || ''
                )
                    .trim()


            const senderFormattedNumber =
                formatPhoneNumber(
                    senderDisplayJid
                )


            const senderDisplay =

                senderPushName

                    ? `${senderPushName} (${senderFormattedNumber})`

                    : senderFormattedNumber


            /* ─────────────────────────────
               PARTICIPANTES VÁLIDOS
            ───────────────────────────── */

            const validParticipants =

                participants

                    .map(

                        participant => {

                            const jid =
                                getBestJid(
                                    participant
                                )


                            return {

                                ...participant,

                                jid

                            }

                        }

                    )

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


            /* ─────────────────────────────
               ADMINISTRADORES
            ───────────────────────────── */

            const admins =
                limitedParticipants.filter(

                    participant =>

                        participant.admin === 'admin' ||

                        participant.admin === 'superadmin'

                )


            /* ─────────────────────────────
               MIEMBROS
            ───────────────────────────── */

            const members =
                limitedParticipants.filter(

                    participant =>
                        !participant.admin

                )


            /* ─────────────────────────────
               MENCIONES
            ───────────────────────────── */

            const participantMentions =
                limitedParticipants
                    .map(
                        participant =>
                            participant.jid
                    )
                    .filter(Boolean)


            const mentions =
                uniqueJids([

                    ...participantMentions,

                    senderDisplayJid

                ])
                    .slice(
                        0,
                        MAX_MENTIONS
                    )


            /* ─────────────────────────────
               LISTA ADMINISTRADORES
            ───────────────────────────── */

            const adminList =
                admins.length

                    ? admins
                        .map(

                            participant => {

                                const jid =
                                    participant.jid


                                return (

                                    `𖣣ֶㅤ֯⌗ 👑 ${getFlag(jid)}  ׄ ⬭ ${getParticipantDisplay(participant)}`

                                )

                            }

                        )
                        .join('\n')

                    : '╰─ 𓂃 Sin administradores'


            /* ─────────────────────────────
               LISTA MIEMBROS
            ───────────────────────────── */

            const memberList =
                members.length

                    ? members
                        .map(

                            participant => {

                                const jid =
                                    participant.jid


                                return (

                                    `𖣣ֶㅤ֯⌗ 👤 ${getFlag(jid)}  ׄ ⬭ ${getParticipantDisplay(participant)}`

                                )

                            }

                        )
                        .join('\n')

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

                SECTION_DIVIDER,

                '',

                'ㅤ۟∩　ׅ　👑　ׅ　*ADMINISTRADORES*',

                '',

                adminList,

                '',

                SECTION_DIVIDER,

                '',

                'ㅤ۟∩　ׅ　👥　ׅ　*MIEMBROS*',

                '',

                memberList,

                '',

                SECTION_DIVIDER,

                participants.length > MAX_MENTIONS

                    ? `╰─ 𓂃 ⚠️ Solo se mencionaron los primeros ${MAX_MENTIONS} usuarios.`

                    : '',

                '',

                `╰─ 𓂃 Ejecutado por ${senderDisplay}`

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

                    mentions

                }

            )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Tagall usado en ${from.split('@')[0]} por ${senderFormattedNumber} | ${mentions.length} menciones`

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
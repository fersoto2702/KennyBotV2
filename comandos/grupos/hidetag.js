const {
    generateForwardMessageContent,
    generateWAMessageFromContent
} = require('@whiskeysockets/baileys')

const isGroupAdmin =
    require('../../src/utils/isAdmin')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')


const MAX_MENTIONS =
    1000


function normalizeJid(
    participant
) {

    if (
        !participant
    ) {

        return null

    }

    const value =
        typeof participant ===
            'object'
            ? (
                participant.phoneNumber ||
                participant.id ||
                participant.lid ||
                null
            )
            : participant

    if (
        !value
    ) {

        return null

    }

    return String(
        value
    )
        .trim()
        .replace(
            /:\d+@/,
            '@'
        )

}


function uniqueJids(
    jids = []
) {

    return [
        ...new Set(
            jids.filter(
                Boolean
            )
        )
    ]

}


function getBotName(
    sock
) {

    return String(
        sock?.botProfile?.name ||
        'KennyBot'
    )
        .trim()

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


function getContextInfo(
    message
) {

    if (
        !message ||
        typeof message !==
            'object'
    ) {

        return null

    }

    const possibleMessages = [

        message.extendedTextMessage,
        message.imageMessage,
        message.videoMessage,
        message.audioMessage,
        message.documentMessage,
        message.stickerMessage,
        message.buttonsResponseMessage,
        message.listResponseMessage,
        message.templateButtonReplyMessage

    ]

    for (
        const item
        of possibleMessages
    ) {

        if (
            item?.contextInfo
        ) {

            return item.contextInfo

        }

    }

    return null

}


function findContentNode(
    content
) {

    if (
        !content ||
        typeof content !==
            'object'
    ) {

        return null

    }

    /*
     * Priorizamos tipos especiales de WhatsApp,
     * entre ellos todas las variantes de encuesta.
     */
    const preferredKeys = [

        'pollCreationMessageV3',
        'pollCreationMessageV2',
        'pollCreationMessage',
        'pollResultSnapshotMessage',
        'newsletterAdminInviteMessage',
        'groupInviteMessage',
        'interactiveMessage',
        'productMessage',
        'imageMessage',
        'videoMessage',
        'audioMessage',
        'documentMessage',
        'stickerMessage',
        'extendedTextMessage',
        'conversation'

    ]

    let key =
        preferredKeys.find(
            name =>
                content[name] != null
        )

    if (
        !key
    ) {

        key =
            Object.keys(
                content
            )
                .find(
                    name =>
                        name !==
                            'messageContextInfo' &&
                        content[name] != null
                )

    }

    if (
        !key
    ) {

        return null

    }

    return {
        key,
        value:
            content[key]
    }

}


function getQuotedType(
    quoted
) {

    if (
        !quoted ||
        typeof quoted !==
            'object'
    ) {

        return 'mensaje'

    }

    if (
        quoted.pollCreationMessageV3 ||
        quoted.pollCreationMessageV2 ||
        quoted.pollCreationMessage
    ) {

        return 'encuesta'

    }

    if (
        quoted.pollResultSnapshotMessage
    ) {

        return 'resultado de encuesta'

    }

    if (
        quoted.imageMessage
    ) {

        return 'imagen'

    }

    if (
        quoted.videoMessage
    ) {

        return 'video'

    }

    if (
        quoted.audioMessage
    ) {

        return 'audio'

    }

    if (
        quoted.stickerMessage
    ) {

        return 'sticker'

    }

    if (
        quoted.documentMessage
    ) {

        return 'documento'

    }

    if (
        quoted.newsletterAdminInviteMessage
    ) {

        return 'canal'
    }

    if (
        quoted.groupInviteMessage
    ) {

        return 'invitación de grupo'
    }

    if (
        quoted.interactiveMessage
    ) {

        return 'mensaje interactivo'
    }

    if (
        quoted.productMessage
    ) {

        return 'producto'
    }

    if (
        quoted.extendedTextMessage?.contextInfo
            ?.forwardedNewsletterMessageInfo
    ) {

        return 'publicación de canal'
    }

    if (
        quoted.extendedTextMessage?.canonicalUrl ||
        quoted.extendedTextMessage?.matchedText ||
        quoted.extendedTextMessage?.jpegThumbnail
    ) {

        return 'enlace con vista previa'
    }

    if (
        quoted.conversation ||
        quoted.extendedTextMessage
    ) {

        return 'texto'

    }

    return 'mensaje'

}


function getOriginalContentNode(
    quoted
) {

    if (
        !quoted ||
        typeof quoted !==
            'object'
    ) {

        return null

    }

    const preferredKeys = [

        'pollCreationMessageV3',
        'pollCreationMessageV2',
        'pollCreationMessage',
        'pollResultSnapshotMessage',
        'newsletterAdminInviteMessage',
        'groupInviteMessage',
        'interactiveMessage',
        'productMessage',
        'imageMessage',
        'videoMessage',
        'audioMessage',
        'documentMessage',
        'stickerMessage',
        'extendedTextMessage'

    ]

    const key =
        preferredKeys.find(
            name =>
                quoted[name] != null
        ) ||
        Object.keys(
            quoted
        )
            .find(
                name =>
                    quoted[name] != null
            )

    if (
        !key
    ) {

        return null

    }

    return {
        key,
        value:
            quoted[key]
    }

}


async function forwardWithHiddenMentions({

    sock,
    from,
    quoted,
    contextInfo,
    mentions

}) {

    const participant =
        normalizeJid(
            contextInfo?.participant
        )

    const quotedMessage = {

        key: {

            remoteJid:
                from,

            fromMe:
                false,

            id:
                contextInfo?.stanzaId ||
                `hidetag-${Date.now()}`,

            participant:
                participant ||
                undefined

        },

        message:
            quoted

    }


    const originalNode =
        getOriginalContentNode(
            quoted
        )


    const originalContextInfo =
        originalNode?.value &&
        typeof originalNode.value ===
            'object'
            ? (
                originalNode.value.contextInfo ||
                {}
            )
            : {}


    const forwardContent =
        await generateForwardMessageContent(
            quotedMessage,
            false
        )


    const node =
        findContentNode(
            forwardContent
        )


    if (
        !node
    ) {

        throw new Error(
            'No se pudo preparar el mensaje citado para reenviarlo.'
        )

    }


    if (
        node.value &&
        typeof node.value ===
            'object'
    ) {

        node.value.contextInfo = {

            ...originalContextInfo,

            ...(
                node.value.contextInfo ||
                {}
            ),

            mentionedJid:
                uniqueJids(
                    [
                        ...(
                            Array.isArray(
                                originalContextInfo?.mentionedJid
                            )
                                ? originalContextInfo.mentionedJid
                                : []
                        ),
                        ...mentions
                    ]
                )

        }

    }


    forwardContent.messageContextInfo = {

        ...(
            forwardContent.messageContextInfo ||
            {}
        ),

        mentionedJid:
            mentions

    }


    const generated =
        generateWAMessageFromContent(
            from,
            forwardContent,
            {

                userJid:
                    normalizeJid(
                        sock?.user?.id
                    ) ||
                    sock?.user?.id

            }
        )


    await sock.relayMessage(
        from,
        generated.message,
        {
            messageId:
                generated.key.id
        }
    )


    return true

}


module.exports = {

    name:
        'hidetag',

    aliases: [
        'htag',
        'ghosttag',
        'tag'
    ],

    description:
        'Reenvía un mensaje mencionando a todos de forma oculta',

    category:
        'grupos',

    adminOnly:
        true,

    groupOnly:
        true,


    async execute({

        sock,
        from,
        args,
        msg

    }) {

        try {

            if (
                !from ||
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
                                'Este comando solo funciona en grupos.'
                            )
                    }
                )

            }


            try {

                await sock.sendPresenceUpdate(
                    'composing',
                    from
                )

            } catch {}


            const sender =
                normalizeJid(

                    msg?.key?.fromMe

                        ? (
                            sock?.user?.lid ||
                            sock?.user?.id
                        )

                        : (
                            msg?.key?.participant ||
                            msg?.participant ||
                            msg?.key?.remoteJid
                        )

                )


            if (
                !sender
            ) {

                return await sendMessage(
                    sock,
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


            const admin =
                await isGroupAdmin(
                    sock,
                    from,
                    sender
                )


            if (
                !admin
            ) {

                return await sendMessage(
                    sock,
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


            if (
                participants.length ===
                0
            ) {

                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.warn(
                                'GRUPO VACÍO',
                                'No hay participantes para mencionar.'
                            )
                    }
                )

            }


            const mentions =
                uniqueJids(

                    participants
                        .slice(
                            0,
                            MAX_MENTIONS
                        )
                        .map(
                            participant =>
                                normalizeJid(
                                    participant
                                )
                        )

                )


            if (
                mentions.length ===
                0
            ) {

                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.error(
                                'SIN MENCIONES',
                                'No se pudieron obtener identificadores válidos de los participantes.'
                            )
                    }
                )

            }


            const contextInfo =
                getContextInfo(
                    msg?.message
                )


            const quoted =
                contextInfo?.quotedMessage


            /*
             * Si responde a cualquier mensaje,
             * lo reenvía tal cual y agrega
             * las menciones ocultas.
             */
            if (
                quoted
            ) {

                const quotedType =
                    getQuotedType(
                        quoted
                    )


                await forwardWithHiddenMentions({

                    sock,
                    from,
                    quoted,
                    contextInfo,
                    mentions

                })


                logger.event(
                    `Hidetag reenviado en ${from.split('@')[0]} por ${sender.split('@')[0]} | ${mentions.length} menciones | ${quotedType}`
                )


                return true

            }


            /*
             * Si no responde a ningún mensaje,
             * usa el texto escrito después del comando.
             */
            const text =
                Array.isArray(
                    args
                )
                    ? args
                        .join(
                            ' '
                        )
                        .trim()
                    : ''


            if (
                !text
            ) {

                return await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.warn(
                                'MENSAJE REQUERIDO',
                                [
                                    'Escribe un mensaje o responde al mensaje que quieras reenviar.',
                                    '',
                                    'Ejemplos:',
                                    '/hidetag Aviso importante',
                                    '/hidetag respondiendo a una imagen, video, audio, sticker o mensaje'
                                ]
                                    .join(
                                        '\n'
                                    )
                            )
                    }
                )

            }


            await sendMessage(
                sock,
                from,
                {
                    text,
                    mentions
                }
            )


            logger.event(
                `Hidetag usado en ${from.split('@')[0]} por ${sender.split('@')[0]} | ${mentions.length} menciones | texto`
            )


            return true


        } catch (err) {

            logger.error(
                `${getBotName(sock)} | Error hidetag: ${err.stack || err.message}`
            )


            try {

                await sendMessage(
                    sock,
                    from,
                    {
                        text:
                            ui.error(
                                'ERROR HIDETAG',
                                'No se pudo reenviar el mensaje con menciones ocultas.'
                            )
                    }
                )

            } catch {}


            return false

        }

    }

}
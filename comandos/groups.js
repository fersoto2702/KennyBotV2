const logger =
    require('../src/utils/logger')

const ui =
    require('../src/utils/ui')


function safeText(
    value,
    fallback = 'Grupo sin nombre'
) {

    const text =
        String(
            value ?? ''
        )
            .trim()


    return text ||
        fallback

}


module.exports = {

    name:
        'groups',

    aliases: [
        'grupos'
    ],

    description:
        'Muestra los grupos donde está KennyBot',

    category:
        'owner',

    ownerOnly:
        true,

    cooldown:
        5,


    async execute({

        sock,
        from

    }) {

        try {

            /* ─────────────────────────────
               OBTENER GRUPOS
            ───────────────────────────── */

            const result =
                await sock.groupFetchAllParticipating()


            const groups =
                result &&
                typeof result === 'object'
                    ? result
                    : {}


            const entries =
                Object.entries(
                    groups
                )
                    .filter(

                        ([jid, group]) =>

                            typeof jid === 'string' &&

                            jid.endsWith('@g.us') &&

                            group &&
                            typeof group === 'object'

                    )


            /* ─────────────────────────────
               SIN GRUPOS
            ───────────────────────────── */

            if (
                entries.length === 0
            ) {

                return await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.info(

                                'GRUPOS DE KENNYBOT',

                                [],

                                'KennyBot no encontró grupos.'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               ORDENAR
            ───────────────────────────── */

            entries.sort(

                (a, b) => {

                    const nameA =
                        safeText(
                            a[1]?.subject
                        )

                    const nameB =
                        safeText(
                            b[1]?.subject
                        )


                    return nameA.localeCompare(

                        nameB,

                        'es',

                        {
                            sensitivity:
                                'base'
                        }

                    )

                }

            )


            /* ─────────────────────────────
               LISTA
            ───────────────────────────── */

            const rows =
                entries
                    .map(

                        (
                            [jid, group],
                            index
                        ) => {

                            const groupName =
                                safeText(
                                    group?.subject
                                )


                            const participants =
                                Array.isArray(
                                    group?.participants
                                )
                                    ? group.participants.length
                                    : null


                            const participantText =
                                participants !== null
                                    ? ` · ${participants} miembros`
                                    : ''


                            return [

                                `𖣣ֶㅤ֯⌗ 👥  ׄ ⬭ *#${index + 1} ${groupName}*`,

                                `╰─ 𓂃 ${jid}${participantText}`

                            ]
                                .join('\n')

                        }

                    )
                    .join('\n\n')


            /* ─────────────────────────────
               RESPUESTA
            ───────────────────────────── */

            const text = [

                'ㅤ۟∩　ׅ　👥　ׅ　*GRUPOS DE KENNYBOT*　ׄᰙ',

                '',

                `𖣣ֶㅤ֯⌗ 📊  ׄ ⬭ *Total:* ${entries.length}`,

                '',

                rows,

                '',

                '╰─ 𓂃 Lista exclusiva del owner'

            ]
                .filter(Boolean)
                .join('\n')


            await sock.safeSendMessage(

                from,

                {
                    text
                }

            )


            /* ─────────────────────────────
               LOG
            ───────────────────────────── */

            logger.event(

                `Groups consultados | total=${entries.length}`

            )


        } catch (err) {

            logger.error(

                `Error groups: ${err.stack || err.message}`

            )


            try {

                await sock.safeSendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE GRUPOS',

                                'No se pudo obtener la lista de grupos de KennyBot.'

                            )

                    }

                )

            } catch {}

        }

    }

}
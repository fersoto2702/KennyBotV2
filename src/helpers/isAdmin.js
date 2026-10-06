const logger =
    require('../utils/logger')


const cache =
    new Map()


const CACHE_TIME =
    10 * 1000


/* ─────────────────────────────
   NORMALIZAR JID
───────────────────────────── */

function normalizeJid(
    jid
) {

    if (!jid) {

        return null

    }


    return String(jid)
        .trim()
        .replace(
            /:\d+@/,
            '@'
        )

}


/* ─────────────────────────────
   ¿ES LID?
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
   NÚMERO DEL JID
───────────────────────────── */

function getNumber(
    jid
) {

    return String(
        jid || ''
    )
        .split('@')[0]
        .split(':')[0]
        .replace(
            /\D/g,
            ''
        )

}


/* ─────────────────────────────
   JIDS DEL PARTICIPANTE
───────────────────────────── */

function getParticipantJids(
    participant
) {

    if (!participant) {

        return []

    }


    return [

        participant.id,

        participant.phoneNumber,

        participant.lid

    ]
        .filter(Boolean)
        .map(
            normalizeJid
        )

}


/* ─────────────────────────────
   BUSCAR PARTICIPANTE
───────────────────────────── */

function findParticipant(
    participants,
    jid
) {

    const target =
        normalizeJid(
            jid
        )


    if (!target) {

        return null

    }


    /*
        PRIMER INTENTO:
        coincidencia exacta entre:

        - id
        - phoneNumber
        - lid
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
        SEGUNDO INTENTO:

        Comparación por número únicamente
        cuando target NO sea @lid.

        Un LID no debe tratarse como
        número telefónico.
    */

    if (
        !isLid(
            target
        )
    ) {

        const targetNumber =
            getNumber(
                target
            )


        if (
            !targetNumber
        ) {

            return null

        }


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
                            getNumber(
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
   VALIDAR ADMIN
───────────────────────────── */

function participantIsAdmin(
    participant
) {

    return (

        participant?.admin ===
        'admin'

        ||

        participant?.admin ===
        'superadmin'

    )

}


/* ─────────────────────────────
   OBTENER METADATA
───────────────────────────── */

async function getParticipants(
    sock,
    from,
    forceRefresh = false
) {

    const now =
        Date.now()


    const cached =
        cache.get(
            from
        )


    if (
        !forceRefresh &&
        cached &&
        now < cached.expire
    ) {

        return {
            participants:
                cached.participants,

            cached:
                true
        }

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


    cache.set(

        from,

        {

            participants,

            expire:
                now +
                CACHE_TIME

        }

    )


    return {

        participants,

        cached:
            false

    }

}


/* ─────────────────────────────
   IS GROUP ADMIN
───────────────────────────── */

async function isGroupAdmin(
    sock,
    from,
    sender
) {

    try {

        if (
            !sock ||
            !from ||
            !sender
        ) {

            return false

        }


        /* ─────────────────────────────
           PRIMERA CONSULTA
        ───────────────────────────── */

        let {
            participants,
            cached
        } =
            await getParticipants(

                sock,

                from

            )


        let member =
            findParticipant(

                participants,

                sender

            )


        if (
            participantIsAdmin(
                member
            )
        ) {

            return true

        }


        /*
            IMPORTANTE:

            Si usamos datos cacheados y el usuario
            aparece como miembro/no encontrado,
            hacemos UNA consulta fresca.

            Esto evita el problema:

            miembro → promote → /comando

            y que durante varios segundos siga
            apareciendo como si no fuera admin.
        */

        if (
            cached
        ) {

            const fresh =
                await getParticipants(

                    sock,

                    from,

                    true

                )


            participants =
                fresh.participants


            member =
                findParticipant(

                    participants,

                    sender

                )

        }


        return participantIsAdmin(
            member
        )


    } catch (err) {

        logger.error(

            `Error isAdmin: ${err.stack || err.message}`

        )


        return false

    }

}


/* ─────────────────────────────
   LIMPIAR CACHE DE UN GRUPO
───────────────────────────── */

isGroupAdmin.clearCache =
    function clearCache(
        from
    ) {

        if (
            from
        ) {

            cache.delete(
                from
            )

        }

    }


/* ─────────────────────────────
   LIMPIAR TODA LA CACHE
───────────────────────────── */

isGroupAdmin.clearAllCache =
    function clearAllCache() {

        cache.clear()

    }


module.exports =
    isGroupAdmin
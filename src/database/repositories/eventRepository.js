const {
    pool
} = require('../mysql')


const MEMBER_EVENT_STATUSES =
    new Set([
        'REGISTERED',
        'PARTICIPATING',
        'COMPLETED',
        'WITHDRAWN',
        'DISQUALIFIED'
    ])


const MEMBER_EVENT_RESULTS =
    new Set([
        'NONE',
        'PARTICIPANT',
        'WINNER'
    ])


function validatePositiveInteger(
    value,
    name
) {

    const number =
        Number(
            value
        )


    if (
        !Number.isInteger(number) ||
        number <= 0
    ) {

        throw new Error(
            `${name} inválido: ${value}`
        )

    }


    return number

}


function normalizeEventCode(
    code
) {

    const value =
        String(
            code || ''
        )
            .trim()
            .toUpperCase()


    if (!value) {

        throw new Error(
            'EVENT_CODE_REQUIRED'
        )

    }


    return value

}


function normalizeNullableInteger(
    value,
    name
) {

    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {

        return null

    }


    return validatePositiveInteger(
        value,
        name
    )

}


function normalizeNullableNumber(
    value,
    name
) {

    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {

        return null

    }


    const number =
        Number(
            value
        )


    if (
        !Number.isFinite(number)
    ) {

        throw new Error(
            `${name} inválido: ${value}`
        )

    }


    return number

}


async function getEventById(
    eventId,
    conn = pool
) {

    const id =
        validatePositiveInteger(
            eventId,
            'eventId'
        )


    const [
        rows
    ] =
        await conn.execute(

            `
            SELECT
                *
            FROM kb_events
            WHERE id = ?
              AND enabled = 1
            LIMIT 1
            `,

            [
                id
            ]

        )


    return (
        rows?.[0] ||
        null
    )

}


async function getEventByCode(
    code,
    conn = pool
) {

    const eventCode =
        normalizeEventCode(
            code
        )


    const [
        rows
    ] =
        await conn.execute(

            `
            SELECT
                *
            FROM kb_events
            WHERE code = ?
              AND enabled = 1
            LIMIT 1
            `,

            [
                eventCode
            ]

        )


    return (
        rows?.[0] ||
        null
    )

}


async function getActiveEvents(
    conn = pool
) {

    const [
        rows
    ] =
        await conn.execute(

            `
            SELECT
                *
            FROM kb_events
            WHERE enabled = 1
              AND status = 'ACTIVE'
              AND starts_at <= NOW()
              AND ends_at > NOW()
            ORDER BY
                starts_at ASC,
                id ASC
            `

        )


    return Array.isArray(rows)
        ? rows
        : []

}


async function getAvailableEvents(
    conn = pool
) {

    const [
        rows
    ] =
        await conn.execute(

            `
            SELECT
                *
            FROM kb_events
            WHERE enabled = 1
              AND status IN (
                    'UPCOMING',
                    'ACTIVE'
                  )
              AND ends_at > NOW()
            ORDER BY
                starts_at ASC,
                id ASC
            `

        )


    return Array.isArray(rows)
        ? rows
        : []

}


async function getMemberEvent(
    memberId,
    eventId,
    conn = pool
) {

    const member =
        validatePositiveInteger(
            memberId,
            'memberId'
        )


    const event =
        validatePositiveInteger(
            eventId,
            'eventId'
        )


    const [
        rows
    ] =
        await conn.execute(

            `
            SELECT
                *
            FROM kb_member_events
            WHERE member_id = ?
              AND event_id = ?
              AND enabled = 1
            LIMIT 1
            `,

            [
                member,
                event
            ]

        )


    return (
        rows?.[0] ||
        null
    )

}


async function getMemberEvents(
    memberId,
    conn = pool
) {

    const member =
        validatePositiveInteger(
            memberId,
            'memberId'
        )


    const [
        rows
    ] =
        await conn.execute(

            `
            SELECT
                me.*,

                e.code AS event_code,
                e.name AS event_name,
                e.description AS event_description,
                e.event_type,
                e.starts_at AS event_starts_at,
                e.ends_at AS event_ends_at,
                e.status AS event_status

            FROM kb_member_events me

            INNER JOIN kb_events e
                ON e.id = me.event_id

            WHERE me.member_id = ?
              AND me.enabled = 1
              AND e.enabled = 1

            ORDER BY
                e.starts_at DESC,
                me.id DESC
            `,

            [
                member
            ]

        )


    return Array.isArray(rows)
        ? rows
        : []

}


async function registerMemberForEvent(
    memberId,
    eventId,
    conn = pool
) {

    const member =
        validatePositiveInteger(
            memberId,
            'memberId'
        )


    const event =
        validatePositiveInteger(
            eventId,
            'eventId'
        )


    await conn.execute(

        `
        INSERT INTO kb_member_events (
            member_id,
            event_id,
            status,
            result,
            final_position,
            event_score,
            started_at,
            completed_at,
            enabled
        )
        VALUES (
            ?,
            ?,
            'REGISTERED',
            'NONE',
            NULL,
            NULL,
            NULL,
            NULL,
            1
        )

        ON DUPLICATE KEY UPDATE

            status =
                CASE
                    WHEN enabled = 0
                    THEN 'REGISTERED'
                    ELSE status
                END,

            result =
                CASE
                    WHEN enabled = 0
                    THEN 'NONE'
                    ELSE result
                END,

            final_position =
                CASE
                    WHEN enabled = 0
                    THEN NULL
                    ELSE final_position
                END,

            event_score =
                CASE
                    WHEN enabled = 0
                    THEN NULL
                    ELSE event_score
                END,

            started_at =
                CASE
                    WHEN enabled = 0
                    THEN NULL
                    ELSE started_at
                END,

            completed_at =
                CASE
                    WHEN enabled = 0
                    THEN NULL
                    ELSE completed_at
                END,

            enabled = 1,

            updated_at =
                CURRENT_TIMESTAMP
        `,

        [
            member,
            event
        ]

    )


    return getMemberEvent(

        member,

        event,

        conn

    )

}


async function updateMemberEventStatus(
    memberId,
    eventId,
    status,
    conn = pool
) {

    const member =
        validatePositiveInteger(
            memberId,
            'memberId'
        )


    const event =
        validatePositiveInteger(
            eventId,
            'eventId'
        )


    const normalizedStatus =
        String(
            status || ''
        )
            .trim()
            .toUpperCase()


    if (
        !MEMBER_EVENT_STATUSES.has(
            normalizedStatus
        )
    ) {

        throw new Error(
            'INVALID_MEMBER_EVENT_STATUS'
        )

    }


    const startedAtExpression =
        normalizedStatus ===
        'PARTICIPATING'

            ? 'COALESCE(started_at, CURRENT_TIMESTAMP)'

            : 'started_at'


    const completedAtExpression =
        normalizedStatus ===
        'COMPLETED'

            ? 'COALESCE(completed_at, CURRENT_TIMESTAMP)'

            : 'completed_at'


    const [
        result
    ] =
        await conn.execute(

            `
            UPDATE kb_member_events
            SET
                status = ?,

                started_at =
                    ${startedAtExpression},

                completed_at =
                    ${completedAtExpression},

                updated_at =
                    CURRENT_TIMESTAMP

            WHERE member_id = ?
              AND event_id = ?
              AND enabled = 1
            `,

            [
                normalizedStatus,
                member,
                event
            ]

        )


    if (
        Number(
            result.affectedRows
        ) === 0
    ) {

        return null

    }


    return getMemberEvent(

        member,

        event,

        conn

    )

}


async function completeMemberEvent(
    memberId,
    eventId,
    options = {},
    conn = pool
) {

    const member =
        validatePositiveInteger(
            memberId,
            'memberId'
        )


    const event =
        validatePositiveInteger(
            eventId,
            'eventId'
        )


    const {
        result = 'PARTICIPANT',
        finalPosition = null,
        eventScore = null
    } = options


    const normalizedResult =
        String(
            result || ''
        )
            .trim()
            .toUpperCase()


    if (
        !MEMBER_EVENT_RESULTS.has(
            normalizedResult
        )
    ) {

        throw new Error(
            'INVALID_MEMBER_EVENT_RESULT'
        )

    }


    const normalizedFinalPosition =
        normalizeNullableInteger(
            finalPosition,
            'finalPosition'
        )


    const normalizedEventScore =
        normalizeNullableNumber(
            eventScore,
            'eventScore'
        )


    const [
        updateResult
    ] =
        await conn.execute(

            `
            UPDATE kb_member_events
            SET
                status =
                    'COMPLETED',

                result = ?,

                final_position = ?,

                event_score = ?,

                started_at =
                    COALESCE(
                        started_at,
                        CURRENT_TIMESTAMP
                    ),

                completed_at =
                    COALESCE(
                        completed_at,
                        CURRENT_TIMESTAMP
                    ),

                updated_at =
                    CURRENT_TIMESTAMP

            WHERE member_id = ?
              AND event_id = ?
              AND enabled = 1
            `,

            [
                normalizedResult,
                normalizedFinalPosition,
                normalizedEventScore,
                member,
                event
            ]

        )


    if (
        Number(
            updateResult.affectedRows
        ) === 0
    ) {

        return null

    }


    return getMemberEvent(

        member,

        event,

        conn

    )

}


module.exports = {

    getEventById,

    getEventByCode,

    getActiveEvents,

    getAvailableEvents,

    getMemberEvent,

    getMemberEvents,

    registerMemberForEvent,

    updateMemberEventStatus,

    completeMemberEvent

}
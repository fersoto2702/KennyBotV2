const {
    pool
} = require('../mysql')

async function getEventById(
    eventId,
    conn = pool
) {

    const [rows] =
        await conn.execute(
            `
            SELECT *
            FROM kb_events
            WHERE id = ?
              AND enabled = 1
            LIMIT 1
            `,
            [eventId]
        )

    return rows[0] || null
}

async function getEventByCode(
    code,
    conn = pool
) {

    const [rows] =
        await conn.execute(
            `
            SELECT *
            FROM kb_events
            WHERE code = ?
              AND enabled = 1
            LIMIT 1
            `,
            [code]
        )

    return rows[0] || null
}

async function getActiveEvents(
    conn = pool
) {

    const [rows] =
        await conn.execute(
            `
            SELECT *
            FROM kb_events
            WHERE enabled = 1
              AND status = 'ACTIVE'
              AND starts_at <= NOW()
              AND ends_at > NOW()
            ORDER BY starts_at ASC, id ASC
            `
        )

    return rows
}

async function getAvailableEvents(
    conn = pool
) {

    const [rows] =
        await conn.execute(
            `
            SELECT *
            FROM kb_events
            WHERE enabled = 1
              AND status IN (
                  'UPCOMING',
                  'ACTIVE'
              )
              AND ends_at > NOW()
            ORDER BY starts_at ASC, id ASC
            `
        )

    return rows
}

async function getMemberEvent(
    memberId,
    eventId,
    conn = pool
) {

    const [rows] =
        await conn.execute(
            `
            SELECT *
            FROM kb_member_events
            WHERE member_id = ?
              AND event_id = ?
              AND enabled = 1
            LIMIT 1
            `,
            [
                memberId,
                eventId
            ]
        )

    return rows[0] || null
}

async function getMemberEvents(
    memberId,
    conn = pool
) {

    const [rows] =
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
            [memberId]
        )

    return rows
}

async function registerMemberForEvent(
    memberId,
    eventId,
    conn = pool
) {

    await conn.execute(
        `
        INSERT INTO kb_member_events (
            member_id,
            event_id,
            status,
            result,
            enabled
        )
        VALUES (
            ?,
            ?,
            'REGISTERED',
            'NONE',
            1
        )
        ON DUPLICATE KEY UPDATE
            enabled = 1,
            updated_at = CURRENT_TIMESTAMP
        `,
        [
            memberId,
            eventId
        ]
    )

    return getMemberEvent(
        memberId,
        eventId,
        conn
    )
}

async function updateMemberEventStatus(
    memberId,
    eventId,
    status,
    conn = pool
) {

    const allowedStatuses =
        new Set([
            'REGISTERED',
            'PARTICIPATING',
            'COMPLETED',
            'WITHDRAWN',
            'DISQUALIFIED'
        ])

    if (!allowedStatuses.has(status)) {
        throw new Error(
            'INVALID_MEMBER_EVENT_STATUS'
        )
    }

    const startedAt =
        status === 'PARTICIPATING'
            ? 'COALESCE(started_at, CURRENT_TIMESTAMP)'
            : 'started_at'

    const completedAt =
        status === 'COMPLETED'
            ? 'COALESCE(completed_at, CURRENT_TIMESTAMP)'
            : 'completed_at'

    await conn.execute(
        `
        UPDATE kb_member_events
        SET
            status = ?,
            started_at = ${startedAt},
            completed_at = ${completedAt},
            updated_at = CURRENT_TIMESTAMP
        WHERE member_id = ?
          AND event_id = ?
          AND enabled = 1
        `,
        [
            status,
            memberId,
            eventId
        ]
    )

    return getMemberEvent(
        memberId,
        eventId,
        conn
    )
}

async function completeMemberEvent(
    memberId,
    eventId,
    options = {},
    conn = pool
) {

    const {
        result = 'PARTICIPANT',
        finalPosition = null,
        eventScore = null
    } = options

    const allowedResults =
        new Set([
            'NONE',
            'PARTICIPANT',
            'WINNER'
        ])

    if (!allowedResults.has(result)) {
        throw new Error(
            'INVALID_MEMBER_EVENT_RESULT'
        )
    }

    await conn.execute(
        `
        UPDATE kb_member_events
        SET
            status = 'COMPLETED',
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
            result,
            finalPosition,
            eventScore,
            memberId,
            eventId
        ]
    )

    return getMemberEvent(
        memberId,
        eventId,
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
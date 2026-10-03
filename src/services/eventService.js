const {
    pool
} = require('../database/mysql')

const {
    getEventById,
    getEventByCode,
    getMemberEvent,
    registerMemberForEvent,
    updateMemberEventStatus,
    completeMemberEvent
} = require(
    '../database/repositories/eventRepository'
)

const {
    syncMemberObjectivesByType
} = require(
    './objectiveProgressService'
)

async function syncEventStatuses(
    conn = pool
) {
    const [activated] =
        await conn.execute(
            `
            UPDATE kb_events
            SET
                status = 'ACTIVE',
                updated_at = CURRENT_TIMESTAMP
            WHERE enabled = 1
              AND status = 'UPCOMING'
              AND starts_at <= NOW()
              AND ends_at > NOW()
            `
        )

    const [finished] =
        await conn.execute(
            `
            UPDATE kb_events
            SET
                status = 'FINISHED',
                updated_at = CURRENT_TIMESTAMP
            WHERE enabled = 1
              AND status IN (
                  'UPCOMING',
                  'ACTIVE'
              )
              AND ends_at <= NOW()
            `
        )

    return {
        processed: true,
        activated:
            Number(
                activated.affectedRows || 0
            ),
        finished:
            Number(
                finished.affectedRows || 0
            )
    }
}

async function syncEventObjectives(
    memberId
) {
    const results = {}

    try {
        results.eventsParticipated =
            await syncMemberObjectivesByType(
                memberId,
                'EVENTS_PARTICIPATED'
            )
    } catch (err) {
        results.eventsParticipated = {
            processed: false,
            error: err.message
        }
    }

    try {
        results.eventsWon =
            await syncMemberObjectivesByType(
                memberId,
                'EVENTS_WON'
            )
    } catch (err) {
        results.eventsWon = {
            processed: false,
            error: err.message
        }
    }

    return results
}

async function joinEvent(
    memberId,
    eventIdentifier
) {
    const conn =
        await pool.getConnection()

    try {
        await conn.beginTransaction()

        let event = null

        if (
            Number.isInteger(
                Number(eventIdentifier)
            )
        ) {
            event =
                await getEventById(
                    Number(eventIdentifier),
                    conn
                )
        }

        if (!event) {
            event =
                await getEventByCode(
                    String(
                        eventIdentifier
                    ),
                    conn
                )
        }

        if (!event) {
            await conn.rollback()

            return {
                processed: false,
                reason:
                    'EVENT_NOT_FOUND'
            }
        }

        const [lockedRows] =
            await conn.execute(
                `
                SELECT *
                FROM kb_events
                WHERE id = ?
                  AND enabled = 1
                LIMIT 1
                FOR UPDATE
                `,
                [
                    event.id
                ]
            )

        event =
            lockedRows[0] || null

        if (!event) {
            await conn.rollback()

            return {
                processed: false,
                reason:
                    'EVENT_NOT_FOUND'
            }
        }

        if (
            event.status !==
                'UPCOMING' &&
            event.status !==
                'ACTIVE'
        ) {
            await conn.rollback()

            return {
                processed: false,
                reason:
                    'EVENT_NOT_AVAILABLE',
                status:
                    event.status
            }
        }

        const now =
            new Date()

        if (
            new Date(
                event.ends_at
            ) <= now
        ) {
            await conn.rollback()

            return {
                processed: false,
                reason:
                    'EVENT_FINISHED'
            }
        }

        const existing =
            await getMemberEvent(
                memberId,
                event.id,
                conn
            )

        if (existing) {
            await conn.commit()

            return {
                processed: true,
                alreadyRegistered: true,
                event,
                memberEvent:
                    existing
            }
        }

        const memberEvent =
            await registerMemberForEvent(
                memberId,
                event.id,
                conn
            )

        await conn.commit()

        return {
            processed: true,
            alreadyRegistered: false,
            event,
            memberEvent
        }
    } catch (err) {
        try {
            await conn.rollback()
        } catch {}

        throw err
    } finally {
        conn.release()
    }
}

async function startEventParticipation(
    memberId,
    eventId
) {
    const event =
        await getEventById(
            eventId
        )

    if (!event) {
        return {
            processed: false,
            reason:
                'EVENT_NOT_FOUND'
        }
    }

    if (
        event.status !==
        'ACTIVE'
    ) {
        return {
            processed: false,
            reason:
                'EVENT_NOT_ACTIVE'
        }
    }

    const memberEvent =
        await getMemberEvent(
            memberId,
            event.id
        )

    if (!memberEvent) {
        return {
            processed: false,
            reason:
                'MEMBER_NOT_REGISTERED'
        }
    }

    if (
        memberEvent.status ===
        'PARTICIPATING'
    ) {
        return {
            processed: true,
            alreadyParticipating: true,
            memberEvent
        }
    }

    if (
        memberEvent.status !==
        'REGISTERED'
    ) {
        return {
            processed: false,
            reason:
                'INVALID_PARTICIPATION_STATUS',
            status:
                memberEvent.status
        }
    }

    const updated =
        await updateMemberEventStatus(
            memberId,
            event.id,
            'PARTICIPATING'
        )

    return {
        processed: true,
        alreadyParticipating: false,
        memberEvent:
            updated
    }
}

async function finishEventParticipation(
    memberId,
    eventId,
    options = {}
) {
    const {
        result = 'PARTICIPANT',
        finalPosition = null,
        eventScore = null
    } = options

    const memberEvent =
        await getMemberEvent(
            memberId,
            eventId
        )

    if (!memberEvent) {
        return {
            processed: false,
            reason:
                'MEMBER_NOT_REGISTERED'
        }
    }

    if (
        memberEvent.status ===
        'COMPLETED'
    ) {
        const objectiveSync =
            await syncEventObjectives(
                memberId
            )

        return {
            processed: true,
            alreadyCompleted: true,
            memberEvent,
            objectiveSync
        }
    }

    if (
        memberEvent.status !==
            'REGISTERED' &&
        memberEvent.status !==
            'PARTICIPATING'
    ) {
        return {
            processed: false,
            reason:
                'INVALID_PARTICIPATION_STATUS',
            status:
                memberEvent.status
        }
    }

    const updated =
        await completeMemberEvent(
            memberId,
            eventId,
            {
                result,
                finalPosition,
                eventScore
            }
        )

    const objectiveSync =
        await syncEventObjectives(
            memberId
        )

    return {
        processed: true,
        alreadyCompleted: false,
        memberEvent:
            updated,
        objectiveSync
    }
}

module.exports = {
    syncEventStatuses,
    joinEvent,
    startEventParticipation,
    finishEventParticipation
}
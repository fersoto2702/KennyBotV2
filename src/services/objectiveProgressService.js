const {
    pool
} = require('../database/mysql')

const {
    getAvailableObjectivesByType,
    ensureMemberObjective,
    setObjectiveProgress
} = require(
    '../database/repositories/objectiveRepository'
)

const SUPPORTED_OBJECTIVE_TYPES =
    new Set([
        'MESSAGES',
        'ACTIVE_DAYS',
        'COMMANDS',
        'INTERACTIONS',
        'STREAK',
        'EVENTS_PARTICIPATED',
        'EVENTS_WON'
    ])

function toMysqlDateTime(date) {

    return date
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ')
}

function getStartOfDay(date = new Date()) {

    const result =
        new Date(date)

    result.setHours(
        0,
        0,
        0,
        0
    )

    return result
}

function getStartOfWeek(date = new Date()) {

    const result =
        getStartOfDay(date)

    const day =
        result.getDay()

    const offset =
        day === 0
            ? 6
            : day - 1

    result.setDate(
        result.getDate() -
        offset
    )

    return result
}

function addDays(date, days) {

    const result =
        new Date(date)

    result.setDate(
        result.getDate() +
        days
    )

    return result
}

async function getActiveSeason(
    conn = pool
) {

    const [rows] =
        await conn.execute(
            `
            SELECT *
            FROM kb_seasons
            WHERE status = 'ACTIVE'
              AND starts_at <= NOW()
              AND ends_at > NOW()
            ORDER BY
                starts_at DESC,
                id DESC
            LIMIT 1
            `
        )

    return rows[0] || null
}

async function resolveObjectivePeriod(
    objective,
    conn = pool
) {

    const now =
        new Date()

    if (
        objective.period_type ===
        'DAILY'
    ) {

        const start =
            getStartOfDay(now)

        const end =
            addDays(
                start,
                1
            )

        return {
            valid: true,
            periodStart:
                toMysqlDateTime(start),
            periodEnd:
                toMysqlDateTime(end)
        }
    }

    if (
        objective.period_type ===
        'WEEKLY'
    ) {

        const start =
            getStartOfWeek(now)

        const end =
            addDays(
                start,
                7
            )

        return {
            valid: true,
            periodStart:
                toMysqlDateTime(start),
            periodEnd:
                toMysqlDateTime(end)
        }
    }

    if (
        objective.period_type ===
        'PERMANENT'
    ) {

        const start =
            objective.starts_at
                ? new Date(
                    objective.starts_at
                )
                : new Date(
                    '2000-01-01T00:00:00'
                )

        return {
            valid: true,
            periodStart:
                toMysqlDateTime(start),
            periodEnd: null
        }
    }

    if (
        objective.period_type ===
        'SEASON'
    ) {

        let season = null

        if (objective.season_id) {

            const [rows] =
                await conn.execute(
                    `
                    SELECT *
                    FROM kb_seasons
                    WHERE id = ?
                      AND status = 'ACTIVE'
                      AND starts_at <= NOW()
                      AND ends_at > NOW()
                    LIMIT 1
                    `,
                    [
                        objective.season_id
                    ]
                )

            season =
                rows[0] || null

        } else {

            season =
                await getActiveSeason(
                    conn
                )
        }

        if (!season) {

            return {
                valid: false,
                reason:
                    'NO_ACTIVE_SEASON'
            }
        }

        return {
            valid: true,
            periodStart:
                toMysqlDateTime(
                    new Date(
                        season.starts_at
                    )
                ),
            periodEnd:
                toMysqlDateTime(
                    new Date(
                        season.ends_at
                    )
                ),
            season
        }
    }

    if (
        objective.period_type ===
        'EVENT'
    ) {

        if (!objective.event_id) {

            return {
                valid: false,
                reason:
                    'OBJECTIVE_EVENT_MISSING'
            }
        }

        const [rows] =
            await conn.execute(
                `
                SELECT *
                FROM kb_events
                WHERE id = ?
                  AND enabled = 1
                  AND status = 'ACTIVE'
                  AND starts_at <= NOW()
                  AND ends_at > NOW()
                LIMIT 1
                `,
                [
                    objective.event_id
                ]
            )

        const event =
            rows[0] || null

        if (!event) {

            return {
                valid: false,
                reason:
                    'EVENT_NOT_ACTIVE'
            }
        }

        return {
            valid: true,
            periodStart:
                toMysqlDateTime(
                    new Date(
                        event.starts_at
                    )
                ),
            periodEnd:
                toMysqlDateTime(
                    new Date(
                        event.ends_at
                    )
                ),
            event
        }
    }

    return {
        valid: false,
        reason:
            'UNSUPPORTED_PERIOD_TYPE'
    }
}

async function getMemberObjectiveValue(
    memberId,
    objective,
    period,
    conn = pool
) {

    const start =
        period.periodStart

    const end =
        period.periodEnd

    if (
        objective.objective_type ===
        'MESSAGES'
    ) {

        const [rows] =
            await conn.execute(
                `
                SELECT
                    COALESCE(
                        SUM(valid_messages),
                        0
                    ) AS value
                FROM kb_activity_daily
                WHERE member_id = ?
                  AND activity_date >= DATE(?)
                  AND (
                      ? IS NULL
                      OR activity_date < DATE(?)
                  )
                `,
                [
                    memberId,
                    start,
                    end,
                    end
                ]
            )

        return Number(
            rows[0]?.value || 0
        )
    }

    if (
        objective.objective_type ===
        'ACTIVE_DAYS'
    ) {

        const [rows] =
            await conn.execute(
                `
                SELECT
                    COUNT(*) AS value
                FROM kb_activity_daily
                WHERE member_id = ?
                  AND valid_messages > 0
                  OR command_used > 0
                  OR interactions > 0

                  AND activity_date >= DATE(?)
                  AND (
                      ? IS NULL
                      OR activity_date < DATE(?)
                  )
                `,
                [
                    memberId,
                    start,
                    end,
                    end
                ]
            )

        return Number(
            rows[0]?.value || 0
        )
    }

    if (
        objective.objective_type ===
        'COMMANDS'
    ) {

        const [rows] =
            await conn.execute(
                `
                SELECT
                    COALESCE(
                        SUM(command_used),
                        0
                    ) AS value
                FROM kb_activity_daily
                WHERE member_id = ?
                  AND activity_date >= DATE(?)
                  AND (
                      ? IS NULL
                      OR activity_date < DATE(?)
                  )
                `,
                [
                    memberId,
                    start,
                    end,
                    end
                ]
            )

        return Number(
            rows[0]?.value || 0
        )
    }

    if (
        objective.objective_type ===
        'INTERACTIONS'
    ) {

        const [rows] =
            await conn.execute(
                `
                SELECT
                    COALESCE(
                        SUM(interactions),
                        0
                    ) AS value
                FROM kb_activity_daily
                WHERE member_id = ?
                  AND activity_date >= DATE(?)
                  AND (
                      ? IS NULL
                      OR activity_date < DATE(?)
                  )
                `,
                [
                    memberId,
                    start,
                    end,
                    end
                ]
            )

        return Number(
            rows[0]?.value || 0
        )
    }

    if (
        objective.objective_type ===
        'STREAK'
    ) {

        const [rows] =
            await conn.execute(
                `
                SELECT
                    COALESCE(
                        current_streak,
                        0
                    ) AS value
                FROM kb_member_stats
                WHERE member_id = ?
                LIMIT 1
                `,
                [
                    memberId
                ]
            )

        return Number(
            rows[0]?.value || 0
        )
    }

    if (
        objective.objective_type ===
        'EVENTS_PARTICIPATED'
    ) {

        const [rows] =
            await conn.execute(
                `
                SELECT
                    COUNT(*) AS value
                FROM kb_member_events
                WHERE member_id = ?
                  AND enabled = 1
                  AND status = 'COMPLETED'
                  AND completed_at >= ?
                  AND (
                      ? IS NULL
                      OR completed_at < ?
                  )
                `,
                [
                    memberId,
                    start,
                    end,
                    end
                ]
            )

        return Number(
            rows[0]?.value || 0
        )
    }

    if (
        objective.objective_type ===
        'EVENTS_WON'
    ) {

        const [rows] =
            await conn.execute(
                `
                SELECT
                    COUNT(*) AS value
                FROM kb_member_events
                WHERE member_id = ?
                  AND enabled = 1
                  AND status = 'COMPLETED'
                  AND result = 'WINNER'
                  AND completed_at >= ?
                  AND (
                      ? IS NULL
                      OR completed_at < ?
                  )
                `,
                [
                    memberId,
                    start,
                    end,
                    end
                ]
            )

        return Number(
            rows[0]?.value || 0
        )
    }

    throw new Error(
        'UNSUPPORTED_OBJECTIVE_TYPE'
    )
}

async function syncMemberObjective(
    memberId,
    objective,
    conn = pool
) {

    if (
        !SUPPORTED_OBJECTIVE_TYPES.has(
            objective.objective_type
        )
    ) {

        return {
            processed: false,
            reason:
                'UNSUPPORTED_OBJECTIVE_TYPE'
        }
    }

    const period =
        await resolveObjectivePeriod(
            objective,
            conn
        )

    if (!period.valid) {

        return {
            processed: false,
            reason:
                period.reason
        }
    }

    const memberObjective =
        await ensureMemberObjective(
            memberId,
            objective.id,
            period.periodStart,
            period.periodEnd,
            conn
        )

    if (
        memberObjective.status ===
            'CLAIMED' ||
        memberObjective.status ===
            'EXPIRED' ||
        memberObjective.status ===
            'CANCELLED'
    ) {

        return {
            processed: true,
            changed: false,
            memberObjective
        }
    }

    const value =
        await getMemberObjectiveValue(
            memberId,
            objective,
            period,
            conn
        )

    const updated =
        await setObjectiveProgress(
            memberObjective.id,
            value,
            objective.target_value,
            conn
        )

    return {
        processed: true,
        changed:
            Number(
                memberObjective.current_value
            ) !==
                Number(
                    updated.current_value
                ) ||
            memberObjective.status !==
                updated.status,
        memberObjective:
            updated
    }
}

async function syncMemberObjectivesByType(
    memberId,
    objectiveType,
    conn = pool
) {

    if (
        !SUPPORTED_OBJECTIVE_TYPES.has(
            objectiveType
        )
    ) {

        return {
            processed: false,
            reason:
                'UNSUPPORTED_OBJECTIVE_TYPE',
            checked: 0,
            changed: 0,
            completed: 0,
            failed: 0
        }
    }

    const objectives =
        await getAvailableObjectivesByType(
            objectiveType,
            conn
        )

    let checked = 0
    let changed = 0
    let completed = 0
    let failed = 0

    for (const objective of objectives) {

        try {

            const result =
                await syncMemberObjective(
                    memberId,
                    objective,
                    conn
                )

            if (!result.processed) {
                continue
            }

            checked++

            if (result.changed) {
                changed++
            }

            if (
                result.memberObjective
                    ?.status ===
                'COMPLETED'
            ) {
                completed++
            }

        } catch {

            failed++
        }
    }

    return {
        processed: true,
        checked,
        changed,
        completed,
        failed
    }
}

async function syncMemberObjectives(
    memberId,
    conn = pool
) {

    const results = {}

    for (
        const objectiveType
        of SUPPORTED_OBJECTIVE_TYPES
    ) {

        results[objectiveType] =
            await syncMemberObjectivesByType(
                memberId,
                objectiveType,
                conn
            )
    }

    return results
}

module.exports = {
    SUPPORTED_OBJECTIVE_TYPES,
    resolveObjectivePeriod,
    getMemberObjectiveValue,
    syncMemberObjective,
    syncMemberObjectivesByType,
    syncMemberObjectives
}
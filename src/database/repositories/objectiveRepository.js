const {
    pool
} = require('../mysql')

async function getObjectiveById(
    objectiveId,
    conn = pool
) {

    const [rows] =
        await conn.execute(
            `
            SELECT *
            FROM kb_objectives
            WHERE id = ?
              AND enabled = 1
            LIMIT 1
            `,
            [objectiveId]
        )

    return rows[0] || null
}

async function getObjectiveByCode(
    code,
    conn = pool
) {

    const [rows] =
        await conn.execute(
            `
            SELECT *
            FROM kb_objectives
            WHERE code = ?
              AND enabled = 1
            LIMIT 1
            `,
            [code]
        )

    return rows[0] || null
}

async function getAvailableObjectives(
    conn = pool
) {

    const [rows] =
        await conn.execute(
            `
            SELECT *
            FROM kb_objectives
            WHERE enabled = 1
              AND (
                  starts_at IS NULL
                  OR starts_at <= NOW()
              )
              AND (
                  ends_at IS NULL
                  OR ends_at > NOW()
              )
            ORDER BY
                display_order ASC,
                id ASC
            `
        )

    return rows
}

async function getAvailableObjectivesByType(
    objectiveType,
    conn = pool
) {

    const [rows] =
        await conn.execute(
            `
            SELECT *
            FROM kb_objectives
            WHERE enabled = 1
              AND objective_type = ?
              AND (
                  starts_at IS NULL
                  OR starts_at <= NOW()
              )
              AND (
                  ends_at IS NULL
                  OR ends_at > NOW()
              )
            ORDER BY
                display_order ASC,
                id ASC
            `,
            [objectiveType]
        )

    return rows
}

async function getMemberObjectiveById(
    memberObjectiveId,
    conn = pool
) {

    const [rows] =
        await conn.execute(
            `
            SELECT
                mo.*,
                o.code AS objective_code,
                o.name AS objective_name,
                o.description AS objective_description,
                o.objective_type,
                o.target_value,
                o.period_type,
                o.season_id,
                o.event_id
            FROM kb_member_objectives mo
            INNER JOIN kb_objectives o
                ON o.id = mo.objective_id
            WHERE mo.id = ?
            LIMIT 1
            `,
            [memberObjectiveId]
        )

    return rows[0] || null
}

async function getMemberObjective(
    memberId,
    objectiveId,
    periodStart,
    conn = pool
) {

    const [rows] =
        await conn.execute(
            `
            SELECT *
            FROM kb_member_objectives
            WHERE member_id = ?
              AND objective_id = ?
              AND period_start = ?
            LIMIT 1
            `,
            [
                memberId,
                objectiveId,
                periodStart
            ]
        )

    return rows[0] || null
}

async function getMemberObjectives(
    memberId,
    conn = pool
) {

    const [rows] =
        await conn.execute(
            `
            SELECT
                mo.*,
                o.code AS objective_code,
                o.name AS objective_name,
                o.description AS objective_description,
                o.objective_type,
                o.target_value,
                o.period_type,
                o.season_id,
                o.event_id,
                o.display_order
            FROM kb_member_objectives mo
            INNER JOIN kb_objectives o
                ON o.id = mo.objective_id
            WHERE mo.member_id = ?
              AND o.enabled = 1
            ORDER BY
                FIELD(
                    mo.status,
                    'COMPLETED',
                    'IN_PROGRESS',
                    'CLAIMED',
                    'EXPIRED',
                    'CANCELLED'
                ),
                o.display_order ASC,
                mo.id ASC
            `,
            [memberId]
        )

    return rows
}

async function ensureMemberObjective(
    memberId,
    objectiveId,
    periodStart,
    periodEnd = null,
    conn = pool
) {

    await conn.execute(
        `
        INSERT INTO kb_member_objectives (
            member_id,
            objective_id,
            period_start,
            period_end,
            current_value,
            status
        )
        VALUES (
            ?,
            ?,
            ?,
            ?,
            0,
            'IN_PROGRESS'
        )
        ON DUPLICATE KEY UPDATE
            period_end =
                COALESCE(
                    period_end,
                    VALUES(period_end)
                ),
            updated_at =
                CURRENT_TIMESTAMP
        `,
        [
            memberId,
            objectiveId,
            periodStart,
            periodEnd
        ]
    )

    return getMemberObjective(
        memberId,
        objectiveId,
        periodStart,
        conn
    )
}

async function setObjectiveProgress(
    memberObjectiveId,
    currentValue,
    targetValue,
    conn = pool
) {

    const normalizedValue =
        Math.max(
            0,
            Number(currentValue) || 0
        )

    const normalizedTarget =
        Math.max(
            1,
            Number(targetValue) || 1
        )

    const finalValue =
        Math.min(
            normalizedValue,
            normalizedTarget
        )

    await conn.execute(
        `
        UPDATE kb_member_objectives
        SET
            current_value = ?,
            status =
                CASE
                    WHEN status IN (
                        'CLAIMED',
                        'EXPIRED',
                        'CANCELLED'
                    )
                    THEN status

                    WHEN ? >= ?
                    THEN 'COMPLETED'

                    ELSE 'IN_PROGRESS'
                END,
            completed_at =
                CASE
                    WHEN status IN (
                        'CLAIMED',
                        'EXPIRED',
                        'CANCELLED'
                    )
                    THEN completed_at

                    WHEN ? >= ?
                    THEN COALESCE(
                        completed_at,
                        CURRENT_TIMESTAMP
                    )

                    ELSE NULL
                END,
            updated_at =
                CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [
            finalValue,
            finalValue,
            normalizedTarget,
            finalValue,
            normalizedTarget,
            memberObjectiveId
        ]
    )

    return getMemberObjectiveById(
        memberObjectiveId,
        conn
    )
}

async function incrementObjectiveProgress(
    memberObjectiveId,
    amount,
    targetValue,
    conn = pool
) {

    const increment =
        Math.max(
            0,
            Number(amount) || 0
        )

    const normalizedTarget =
        Math.max(
            1,
            Number(targetValue) || 1
        )

    await conn.execute(
        `
        UPDATE kb_member_objectives
        SET
            current_value =
                LEAST(
                    ?,
                    current_value + ?
                ),
            completed_at =
                CASE
                    WHEN status = 'IN_PROGRESS'
                     AND current_value + ? >= ?
                    THEN COALESCE(
                        completed_at,
                        CURRENT_TIMESTAMP
                    )
                    ELSE completed_at
                END,
            status =
                CASE
                    WHEN status = 'IN_PROGRESS'
                     AND current_value + ? >= ?
                    THEN 'COMPLETED'
                    ELSE status
                END,
            updated_at =
                CURRENT_TIMESTAMP
        WHERE id = ?
          AND status = 'IN_PROGRESS'
        `,
        [
            normalizedTarget,
            increment,
            increment,
            normalizedTarget,
            increment,
            normalizedTarget,
            memberObjectiveId
        ]
    )

    return getMemberObjectiveById(
        memberObjectiveId,
        conn
    )
}

async function expireObjective(
    memberObjectiveId,
    conn = pool
) {

    await conn.execute(
        `
        UPDATE kb_member_objectives
        SET
            status = 'EXPIRED',
            updated_at =
                CURRENT_TIMESTAMP
        WHERE id = ?
          AND status = 'IN_PROGRESS'
        `,
        [memberObjectiveId]
    )

    return getMemberObjectiveById(
        memberObjectiveId,
        conn
    )
}

async function getObjectiveRewards(
    objectiveId,
    conn = pool
) {

    const [rows] =
        await conn.execute(
            `
            SELECT *
            FROM kb_objective_rewards
            WHERE objective_id = ?
              AND enabled = 1
            ORDER BY
                display_order ASC,
                id ASC
            `,
            [objectiveId]
        )

    return rows
}

module.exports = {
    getObjectiveById,
    getObjectiveByCode,
    getAvailableObjectives,
    getAvailableObjectivesByType,
    getMemberObjectiveById,
    getMemberObjective,
    getMemberObjectives,
    ensureMemberObjective,
    setObjectiveProgress,
    incrementObjectiveProgress,
    expireObjective,
    getObjectiveRewards
}
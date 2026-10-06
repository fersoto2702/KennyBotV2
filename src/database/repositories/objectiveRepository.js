const {
    pool
} = require('../mysql')


const TERMINAL_STATUSES =
    new Set([
        'COMPLETED',
        'CLAIMED',
        'EXPIRED',
        'CANCELLED'
    ])


function validatePositiveInteger(
    value,
    name
) {

    const number =
        Number(value)

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


function normalizeCode(
    value,
    name = 'code'
) {

    const code =
        String(value || '')
            .trim()
            .toUpperCase()

    if (!code) {

        throw new Error(
            `${name} es obligatorio`
        )

    }

    return code
}


function normalizeObjectiveType(
    value
) {

    return normalizeCode(
        value,
        'objectiveType'
    )
}


function normalizeProgress(
    value
) {

    return Math.max(
        0,
        Number(value) || 0
    )
}


function normalizeTarget(
    value
) {

    return Math.max(
        1,
        Number(value) || 1
    )
}


/* ─────────────────────────────
   OBJETIVO POR ID
───────────────────────────── */

async function getObjectiveById(
    objectiveId,
    conn = pool
) {

    const id =
        validatePositiveInteger(
            objectiveId,
            'objectiveId'
        )

    const [rows] =
        await conn.execute(
            `
            SELECT
                *
            FROM kb_objectives
            WHERE id = ?
              AND enabled = 1
            LIMIT 1
            `,
            [id]
        )

    return rows?.[0] || null
}


/* ─────────────────────────────
   OBJETIVO POR CÓDIGO
───────────────────────────── */

async function getObjectiveByCode(
    code,
    conn = pool
) {

    const objectiveCode =
        normalizeCode(
            code,
            'objectiveCode'
        )

    const [rows] =
        await conn.execute(
            `
            SELECT
                *
            FROM kb_objectives
            WHERE code = ?
              AND enabled = 1
            LIMIT 1
            `,
            [objectiveCode]
        )

    return rows?.[0] || null
}


/* ─────────────────────────────
   OBJETIVOS DISPONIBLES
───────────────────────────── */

async function getAvailableObjectives(
    conn = pool
) {

    const [rows] =
        await conn.execute(
            `
            SELECT
                *
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

    return Array.isArray(rows)
        ? rows
        : []
}


/* ─────────────────────────────
   OBJETIVOS POR TIPO
───────────────────────────── */

async function getAvailableObjectivesByType(
    objectiveType,
    conn = pool
) {

    const type =
        normalizeObjectiveType(
            objectiveType
        )

    const [rows] =
        await conn.execute(
            `
            SELECT
                *
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
            [type]
        )

    return Array.isArray(rows)
        ? rows
        : []
}


/* ─────────────────────────────
   MEMBER OBJECTIVE POR ID
───────────────────────────── */

async function getMemberObjectiveById(
    memberObjectiveId,
    conn = pool
) {

    const id =
        validatePositiveInteger(
            memberObjectiveId,
            'memberObjectiveId'
        )

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
            [id]
        )

    return rows?.[0] || null
}


/* ─────────────────────────────
   MEMBER OBJECTIVE DEL PERIODO
───────────────────────────── */

async function getMemberObjective(
    memberId,
    objectiveId,
    periodStart,
    conn = pool
) {

    const member =
        validatePositiveInteger(
            memberId,
            'memberId'
        )

    const objective =
        validatePositiveInteger(
            objectiveId,
            'objectiveId'
        )

    if (!periodStart) {

        throw new Error(
            'periodStart es obligatorio'
        )

    }

    const [rows] =
        await conn.execute(
            `
            SELECT
                *
            FROM kb_member_objectives
            WHERE member_id = ?
              AND objective_id = ?
              AND period_start = ?
            LIMIT 1
            `,
            [
                member,
                objective,
                periodStart
            ]
        )

    return rows?.[0] || null
}


/* ─────────────────────────────
   OBJETIVOS DEL MIEMBRO
───────────────────────────── */

async function getMemberObjectives(
    memberId,
    conn = pool
) {

    const member =
        validatePositiveInteger(
            memberId,
            'memberId'
        )

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
            [member]
        )

    return Array.isArray(rows)
        ? rows
        : []
}


/* ─────────────────────────────
   CREAR / ASEGURAR OBJETIVO
───────────────────────────── */

async function ensureMemberObjective(
    memberId,
    objectiveId,
    periodStart,
    periodEnd = null,
    conn = pool
) {

    const member =
        validatePositiveInteger(
            memberId,
            'memberId'
        )

    const objective =
        validatePositiveInteger(
            objectiveId,
            'objectiveId'
        )

    if (!periodStart) {

        throw new Error(
            'periodStart es obligatorio'
        )

    }

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
            member,
            objective,
            periodStart,
            periodEnd
        ]
    )

    return getMemberObjective(
        member,
        objective,
        periodStart,
        conn
    )
}


/* ─────────────────────────────
   ESTABLECER PROGRESO
───────────────────────────── */

async function setObjectiveProgress(
    memberObjectiveId,
    currentValue,
    targetValue,
    conn = pool
) {

    const id =
        validatePositiveInteger(
            memberObjectiveId,
            'memberObjectiveId'
        )

    const normalizedValue =
        normalizeProgress(
            currentValue
        )

    const normalizedTarget =
        normalizeTarget(
            targetValue
        )

    const finalValue =
        Math.min(
            normalizedValue,
            normalizedTarget
        )


    /*
        Solo modificamos objetivos que aún
        puedan cambiar de progreso.

        COMPLETED también se protege para
        impedir que vuelva a IN_PROGRESS.
    */

    await conn.execute(
        `
        UPDATE kb_member_objectives

        SET
            current_value = ?,

            status =
                CASE
                    WHEN ? >= ?
                    THEN 'COMPLETED'

                    ELSE 'IN_PROGRESS'
                END,

            completed_at =
                CASE
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
          AND status = 'IN_PROGRESS'
        `,
        [
            finalValue,

            finalValue,
            normalizedTarget,

            finalValue,
            normalizedTarget,

            id
        ]
    )

    return getMemberObjectiveById(
        id,
        conn
    )
}


/* ─────────────────────────────
   INCREMENTAR PROGRESO
───────────────────────────── */

async function incrementObjectiveProgress(
    memberObjectiveId,
    amount,
    targetValue,
    conn = pool
) {

    const id =
        validatePositiveInteger(
            memberObjectiveId,
            'memberObjectiveId'
        )

    const increment =
        normalizeProgress(
            amount
        )

    const normalizedTarget =
        normalizeTarget(
            targetValue
        )


    if (
        increment === 0
    ) {

        return getMemberObjectiveById(
            id,
            conn
        )

    }


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
                    WHEN current_value + ? >= ?
                    THEN COALESCE(
                        completed_at,
                        CURRENT_TIMESTAMP
                    )

                    ELSE completed_at
                END,

            status =
                CASE
                    WHEN current_value + ? >= ?
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

            id
        ]
    )

    return getMemberObjectiveById(
        id,
        conn
    )
}


/* ─────────────────────────────
   EXPIRAR OBJETIVO
───────────────────────────── */

async function expireObjective(
    memberObjectiveId,
    conn = pool
) {

    const id =
        validatePositiveInteger(
            memberObjectiveId,
            'memberObjectiveId'
        )

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
        [id]
    )

    return getMemberObjectiveById(
        id,
        conn
    )
}


/* ─────────────────────────────
   RECOMPENSAS DEL OBJETIVO
───────────────────────────── */

async function getObjectiveRewards(
    objectiveId,
    conn = pool
) {

    const id =
        validatePositiveInteger(
            objectiveId,
            'objectiveId'
        )

    const [rows] =
        await conn.execute(
            `
            SELECT
                *
            FROM kb_objective_rewards
            WHERE objective_id = ?
              AND enabled = 1
            ORDER BY
                display_order ASC,
                id ASC
            `,
            [id]
        )

    return Array.isArray(rows)
        ? rows
        : []
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
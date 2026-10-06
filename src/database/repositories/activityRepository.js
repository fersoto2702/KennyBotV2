const {
    pool
} = require('../mysql')


function validateMemberId(
    memberId
) {

    const id =
        Number(
            memberId
        )


    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {

        throw new Error(
            `memberId inválido: ${memberId}`
        )

    }


    return id

}


function normalizeDate(
    value
) {

    if (!value) {

        return null

    }


    if (
        value instanceof Date
    ) {

        return value
            .toISOString()
            .slice(0, 10)

    }


    return String(value)
        .slice(0, 10)

}


async function registerValidMessage(
    memberId
) {

    const id =
        validateMemberId(
            memberId
        )


    const conn =
        await pool.getConnection()


    try {

        await conn.beginTransaction()


        /* ─────────────────────────────
           BLOQUEAR ESTADÍSTICAS
        ───────────────────────────── */

        const [
            statsRows
        ] =
            await conn.execute(

                `
                SELECT
                    member_id,
                    valid_messages,
                    active_days,
                    current_streak,
                    longest_streak,
                    first_activity_at,
                    last_activity_at,
                    last_active_date
                FROM kb_member_stats
                WHERE member_id = ?
                FOR UPDATE
                `,

                [
                    id
                ]

            )


        if (
            !Array.isArray(statsRows) ||
            statsRows.length === 0
        ) {

            throw new Error(
                `No existen estadísticas para member_id ${id}`
            )

        }


        const stats =
            statsRows[0]


        /* ─────────────────────────────
           FECHA ACTUAL DE MYSQL
        ───────────────────────────── */

        const [
            dateRows
        ] =
            await conn.execute(

                `
                SELECT
                    CURDATE() AS today,
                    DATE_SUB(
                        CURDATE(),
                        INTERVAL 1 DAY
                    ) AS yesterday
                `

            )


        if (
            !Array.isArray(dateRows) ||
            !dateRows[0]
        ) {

            throw new Error(
                'No se pudo obtener la fecha actual de MySQL'
            )

        }


        const todayString =
            normalizeDate(
                dateRows[0].today
            )


        const yesterdayString =
            normalizeDate(
                dateRows[0].yesterday
            )


        const lastActiveDate =
            normalizeDate(
                stats.last_active_date
            )


        /* ─────────────────────────────
           ACTIVIDAD / RACHA
        ───────────────────────────── */

        let activeDays =
            Math.max(
                0,
                Number(
                    stats.active_days
                ) || 0
            )


        let currentStreak =
            Math.max(
                0,
                Number(
                    stats.current_streak
                ) || 0
            )


        let longestStreak =
            Math.max(
                0,
                Number(
                    stats.longest_streak
                ) || 0
            )


        const newActiveDay =
            lastActiveDate !==
            todayString


        if (
            newActiveDay
        ) {

            activeDays += 1


            if (
                lastActiveDate ===
                yesterdayString
            ) {

                currentStreak += 1

            } else {

                currentStreak = 1

            }


            if (
                currentStreak >
                longestStreak
            ) {

                longestStreak =
                    currentStreak

            }

        }


        /* ─────────────────────────────
           ACTUALIZAR ESTADÍSTICAS
        ───────────────────────────── */

        const [
            updateResult
        ] =
            await conn.execute(

                `
                UPDATE kb_member_stats
                SET
                    valid_messages =
                        valid_messages + 1,

                    active_days = ?,

                    current_streak = ?,

                    longest_streak = ?,

                    first_activity_at =
                        COALESCE(
                            first_activity_at,
                            CURRENT_TIMESTAMP
                        ),

                    last_activity_at =
                        CURRENT_TIMESTAMP,

                    last_active_date =
                        CURDATE()

                WHERE member_id = ?
                `,

                [
                    activeDays,
                    currentStreak,
                    longestStreak,
                    id
                ]

            )


        if (
            updateResult.affectedRows !== 1
        ) {

            throw new Error(
                `No se pudo actualizar kb_member_stats para member_id ${id}`
            )

        }


        /* ─────────────────────────────
           ACTIVIDAD DIARIA
        ───────────────────────────── */

        await conn.execute(

            `
            INSERT INTO kb_activity_daily (
                member_id,
                activity_date,
                valid_messages
            )
            VALUES (
                ?,
                CURDATE(),
                1
            )
            ON DUPLICATE KEY UPDATE
                valid_messages =
                    valid_messages + 1
            `,

            [
                id
            ]

        )


        await conn.commit()


        return {

            memberId:
                id,

            validMessage:
                true,

            newActiveDay,

            activeDays,

            currentStreak,

            longestStreak

        }


    } catch (error) {

        try {

            await conn.rollback()

        } catch {}


        throw error


    } finally {

        conn.release()

    }

}


async function registerCommand(
    memberId
) {

    const id =
        validateMemberId(
            memberId
        )


    const conn =
        await pool.getConnection()


    try {

        await conn.beginTransaction()


        /* ─────────────────────────────
           ACTUALIZAR ESTADÍSTICAS
        ───────────────────────────── */

        const [
            updateResult
        ] =
            await conn.execute(

                `
                UPDATE kb_member_stats
                SET
                    commands_used =
                        commands_used + 1,

                    last_activity_at =
                        CURRENT_TIMESTAMP

                WHERE member_id = ?
                `,

                [
                    id
                ]

            )


        if (
            updateResult.affectedRows !== 1
        ) {

            throw new Error(
                `No existen estadísticas para member_id ${id}`
            )

        }


        /* ─────────────────────────────
           ACTIVIDAD DIARIA
        ───────────────────────────── */

        await conn.execute(

            `
            INSERT INTO kb_activity_daily (
                member_id,
                activity_date,
                commands_used
            )
            VALUES (
                ?,
                CURDATE(),
                1
            )
            ON DUPLICATE KEY UPDATE
                commands_used =
                    commands_used + 1
            `,

            [
                id
            ]

        )


        await conn.commit()


        return {

            memberId:
                id,

            commandRegistered:
                true

        }


    } catch (error) {

        try {

            await conn.rollback()

        } catch {}


        throw error


    } finally {

        conn.release()

    }

}


module.exports = {

    registerValidMessage,

    registerCommand

}
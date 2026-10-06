const {
    pool
} = require('../mysql')


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


/* ─────────────────────────────
   TEMPORADA ACTIVA
───────────────────────────── */

async function getActiveSeason(
    conn = pool
) {

    const [rows] =
        await conn.execute(
            `
            SELECT
                id,
                code,
                name,
                starts_at,
                ends_at,
                status

            FROM kb_seasons

            WHERE status = 'ACTIVE'
              AND CURDATE() >= starts_at
              AND CURDATE() <= ends_at

            ORDER BY
                starts_at DESC,
                id DESC

            LIMIT 1
            `
        )


    return rows?.[0] || null
}


/* ─────────────────────────────
   REGISTRAR MENSAJE DE TEMPORADA
───────────────────────────── */

async function registerSeasonMessage(
    memberId
) {

    const id =
        validatePositiveInteger(
            memberId,
            'memberId'
        )


    const conn =
        await pool.getConnection()


    try {

        await conn.beginTransaction()


        const season =
            await getActiveSeason(
                conn
            )


        if (!season) {

            await conn.commit()

            return null

        }


        /* ─────────────────────────────
           ASEGURAR FILA DE STATS
        ───────────────────────────── */

        await conn.execute(
            `
            INSERT INTO kb_member_season_stats (
                member_id,
                season_id
            )
            VALUES (?, ?)

            ON DUPLICATE KEY UPDATE
                member_id =
                    VALUES(member_id)
            `,
            [
                id,
                season.id
            ]
        )


        /* ─────────────────────────────
           BLOQUEAR STATS
        ───────────────────────────── */

        const [rows] =
            await conn.execute(
                `
                SELECT
                    id,
                    valid_messages,
                    active_days,
                    current_streak,
                    longest_streak,
                    first_activity_at,
                    last_activity_at,
                    last_active_date

                FROM kb_member_season_stats

                WHERE member_id = ?
                  AND season_id = ?

                FOR UPDATE
                `,
                [
                    id,
                    season.id
                ]
            )


        const stats =
            rows?.[0]


        if (!stats) {

            throw new Error(
                'No se pudieron crear las estadísticas de temporada'
            )

        }


        /* ─────────────────────────────
           ACTUALIZAR MENSAJES / RACHA
        ───────────────────────────── */

        const [updateResult] =
            await conn.execute(
                `
                UPDATE kb_member_season_stats

                SET
                    valid_messages =
                        valid_messages + 1,

                    active_days =
                        CASE
                            WHEN last_active_date IS NULL
                                THEN 1

                            WHEN last_active_date < CURDATE()
                                THEN active_days + 1

                            ELSE active_days
                        END,

                    current_streak =
                        CASE
                            WHEN last_active_date IS NULL
                                THEN 1

                            WHEN last_active_date = CURDATE()
                                THEN current_streak

                            WHEN last_active_date =
                                 DATE_SUB(
                                     CURDATE(),
                                     INTERVAL 1 DAY
                                 )
                                THEN current_streak + 1

                            ELSE 1
                        END,

                    longest_streak =
                        GREATEST(
                            longest_streak,

                            CASE
                                WHEN last_active_date IS NULL
                                    THEN 1

                                WHEN last_active_date = CURDATE()
                                    THEN current_streak

                                WHEN last_active_date =
                                     DATE_SUB(
                                         CURDATE(),
                                         INTERVAL 1 DAY
                                     )
                                    THEN current_streak + 1

                                ELSE 1
                            END
                        ),

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
                  AND season_id = ?
                `,
                [
                    id,
                    season.id
                ]
            )


        if (
            Number(
                updateResult.affectedRows
            ) !== 1
        ) {

            throw new Error(
                `No se pudieron actualizar las estadísticas de temporada para member_id ${id}`
            )

        }


        await conn.commit()


        return {
            season,
            registeredMessage: true
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


/* ─────────────────────────────
   REGISTRAR COMANDO DE TEMPORADA
───────────────────────────── */

async function registerSeasonCommand(
    memberId
) {

    const id =
        validatePositiveInteger(
            memberId,
            'memberId'
        )


    const conn =
        await pool.getConnection()


    try {

        await conn.beginTransaction()


        const season =
            await getActiveSeason(
                conn
            )


        if (!season) {

            await conn.commit()

            return null

        }


        const [result] =
            await conn.execute(
                `
                INSERT INTO kb_member_season_stats (
                    member_id,
                    season_id,
                    commands_used
                )
                VALUES (
                    ?,
                    ?,
                    1
                )

                ON DUPLICATE KEY UPDATE
                    commands_used =
                        commands_used + 1,

                    last_activity_at =
                        CURRENT_TIMESTAMP
                `,
                [
                    id,
                    season.id
                ]
            )


        if (
            Number(
                result.affectedRows
            ) <= 0
        ) {

            throw new Error(
                `No se pudo registrar el comando de temporada para member_id ${id}`
            )

        }


        await conn.commit()


        return {
            season,
            registeredCommand: true
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

    getActiveSeason,

    registerSeasonMessage,

    registerSeasonCommand

}
const { pool } = require('../mysql')


async function registerValidMessage(memberId) {

    const conn = await pool.getConnection()

    try {

        await conn.beginTransaction()

        const [statsRows] = await conn.execute(
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
            [memberId]
        )

        if (statsRows.length === 0) {
            throw new Error(
                `No existen estadísticas para member_id ${memberId}`
            )
        }

        const stats = statsRows[0]

        const [dateRows] = await conn.execute(
            `
            SELECT
                CURDATE() AS today,
                DATE_SUB(
                    CURDATE(),
                    INTERVAL 1 DAY
                ) AS yesterday
            `
        )

        const today =
            dateRows[0].today

        const yesterday =
            dateRows[0].yesterday


        let activeDays =
            Number(stats.active_days || 0)

        let currentStreak =
            Number(stats.current_streak || 0)

        let longestStreak =
            Number(stats.longest_streak || 0)

        const normalizeDate = value => {

            if (!value) return null

            if (value instanceof Date) {
                return value
                    .toISOString()
                    .slice(0, 10)
            }

            return String(value)
                .slice(0, 10)
        }


        const todayString =
            normalizeDate(today)

        const yesterdayString =
            normalizeDate(yesterday)

        const lastActiveDate =
            normalizeDate(
                stats.last_active_date
            )

        if (lastActiveDate !== todayString) {

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
                memberId
            ]
        )

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
            [memberId]
        )


        await conn.commit()


        return {
            memberId,
            validMessage: true,
            newActiveDay:
                lastActiveDate !==
                todayString,
            activeDays,
            currentStreak,
            longestStreak
        }


    } catch (error) {

        await conn.rollback()

        throw error

    } finally {

        conn.release()

    }
}

async function registerCommand(memberId) {

    const conn = await pool.getConnection()

    try {

        await conn.beginTransaction()

        await conn.execute(
            `
            UPDATE kb_member_stats
            SET
                commands_used = commands_used + 1,
                last_activity_at = CURRENT_TIMESTAMP
            WHERE member_id = ?
            `,
            [memberId]
        )

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
            [memberId]
        )


        await conn.commit()

        return true

    } catch (error) {

        await conn.rollback()

        throw error

    } finally {

        conn.release()

    }
}

module.exports = {
    registerValidMessage,
    registerCommand
}
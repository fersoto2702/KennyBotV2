const { pool } =
    require('../database/mysql')

const round4 = value =>
    Math.round(
        (Number(value) + Number.EPSILON) * 10000
    ) / 10000


function normalize(value, maximum) {

    const current =
        Math.max(0, Number(value) || 0)

    const max =
        Math.max(0, Number(maximum) || 0)

    if (max === 0) {
        return 0
    }

    return current / max
}

function calculateScore(stats, maximums) {

    const activity =
        normalize(
            stats.active_days,
            maximums.active_days
        )

    const messages =
        normalize(
            stats.valid_messages,
            maximums.valid_messages
        )

    const interactions =
        normalize(
            stats.interactions,
            maximums.interactions
        )

    const streak =
        normalize(
            stats.longest_streak,
            maximums.longest_streak
        )

    const events =
        normalize(
            stats.events_participated,
            maximums.events_participated
        )


    return round4(
        (
            activity * 0.35 +
            messages * 0.25 +
            interactions * 0.15 +
            streak * 0.15 +
            events * 0.10
        ) * 100
    )
}


async function finalizeSeason(seasonId) {

    const conn =
        await pool.getConnection()

    let finalizedParticipants = []

    try {

        await conn.beginTransaction()

        const [seasonRows] =
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
                WHERE id = ?
                FOR UPDATE
                `,
                [seasonId]
            )


        if (!seasonRows.length) {

            await conn.rollback()

            return {
                finalized: false,
                reason: 'SEASON_NOT_FOUND'
            }
        }


        const season =
            seasonRows[0]

        if (season.status === 'FINISHED') {

            await conn.rollback()

            return {
                finalized: false,
                reason: 'ALREADY_FINISHED',
                season
            }
        }


        if (season.status === 'CANCELLED') {

            await conn.rollback()

            return {
                finalized: false,
                reason: 'SEASON_CANCELLED',
                season
            }
        }

        if (season.status !== 'ACTIVE') {

            await conn.rollback()

            return {
                finalized: false,
                reason: 'SEASON_NOT_ACTIVE',
                season
            }
        }

        const [participants] =
            await conn.execute(
                `
                SELECT
                    ss.id,
                    ss.member_id,
                    ss.valid_messages,
                    ss.commands_used,
                    ss.interactions,
                    ss.active_days,
                    ss.current_streak,
                    ss.longest_streak,
                    ss.events_participated,
                    ss.events_won,

                    m.display_name

                FROM kb_member_season_stats ss

                INNER JOIN kb_members m
                    ON m.id = ss.member_id

                WHERE ss.season_id = ?

                FOR UPDATE
                `,
                [seasonId]
            )


        if (!participants.length) {

            await conn.rollback()

            return {
                finalized: false,
                reason: 'NO_PARTICIPANTS',
                season
            }
        }

        const maximums = {

            active_days:
                Math.max(
                    ...participants.map(
                        p =>
                            Number(
                                p.active_days || 0
                            )
                    )
                ),

            valid_messages:
                Math.max(
                    ...participants.map(
                        p =>
                            Number(
                                p.valid_messages || 0
                            )
                    )
                ),

            interactions:
                Math.max(
                    ...participants.map(
                        p =>
                            Number(
                                p.interactions || 0
                            )
                    )
                ),

            longest_streak:
                Math.max(
                    ...participants.map(
                        p =>
                            Number(
                                p.longest_streak || 0
                            )
                    )
                ),

            events_participated:
                Math.max(
                    ...participants.map(
                        p =>
                            Number(
                                p.events_participated || 0
                            )
                    )
                )
        }

        finalizedParticipants =
            participants.map(
                participant => ({
                    ...participant,

                    final_score:
                        calculateScore(
                            participant,
                            maximums
                        )
                })
            )

        finalizedParticipants.sort(
            (a, b) => {

                return (
                    b.final_score -
                        a.final_score ||

                    Number(b.active_days) -
                        Number(a.active_days) ||

                    Number(b.interactions) -
                        Number(a.interactions) ||

                    Number(b.longest_streak) -
                        Number(a.longest_streak) ||

                    Number(b.valid_messages) -
                        Number(a.valid_messages) ||

                    Number(a.member_id) -
                        Number(b.member_id)
                )
            }
        )

        for (
            let index = 0;
            index < finalizedParticipants.length;
            index++
        ) {

            const participant =
                finalizedParticipants[index]

            participant.final_rank =
                index + 1


            await conn.execute(
                `
                UPDATE kb_member_season_stats

                SET
                    final_score = ?,
                    final_rank = ?,
                    finalized_at =
                        CURRENT_TIMESTAMP

                WHERE id = ?
                `,
                [
                    participant.final_score,
                    participant.final_rank,
                    participant.id
                ]
            )
        }

        await conn.execute(
            `
            UPDATE kb_seasons

            SET status = 'FINISHED'

            WHERE id = ?
            `,
            [seasonId]
        )


        await conn.commit()

        return {
            finalized: true,
            reason: 'FINISHED',
            season,
            participants:
                finalizedParticipants,
            awardsGranted
        }


    } catch (error) {

        try {
            await conn.rollback()
        } catch (_) {}

        throw error

    } finally {

        conn.release()

    }
}


module.exports = {
    calculateScore,
    finalizeSeason
}
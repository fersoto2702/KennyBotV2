const { pool } = require('../mysql')


async function getMemberByJid(userJid) {

    const [rows] = await pool.execute(
        `
        SELECT
            id,
            user_jid,
            alt_jid,
            display_name,
            member_type,
            joined_at,
            active,
            created_at,
            updated_at
        FROM kb_members
        WHERE user_jid = ?
           OR alt_jid = ?
        LIMIT 1
        `,
        [userJid, userJid]
    )

    return rows[0] || null
}


async function ensureMember(
    userJid,
    altJid = null,
    displayName = null
) {

    const conn = await pool.getConnection()

    try {

        await conn.beginTransaction()

        let params = [userJid, userJid]

        let sql = `
            SELECT *
            FROM kb_members
            WHERE user_jid = ?
               OR alt_jid = ?
        `

        if (altJid) {

            sql += `
                OR user_jid = ?
                OR alt_jid = ?
            `

            params.push(
                altJid,
                altJid
            )
        }

        sql += `
            LIMIT 1
            FOR UPDATE
        `

        const [existing] =
            await conn.execute(
                sql,
                params
            )


        let memberId


        if (existing.length > 0) {

            memberId =
                existing[0].id

            await conn.execute(
                `
                UPDATE kb_members
                SET
                    user_jid = ?,
                    alt_jid = COALESCE(?, alt_jid),
                    display_name =
                        COALESCE(?, display_name),
                    active = TRUE
                WHERE id = ?
                `,
                [
                    userJid,
                    altJid,
                    displayName,
                    memberId
                ]
            )

        } else {

            const [result] =
                await conn.execute(
                    `
                    INSERT INTO kb_members (
                        user_jid,
                        alt_jid,
                        display_name,
                        joined_at
                    )
                    VALUES (
                        ?,
                        ?,
                        ?,
                        CURRENT_TIMESTAMP
                    )
                    `,
                    [
                        userJid,
                        altJid,
                        displayName
                    ]
                )

            memberId =
                result.insertId
        }

        await conn.execute(
            `
            INSERT INTO kb_member_stats (
                member_id
            )
            VALUES (?)
            ON DUPLICATE KEY UPDATE
                member_id = VALUES(member_id)
            `,
            [memberId]
        )

        const [members] =
            await conn.execute(
                `
                SELECT
                    id,
                    user_jid,
                    alt_jid,
                    display_name,
                    member_type,
                    joined_at,
                    active,
                    created_at,
                    updated_at
                FROM kb_members
                WHERE id = ?
                LIMIT 1
                `,
                [memberId]
            )


        await conn.commit()

        return members[0]


    } catch (error) {

        await conn.rollback()

        throw error

    } finally {

        conn.release()

    }
}


module.exports = {
    getMemberByJid,
    ensureMember
}
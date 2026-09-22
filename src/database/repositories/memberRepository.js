const { pool } = require('../mysql')

async function getMemberByJid(userJid) {
    const [rows] = await pool.execute(
        `
        SELECT
            id,
            user_jid,
            display_name,
            member_type,
            joined_at,
            active,
            created_at,
            updated_at
        FROM kb_members
        WHERE user_jid = ?
        LIMIT 1
        `,
        [userJid]
    )

    return rows[0] || null
}

async function ensureMember(userJid, displayName = null) {
    const conn = await pool.getConnection()

    try {
        await conn.beginTransaction()

        await conn.execute(
            `
            INSERT INTO kb_members (
                user_jid,
                display_name,
                joined_at
            )
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE
                display_name = COALESCE(VALUES(display_name), display_name),
                active = TRUE
            `,
            [userJid, displayName]
        )

        const [members] = await conn.execute(
            `
            SELECT
                id,
                user_jid,
                display_name,
                member_type,
                joined_at,
                active,
                created_at,
                updated_at
            FROM kb_members
            WHERE user_jid = ?
            LIMIT 1
            `,
            [userJid]
        )

        const member = members[0]

        await conn.execute(
            `
            INSERT INTO kb_member_stats (member_id)
            VALUES (?)
            ON DUPLICATE KEY UPDATE
                member_id = VALUES(member_id)
            `,
            [member.id]
        )

        await conn.commit()

        return member

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
const { pool } =
    require('../database/mysql')

const {
    ensureMember
} = require(
    '../database/repositories/memberRepository'
)

const {
    grantAward
} = require(
    '../database/repositories/awardRepository'
)

const {
    deliverAwardRewards
} = require(
    './awardDeliveryService'
)

const {
    restoreBestEligibleCard
} = require(
    './specialCardService'
)

const ROLE_PRIORITY = {
    MEMBER: 0,
    ADMIN: 1,
    OWNER: 2
}

function normalizeMemberType(memberType) {

    if (
        memberType === 'ADMIN' ||
        memberType === 'OWNER'
    ) {
        return memberType
    }

    return 'MEMBER'
}

function whatsappAdminToMemberType(admin) {

    if (admin === 'superadmin') {
        return 'OWNER'
    }

    if (admin === 'admin') {
        return 'ADMIN'
    }

    return 'MEMBER'
}

async function getMemberById(
    memberId,
    conn = pool
) {

    const [rows] =
        await conn.execute(
            `
            SELECT
                id,
                user_jid,
                alt_jid,
                display_name,
                member_type,
                active

            FROM kb_members

            WHERE id = ?

            LIMIT 1
            `,
            [memberId]
        )

    return rows[0] || null
}

async function updateMemberType(
    memberId,
    memberType
) {

    const nextType =
        normalizeMemberType(
            memberType
        )

    const conn =
        await pool.getConnection()

    try {

        await conn.beginTransaction()

        const [rows] =
            await conn.execute(
                `
                SELECT
                    id,
                    member_type,
                    active

                FROM kb_members

                WHERE id = ?

                LIMIT 1

                FOR UPDATE
                `,
                [memberId]
            )

        if (!rows.length) {

            await conn.rollback()

            return {
                changed: false,
                reason:
                    'MEMBER_NOT_FOUND'
            }
        }

        const member =
            rows[0]

        if (
            Number(member.active) !== 1
        ) {

            await conn.rollback()

            return {
                changed: false,
                reason:
                    'MEMBER_INACTIVE',
                memberId
            }
        }

        const previousType =
            normalizeMemberType(
                member.member_type
            )

        if (
            previousType === nextType
        ) {

            await conn.commit()

            return {
                changed: false,
                reason:
                    'ROLE_UNCHANGED',
                memberId,
                previousType,
                memberType:
                    nextType
            }
        }

        await conn.execute(
            `
            UPDATE kb_members

            SET member_type = ?

            WHERE id = ?
            `,
            [
                nextType,
                memberId
            ]
        )

        await conn.commit()

        return {
            changed: true,
            reason:
                'ROLE_UPDATED',
            memberId,
            previousType,
            memberType:
                nextType
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

async function grantRoleAward(
    memberId,
    awardCode,
    reason
) {

    const award =
        await grantAward(
            memberId,
            awardCode,
            {
                reason
            }
        )

    if (
        !award.granted &&
        award.reason !==
            'ALREADY_GRANTED'
    ) {

        return {
            award,
            delivery: null
        }
    }

    if (!award.memberAwardId) {

        return {
            award,
            delivery: null
        }
    }

    const delivery =
        await deliverAwardRewards(
            award.memberAwardId
        )

    return {
        award,
        delivery
    }
}

async function restoreMemberCard(
    memberId
) {

    const conn =
        await pool.getConnection()

    try {

        await conn.beginTransaction()

        const result =
            await restoreBestEligibleCard(
                conn,
                memberId
            )

        await conn.commit()

        return result

    } catch (error) {

        try {
            await conn.rollback()
        } catch (_) {}

        throw error

    } finally {

        conn.release()
    }
}

async function applyRoleRewards(
    memberId,
    previousType,
    memberType
) {

    const previousPriority =
        ROLE_PRIORITY[
            previousType
        ] ?? 0

    const nextPriority =
        ROLE_PRIORITY[
            memberType
        ] ?? 0

    const results = []

    if (
        memberType === 'ADMIN' &&
        previousPriority <
            ROLE_PRIORITY.ADMIN
    ) {

        results.push(
            await grantRoleAward(
                memberId,
                'ADMIN_PROMOTION',
                'Promoción a administrador'
            )
        )
    }

    if (
        memberType === 'OWNER' &&
        previousPriority <
            ROLE_PRIORITY.OWNER
    ) {

        results.push(
            await grantRoleAward(
                memberId,
                'OWNER',
                'Propietario del grupo'
            )
        )
    }

    const card =
        await restoreMemberCard(
            memberId
        )

    return {
        rewards: results,
        card
    }
}

async function syncMemberRole({
    userJid,
    altJid = null,
    displayName = null,
    whatsappAdmin = null
}) {

    if (!userJid) {

        return {
            processed: false,
            reason:
                'USER_JID_REQUIRED'
        }
    }

    const ensured =
        await ensureMember(
            userJid,
            altJid,
            displayName
        )

    const memberId =
        typeof ensured === 'object'
            ? ensured.id
            : ensured

    if (!memberId) {

        return {
            processed: false,
            reason:
                'MEMBER_NOT_RESOLVED'
        }
    }

    const member =
        await getMemberById(
            memberId
        )

    if (!member) {

        return {
            processed: false,
            reason:
                'MEMBER_NOT_FOUND'
        }
    }

    const nextType =
        whatsappAdminToMemberType(
            whatsappAdmin
        )

    const role =
        await updateMemberType(
            memberId,
            nextType
        )

    if (
        !role.changed
    ) {

        const card =
            await restoreMemberCard(
                memberId
            )

        return {
            processed: true,
            changed: false,
            reason:
                role.reason,
            memberId,
            previousType:
                role.previousType,
            memberType:
                role.memberType,
            rewards: [],
            card
        }
    }

    const applied =
        await applyRoleRewards(
            memberId,
            role.previousType,
            role.memberType
        )

    return {
        processed: true,
        changed: true,
        reason:
            'ROLE_SYNCED',
        memberId,
        previousType:
            role.previousType,
        memberType:
            role.memberType,
        rewards:
            applied.rewards,
        card:
            applied.card
    }
}

module.exports = {
    ROLE_PRIORITY,
    normalizeMemberType,
    whatsappAdminToMemberType,
    getMemberById,
    updateMemberType,
    grantRoleAward,
    restoreMemberCard,
    applyRoleRewards,
    syncMemberRole
}
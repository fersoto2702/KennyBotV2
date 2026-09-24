const {
    productionGroups
} = require('../config/roleGroups')

const {
    syncMemberRole
} = require('./memberRoleService')

const ROLE_PRIORITY = {
    MEMBER: 0,
    ADMIN: 1,
    OWNER: 2
}

function whatsappRoleToMemberType(admin) {

    if (admin === 'superadmin') {
        return 'OWNER'
    }

    if (admin === 'admin') {
        return 'ADMIN'
    }

    return 'MEMBER'
}

function memberTypeToWhatsappAdmin(memberType) {

    if (memberType === 'OWNER') {
        return 'superadmin'
    }

    if (memberType === 'ADMIN') {
        return 'admin'
    }

    return null
}

function getHighestRole(currentRole, candidateRole) {

    const currentPriority =
        ROLE_PRIORITY[currentRole] ?? 0

    const candidatePriority =
        ROLE_PRIORITY[candidateRole] ?? 0

    return candidatePriority > currentPriority
        ? candidateRole
        : currentRole
}

function getParticipantAltJid(participant) {

    return (
        participant?.phoneNumber ||
        participant?.jid ||
        null
    )
}

function getParticipantKeys(participant) {

    return [
        participant?.id,
        participant?.phoneNumber,
        participant?.jid
    ].filter(Boolean)
}

async function getProductionMetadata(sock) {

    const metadataList = []

    for (const groupJid of productionGroups) {

        try {

            const metadata =
                await sock.groupMetadata(
                    groupJid
                )

            metadataList.push(metadata)

        } catch (err) {

            metadataList.push({
                id: groupJid,
                participants: [],
                syncError: err.message
            })
        }
    }

    return metadataList
}

function consolidateParticipants(metadataList) {

    const records = []
    const keyToRecord = new Map()

    for (const metadata of metadataList) {

        const participants =
            metadata?.participants || []

        for (const participant of participants) {

            const keys =
                getParticipantKeys(participant)

            if (!keys.length) {
                continue
            }

            let record = null

            for (const key of keys) {

                const existing =
                    keyToRecord.get(key)

                if (existing) {
                    record = existing
                    break
                }
            }

            const candidateRole =
                whatsappRoleToMemberType(
                    participant.admin
                )

            if (!record) {

                record = {
                    userJid:
                        participant.id,
                    altJid:
                        getParticipantAltJid(
                            participant
                        ),
                    displayName:
                        participant.notify ||
                        null,
                    memberType:
                        candidateRole,
                    keys:
                        new Set(keys)
                }

                records.push(record)

            } else {

                record.memberType =
                    getHighestRole(
                        record.memberType,
                        candidateRole
                    )

                if (
                    !record.altJid &&
                    getParticipantAltJid(
                        participant
                    )
                ) {

                    record.altJid =
                        getParticipantAltJid(
                            participant
                        )
                }

                if (
                    !record.displayName &&
                    participant.notify
                ) {

                    record.displayName =
                        participant.notify
                }

                for (const key of keys) {
                    record.keys.add(key)
                }
            }

            for (const key of record.keys) {
                keyToRecord.set(
                    key,
                    record
                )
            }
        }
    }

    return records
}

async function syncAllGlobalRoles(sock) {

    const metadataList =
        await getProductionMetadata(sock)

    const failedGroups =
        metadataList.filter(
            metadata =>
                metadata.syncError
        )

    if (failedGroups.length) {

        return {
            processed: false,
            reason: 'INCOMPLETE_GROUP_METADATA',
            groupsChecked:
                metadataList.length,
            groupsFailed:
                failedGroups.length,
            membersChecked: 0,
            changed: 0,
            failed: 0
        }
    }

    const members =
        consolidateParticipants(
            metadataList
        )

    let changed = 0
    let failed = 0

    for (const member of members) {

        try {

            const whatsappAdmin =
                memberTypeToWhatsappAdmin(
                    member.memberType
                )

            const result =
                await syncMemberRole({
                    userJid:
                        member.userJid,
                    altJid:
                        member.altJid,
                    displayName:
                        member.displayName,
                    whatsappAdmin
                })

            if (result.changed) {
                changed++
            }

        } catch {

            failed++
        }
    }

    return {
        processed: true,
        groupsChecked:
            metadataList.length,
        groupsFailed: 0,
        membersChecked:
            members.length,
        changed,
        failed
    }
}

async function syncGlobalRoleForMember(
    sock,
    participantId
) {

    const metadataList =
        await getProductionMetadata(sock)

    const failedGroups =
        metadataList.filter(
            metadata =>
                metadata.syncError
        )

    if (failedGroups.length) {

        return {
            processed: false,
            reason:
                'INCOMPLETE_GROUP_METADATA'
        }
    }

    const members =
        consolidateParticipants(
            metadataList
        )

    const member =
        members.find(
            item =>
                item.keys.has(
                    participantId
                )
        )

    if (!member) {

        return {
            processed: false,
            reason:
                'MEMBER_NOT_FOUND'
        }
    }

    const whatsappAdmin =
        memberTypeToWhatsappAdmin(
            member.memberType
        )

    const result =
        await syncMemberRole({
            userJid:
                member.userJid,
            altJid:
                member.altJid,
            displayName:
                member.displayName,
            whatsappAdmin
        })

    return {
        processed: true,
        memberType:
            member.memberType,
        result
    }
}

function isProductionRoleGroup(groupJid) {

    return productionGroups.includes(
        groupJid
    )
}

module.exports = {
    syncAllGlobalRoles,
    syncGlobalRoleForMember,
    isProductionRoleGroup
}
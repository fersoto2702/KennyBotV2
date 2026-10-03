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

function normalizeParticipant(participant) {

    if (!participant) {
        return null
    }

    if (typeof participant === 'string') {

        return {
            id: participant,
            phoneNumber: null,
            jid: null
        }
    }

    return {
        id:
            participant.id ||
            null,
        phoneNumber:
            participant.phoneNumber ||
            null,
        jid:
            participant.jid ||
            null
    }
}

async function getProductionMetadata(sock) {

    const metadataList = []

    for (const groupJid of productionGroups) {

        try {

            const metadata =
                await sock.groupMetadata(
                    groupJid
                )

            metadataList.push(
                metadata
            )

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
                getParticipantKeys(
                    participant
                )

            if (!keys.length) {
                continue
            }

            const matchedRecords =
                new Set()

            for (const key of keys) {

                const existing =
                    keyToRecord.get(key)

                if (existing) {
                    matchedRecords.add(
                        existing
                    )
                }
            }

            let record =
                matchedRecords
                    .values()
                    .next()
                    .value ||
                null

            if (
                matchedRecords.size > 1
            ) {

                const recordsToMerge =
                    Array.from(
                        matchedRecords
                    )

                record =
                    recordsToMerge[0]

                for (
                    let index = 1;
                    index <
                    recordsToMerge.length;
                    index++
                ) {

                    const duplicate =
                        recordsToMerge[index]

                    record.memberType =
                        getHighestRole(
                            record.memberType,
                            duplicate.memberType
                        )

                    if (
                        !record.altJid &&
                        duplicate.altJid
                    ) {
                        record.altJid =
                            duplicate.altJid
                    }

                    if (
                        !record.displayName &&
                        duplicate.displayName
                    ) {
                        record.displayName =
                            duplicate.displayName
                    }

                    for (
                        const key
                        of duplicate.keys
                    ) {

                        record.keys.add(
                            key
                        )

                        keyToRecord.set(
                            key,
                            record
                        )
                    }

                    const duplicateIndex =
                        records.indexOf(
                            duplicate
                        )

                    if (
                        duplicateIndex !== -1
                    ) {

                        records.splice(
                            duplicateIndex,
                            1
                        )
                    }
                }
            }

            const candidateRole =
                whatsappRoleToMemberType(
                    participant.admin
                )

            if (!record) {

                record = {
                    userJid:
                        participant.id ||
                        keys[0],
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
                        new Set()
                }

                records.push(
                    record
                )

            } else {

                record.memberType =
                    getHighestRole(
                        record.memberType,
                        candidateRole
                    )

                if (
                    !record.userJid &&
                    participant.id
                ) {

                    record.userJid =
                        participant.id
                }

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
            }

            for (const key of keys) {

                record.keys.add(
                    key
                )

                keyToRecord.set(
                    key,
                    record
                )
            }
        }
    }

    return records
}

function findConsolidatedMember(
    members,
    participant
) {

    const normalized =
        normalizeParticipant(
            participant
        )

    if (!normalized) {
        return null
    }

    const keys =
        getParticipantKeys(
            normalized
        )

    if (!keys.length) {
        return null
    }

    return (
        members.find(
            member =>
                keys.some(
                    key =>
                        member.keys.has(
                            key
                        )
                )
        ) ||
        null
    )
}

async function syncAllGlobalRoles(sock) {

    const metadataList =
        await getProductionMetadata(
            sock
        )

    const failedGroups =
        metadataList.filter(
            metadata =>
                metadata.syncError
        )

    if (failedGroups.length) {

        return {
            processed: false,
            reason:
                'INCOMPLETE_GROUP_METADATA',
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
    participant
) {

    const normalized =
        normalizeParticipant(
            participant
        )

    if (
        !normalized ||
        !getParticipantKeys(
            normalized
        ).length
    ) {

        return {
            processed: false,
            reason:
                'INVALID_PARTICIPANT'
        }
    }

    const metadataList =
        await getProductionMetadata(
            sock
        )

    const failedGroups =
        metadataList.filter(
            metadata =>
                metadata.syncError
        )

    if (failedGroups.length) {

        return {
            processed: false,
            reason:
                'INCOMPLETE_GROUP_METADATA',
            groupsChecked:
                metadataList.length,
            groupsFailed:
                failedGroups.length
        }
    }

    const members =
        consolidateParticipants(
            metadataList
        )

    const member =
        findConsolidatedMember(
            members,
            normalized
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
        userJid:
            member.userJid,
        altJid:
            member.altJid,
        result
    }
}

function isProductionRoleGroup(
    groupJid
) {

    return productionGroups.includes(
        groupJid
    )
}

module.exports = {
    syncAllGlobalRoles,
    syncGlobalRoleForMember,
    isProductionRoleGroup
}
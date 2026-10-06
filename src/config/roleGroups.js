const productionGroups = [
    '120363428100961773@g.us',
    '120363425582908025@g.us',
    '120363409907229270@g.us',
    '120363408756220553@g.us',
    '120363411644056541@g.us',
    '120363430517950704@g.us',
    '120363409582833789@g.us',
    '120363428619841201@g.us',
    '120363425159848865@g.us',
    '120363408941409130@g.us'
]

const testGroups = [
    '120363425530676036@g.us'
]


function normalizeGroupJid(jid) {

    if (!jid) {
        return null
    }

    const value =
        String(jid)
            .trim()

    if (
        !value.endsWith('@g.us')
    ) {
        return null
    }

    return value
}


function cleanGroupList(list) {

    return [
        ...new Set(
            list
                .map(normalizeGroupJid)
                .filter(Boolean)
        )
    ]
}


const normalizedProductionGroups =
    cleanGroupList(
        productionGroups
    )

const normalizedTestGroups =
    cleanGroupList(
        testGroups
    )


const allGroups =
    [
        ...new Set([
            ...normalizedProductionGroups,
            ...normalizedTestGroups
        ])
    ]


function isProductionGroup(jid) {

    const normalized =
        normalizeGroupJid(jid)

    return Boolean(
        normalized &&
        normalizedProductionGroups.includes(
            normalized
        )
    )
}


function isTestGroup(jid) {

    const normalized =
        normalizeGroupJid(jid)

    return Boolean(
        normalized &&
        normalizedTestGroups.includes(
            normalized
        )
    )
}


function isAllowedGroup(jid) {

    const normalized =
        normalizeGroupJid(jid)

    return Boolean(
        normalized &&
        allGroups.includes(
            normalized
        )
    )
}


module.exports = {

    productionGroups:
        normalizedProductionGroups,

    testGroups:
        normalizedTestGroups,

    allGroups,

    isProductionGroup,

    isTestGroup,

    isAllowedGroup

}
const mappings = new Map()

function normalize(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function register(names, config) {
    const values = Array.isArray(names)
        ? names
        : [names]

    for (const name of values) {
        mappings.set(
            normalize(name),
            {
                promoCode: config.promoCode,
                family: config.family || 'PLAYER',
                originalSource: config.originalSource || 'PACK',
                packable: Boolean(config.packable),
                packTier: config.packTier || null,
                additionalPools: Array.isArray(config.additionalPools)
                    ? [...config.additionalPools]
                    : []
            }
        )
    }
}

register(
    [
        'Non-Rare',
        'Non Rare',
        'Common',
        'Rare'
    ],
    {
        promoCode: 'BASE',
        family: 'PLAYER',
        originalSource: 'PACK',
        packable: true
    }
)

register(
    [
        'Team of the Week',
        'TOTW',
        'Inform',
        'In Form'
    ],
    {
        promoCode: 'TOTW',
        family: 'PLAYER',
        originalSource: 'PACK',
        packable: true,
        packTier: 'PERFORMANCE'
    }
)

register(
    [
        'Team of the Year',
        'TOTY'
    ],
    {
        promoCode: 'TOTY',
        family: 'PLAYER',
        originalSource: 'PACK',
        packable: true,
        packTier: 'SPECIAL',
        additionalPools: [
            'TOTY_HISTORY'
        ]
    }
)

register(
    [
        'Team of the Season',
        'TOTS'
    ],
    {
        promoCode: 'TOTS',
        family: 'PLAYER',
        originalSource: 'PACK',
        packable: true,
        packTier: 'SPECIAL',
        additionalPools: [
            'TOTS_HISTORY'
        ]
    }
)

register(
    [
        'Man of the Match',
        'MOTM'
    ],
    {
        promoCode: 'MOTM',
        family: 'PLAYER',
        originalSource: 'PACK',
        packable: true,
        packTier: 'PERFORMANCE'
    }
)

register(
    [
        'International Man of the Match',
        'iMOTM',
        'IMOTM'
    ],
    {
        promoCode: 'IMOTM',
        family: 'PLAYER',
        originalSource: 'PACK',
        packable: true,
        packTier: 'PERFORMANCE'
    }
)

register(
    [
        'Record Breaker',
        'Record Breakers'
    ],
    {
        promoCode: 'RECORD_BREAKER',
        family: 'PLAYER',
        originalSource: 'PACK',
        packable: true,
        packTier: 'SPECIAL'
    }
)

register(
    [
        'Ones to Watch',
        'OTW'
    ],
    {
        promoCode: 'ONES_TO_WATCH',
        family: 'PLAYER',
        originalSource: 'PACK',
        packable: true,
        packTier: 'SPECIAL'
    }
)

register(
    [
        'Ultimate Scream',
        'Scream'
    ],
    {
        promoCode: 'ULTIMATE_SCREAM',
        family: 'PLAYER',
        originalSource: 'PACK',
        packable: true,
        packTier: 'SPECIAL'
    }
)

register(
    'Movember',
    {
        promoCode: 'MOVEMBER',
        family: 'PLAYER',
        originalSource: 'PACK',
        packable: true,
        packTier: 'SPECIAL'
    }
)

register(
    [
        "St. Patrick's Day",
        'St Patricks Day',
        'St. Patricks Day'
    ],
    {
        promoCode: 'ST_PATRICKS',
        family: 'PLAYER',
        originalSource: 'PACK',
        packable: true,
        packTier: 'SPECIAL'
    }
)

register(
    [
        'FUT Birthday'
    ],
    {
        promoCode: 'FUT_BIRTHDAY',
        family: 'PLAYER',
        originalSource: 'PACK',
        packable: true,
        packTier: 'SPECIAL',
        additionalPools: [
            'FUT_BIRTHDAY_HISTORY'
        ]
    }
)

register(
    [
        'FUT Birthday SBC'
    ],
    {
        promoCode: 'FUT_BIRTHDAY',
        family: 'PLAYER',
        originalSource: 'SBC',
        packable: false,
        packTier: 'SPECIAL',
        additionalPools: [
            'FUT_BIRTHDAY_HISTORY'
        ]
    }
)

register(
    [
        'FUTTIES',
        'Futties'
    ],
    {
        promoCode: 'FUTTIES',
        family: 'PLAYER',
        originalSource: 'SPECIAL',
        packable: false,
        packTier: 'SPECIAL',
        additionalPools: [
            'FUTTIES_HISTORY'
        ]
    }
)

register(
    [
        'FUTTIES Winner',
        'Futties Winner',
        'FUTTIES Winners'
    ],
    {
        promoCode: 'FUTTIES',
        family: 'PLAYER',
        originalSource: 'SBC',
        packable: false,
        packTier: 'SPECIAL',
        additionalPools: [
            'FUTTIES_HISTORY'
        ]
    }
)

register(
    [
        'FUT Champions',
        'FUT Champions Reward',
        'FUT Champions Rewards'
    ],
    {
        promoCode: 'FUT_CHAMPIONS',
        family: 'PLAYER',
        originalSource: 'REWARD',
        packable: false,
        packTier: 'PERFORMANCE'
    }
)

register(
    [
        'Award Winner',
        'Award Winners'
    ],
    {
        promoCode: 'AWARD_WINNER',
        family: 'PLAYER',
        originalSource: 'SBC',
        packable: false,
        packTier: 'SPECIAL'
    }
)

register(
    [
        'SBC'
    ],
    {
        promoCode: 'SBC',
        family: 'PLAYER',
        originalSource: 'SBC',
        packable: false,
        packTier: 'SPECIAL'
    }
)

register(
    [
        'SBC Premium',
        'Premium SBC'
    ],
    {
        promoCode: 'SBC_PREMIUM',
        family: 'PLAYER',
        originalSource: 'SBC',
        packable: false,
        packTier: 'SPECIAL'
    }
)

register(
    [
        'Hero',
        'Heroes'
    ],
    {
        promoCode: 'HERO',
        family: 'PLAYER',
        originalSource: 'SPECIAL',
        packable: false,
        packTier: 'SPECIAL'
    }
)

register(
    [
        'GOTM'
    ],
    {
        promoCode: 'GOTM',
        family: 'PLAYER',
        originalSource: 'SPECIAL',
        packable: false,
        packTier: 'PERFORMANCE'
    }
)

register(
    [
        'Confederation Champions MOTM',
        'Confederation Champions Man of the Match'
    ],
    {
        promoCode: 'CONFEDERATION_CHAMPIONS_MOTM',
        family: 'PLAYER',
        originalSource: 'SPECIAL',
        packable: false,
        packTier: 'PERFORMANCE'
    }
)

register(
    [
        'Team of the Tournaments',
        'Team of the Tournament',
        'TOTT'
    ],
    {
        promoCode: 'TEAM_OF_THE_TOURNAMENTS',
        family: 'PLAYER',
        originalSource: 'PACK',
        packable: true,
        packTier: 'PERFORMANCE'
    }
)

register(
    [
        'Legend',
        'Legends'
    ],
    {
        promoCode: 'LEGEND',
        family: 'ICON',
        originalSource: 'PACK',
        packable: true,
        packTier: 'ICON',
        additionalPools: [
            'RETRO_FIFA'
        ]
    }
)

function getMapping(rarityName) {
    return mappings.get(
        normalize(rarityName)
    ) || null
}

function getBaseTier(rating) {
    const value = Number(rating)

    if (!Number.isInteger(value)) {
        return null
    }

    if (value >= 75 && value <= 99) {
        return 'GOLD'
    }

    if (value >= 65 && value <= 74) {
        return 'SILVER'
    }

    if (value >= 1 && value <= 64) {
        return 'BRONZE'
    }

    return null
}

function resolveFifa17Rarity(
    rarityName,
    rating
) {
    const mapping = getMapping(rarityName)

    if (!mapping) {
        return {
            mapped: false,
            rarityName,
            promoCode: null,
            family: null,
            originalSource: null,
            packable: false,
            packTier: null,
            additionalPools: []
        }
    }

    let packTier = mapping.packTier

    const additionalPools = [
        ...mapping.additionalPools
    ]

    if (mapping.promoCode === 'BASE') {
        packTier = getBaseTier(rating)

        if (packTier === 'GOLD') {
            additionalPools.push(
                'RETRO_FIFA'
            )
        }
    } else if (
        !additionalPools.includes(
            'RETRO_FIFA'
        )
    ) {
        additionalPools.push(
            'RETRO_FIFA'
        )
    }

    return {
        mapped: true,
        rarityName,
        promoCode: mapping.promoCode,
        family: mapping.family,
        originalSource:
            mapping.originalSource,
        packable: mapping.packable,
        packTier,
        additionalPools: [
            ...new Set(additionalPools)
        ]
    }
}

function getMappings() {
    return Array.from(
        mappings.entries()
    ).map(
        ([name, config]) => ({
            name,
            ...config
        })
    )
}

module.exports = {
    resolveFifa17Rarity,
    getMapping,
    getBaseTier,
    getMappings
}
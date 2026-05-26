const {

    PhoneNumberUtil,
    PhoneNumberFormat

} = require(
    'google-libphonenumber'
)

// =========================
// INSTANCE
// =========================

const phoneUtil =
    PhoneNumberUtil.getInstance()

// =========================
// FLAGS
// =========================

const flags = {

    MX:'🇲🇽',
    AR:'🇦🇷',
    US:'🇺🇸',
    ES:'🇪🇸',
    CO:'🇨🇴',
    PE:'🇵🇪',
    CL:'🇨🇱',
    VE:'🇻🇪',
    BR:'🇧🇷',
    UY:'🇺🇾',
    PY:'🇵🇾',
    BO:'🇧🇴',
    EC:'🇪🇨',
    CR:'🇨🇷',
    GT:'🇬🇹',
    HN:'🇭🇳',
    NI:'🇳🇮',
    PA:'🇵🇦',
    SV:'🇸🇻',
    DO:'🇩🇴',
    CU:'🇨🇺',
    CA:'🇨🇦',
    FR:'🇫🇷',
    DE:'🇩🇪',
    IT:'🇮🇹',
    JP:'🇯🇵',
    KR:'🇰🇷',
    CN:'🇨🇳',
    RU:'🇷🇺',
    IN:'🇮🇳',
    GB:'🇬🇧',

}

// =========================
// NORMALIZE
// =========================

const normalize = number =>

    String(number || '')
        .replace(/\D/g, '')

// =========================
// GET COUNTRY DATA
// =========================

const getCountryData = number => {

    try {

        // =========================
        // NORMALIZE
        // =========================

        const clean =
            normalize(number)

        if (!clean) {

            return {

                valid: false,
                flag: '🏳️',
                region: 'Unknown',
                code: '',
                international: '',
                national: ''

            }

        }

        // =========================
        // PARSE
        // =========================

        const parsed =
            phoneUtil.parse(
                `+${clean}`
            )

        // =========================
        // VALIDATE
        // =========================

        const valid =
            phoneUtil.isValidNumber(
                parsed
            )

        const region =
            phoneUtil.getRegionCodeForNumber(
                parsed
            ) || 'Unknown'

        // =========================
        // FORMAT
        // =========================

        const international =
            phoneUtil.format(

                parsed,

                PhoneNumberFormat.INTERNATIONAL

            )

        const national =
            phoneUtil.format(

                parsed,

                PhoneNumberFormat.NATIONAL

            )

        // =========================
        // RETURN
        // =========================

        return {

            valid,

            flag:
                flags[region] || '🏳️',

            region,

            code:
                `+${parsed.getCountryCode()}`,

            international,

            national

        }

    } catch {

        return {

            valid: false,
            flag: '🏳️',
            region: 'Unknown',
            code: '',
            international: '',
            national: ''

        }

    }

}

// =========================
// EXPORTS
// =========================

module.exports = {

    getCountryData

}
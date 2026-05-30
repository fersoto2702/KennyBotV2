const {

    PhoneNumberUtil,
    PhoneNumberFormat

} = require(
    'google-libphonenumber'
)

const phoneUtil =
    PhoneNumberUtil.getInstance()

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

const normalize = number =>

    String(number || '')
        .replace(/\D/g, '')

const getCountryData = number => {

    try {

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

        const parsed =
            phoneUtil.parse(
                `+${clean}`
            )

        const valid =
            phoneUtil.isValidNumber(
                parsed
            )

        const region =
            phoneUtil.getRegionCodeForNumber(
                parsed
            ) || 'Unknown'

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

module.exports = {

    getCountryData

}
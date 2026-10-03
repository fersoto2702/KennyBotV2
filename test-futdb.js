const {
    getRarities
} = require('./src/services/futDbService')

async function main() {
    try {
        const response = await getRarities(1)

        console.log(
            JSON.stringify(response, null, 2)
        )
    } catch (error) {
        console.error(
            'ERROR FUT-DB:',
            error.message
        )
    }
}

main()
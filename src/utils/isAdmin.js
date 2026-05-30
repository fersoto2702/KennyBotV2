module.exports = async (

    sock,
    from,
    user

) => {

    try {

        const target =

            user
                ?.split(':')[0]
                ?.trim()

        const metadata =
            await sock.groupMetadata(from)

        return metadata.participants.some(

            participant => {

                const id =

                    participant.id
                        ?.split(':')[0]
                        ?.trim()

                const isAdmin =

                    participant.admin === 'admin' ||

                    participant.admin === 'superadmin'

                return id === target && isAdmin

            }

        )

    } catch {

        return false

    }

}
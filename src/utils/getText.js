const getText = msg => {

    try {

        const message =
            msg?.message

        if (!message)
            return ''

        if (message.conversation) {

            return String(
                message.conversation
            )

        }

        if (
            message.extendedTextMessage?.text
        ) {

            return String(
                message.extendedTextMessage.text
            )

        }

        if (
            message.imageMessage?.caption
        ) {

            return String(
                message.imageMessage.caption
            )

        }

        if (
            message.videoMessage?.caption
        ) {

            return String(
                message.videoMessage.caption
            )

        }

        if (
            message.documentMessage?.caption
        ) {

            return String(
                message.documentMessage.caption
            )

        }

        if (
            message.buttonsResponseMessage
                ?.selectedButtonId
        ) {

            return String(

                message.buttonsResponseMessage
                    .selectedButtonId

            )

        }

        if (
            message.listResponseMessage
                ?.singleSelectReply
                ?.selectedRowId
        ) {

            return String(

                message.listResponseMessage
                    .singleSelectReply
                    .selectedRowId

            )

        }

        if (
            message.templateButtonReplyMessage
                ?.selectedId
        ) {

            return String(

                message.templateButtonReplyMessage
                    .selectedId

            )

        }

        if (
            message.viewOnceMessage
                ?.message
        ) {

            return getText({

                message:
                    message.viewOnceMessage
                        .message

            })

        }

        if (
            message.ephemeralMessage
                ?.message
        ) {

            return getText({

                message:
                    message.ephemeralMessage
                        .message

            })

        }

        return ''

    } catch {

        return ''

    }

}

module.exports =
    getText
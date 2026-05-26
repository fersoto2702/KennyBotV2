const getText = msg => {

    try {

        // =========================
        // MESSAGE
        // =========================

        const message =
            msg?.message

        if (!message)
            return ''

        // =========================
        // NORMAL
        // =========================

        if (message.conversation) {

            return String(
                message.conversation
            )

        }

        // =========================
        // EXTENDED
        // =========================

        if (
            message.extendedTextMessage?.text
        ) {

            return String(
                message.extendedTextMessage.text
            )

        }

        // =========================
        // IMAGE
        // =========================

        if (
            message.imageMessage?.caption
        ) {

            return String(
                message.imageMessage.caption
            )

        }

        // =========================
        // VIDEO
        // =========================

        if (
            message.videoMessage?.caption
        ) {

            return String(
                message.videoMessage.caption
            )

        }

        // =========================
        // DOCUMENT
        // =========================

        if (
            message.documentMessage?.caption
        ) {

            return String(
                message.documentMessage.caption
            )

        }

        // =========================
        // BUTTONS
        // =========================

        if (
            message.buttonsResponseMessage
                ?.selectedButtonId
        ) {

            return String(

                message.buttonsResponseMessage
                    .selectedButtonId

            )

        }

        // =========================
        // LISTS
        // =========================

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

        // =========================
        // TEMPLATE BUTTON
        // =========================

        if (
            message.templateButtonReplyMessage
                ?.selectedId
        ) {

            return String(

                message.templateButtonReplyMessage
                    .selectedId

            )

        }

        // =========================
        // VIEW ONCE
        // =========================

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

        // =========================
        // EPHEMERAL
        // =========================

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
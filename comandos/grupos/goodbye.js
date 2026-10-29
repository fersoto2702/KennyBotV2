const isGroupAdmin =

    require('../../src/utils/isAdmin')

const logger =

    require('../../src/utils/logger')

    const ui =

    require('../../src/utils/ui')

    const welcomeSystem =

    require('../../src/system/welcomeSystem')
function normalizeJid(

    jid

) {



    if (!jid) {



        return null



    }



    return String(

        jid

    )

        .trim()

        .replace(

            /:\d+@/,

            '@'

        )



}



function getBotName(

    sock

) {



    return String(

        sock?.botProfile?.name ||

        'KennyBot'

    )

        .trim()



}



async function sendMessage(

    sock,

    jid,

    content

) {



    if (

        typeof sock.safeSendMessage ===

        'function'

    ) {



        return await sock.safeSendMessage(

            jid,

            content

        )



    }



    return await sock.sendMessage(

        jid,

        content

    )



}



module.exports = {



    name:

        'goodbye',



    aliases: [

        'despedida',

        'despedidas',

        'goodbyemsg'

    ],



    description:

        'Activa o desactiva el mensaje de despedida',



    category:

        'grupos',



    adminOnly:

        true,



    groupOnly:

        true,



    async execute({



        sock,

        from,

        args,

        msg,

        prefix = '.'



    }) {



        try {



            if (

                !from ||

                !from.endsWith(

                    '@g.us'

                )

            ) {



                return await sendMessage(

                    sock,

                    from,

                    {

                        text:

                            ui.error(

                                'SOLO GRUPOS',

                                'Este comando solo funciona dentro de grupos.'

                            )

                    }

                )



            }



            const sender =

                normalizeJid(



                    msg?.key?.fromMe



                        ? (

                            sock?.user?.lid ||

                            sock?.user?.id

                        )



                        : (

                            msg?.key?.participant ||

                            msg?.participant ||

                            msg?.key?.remoteJid

                        )



                )



            if (

                !sender

            ) {



                return await sendMessage(

                    sock,

                    from,

                    {

                        text:

                            ui.error(

                                'ERROR DE USUARIO',

                                'No se pudo identificar al usuario.'

                            )

                    }

                )



            }



            const admin =

                await isGroupAdmin(

                    sock,

                    from,

                    sender

                )



            if (

                !admin

            ) {



                return await sendMessage(

                    sock,

                    from,

                    {

                        text:

                            ui.error(

                                'ACCESO DENEGADO',

                                'Solo los administradores pueden cambiar las despedidas.'

                            )

                    }

                )



            }



            const config =

                welcomeSystem.getGroupConfig(

                    from

                )



            const option =

                String(

                    args?.[0] ||

                    ''

                )

                    .trim()

                    .toLowerCase()



            const botName =

                getBotName(

                    sock

                )



            if (

                [

                    'on',

                    'activar',

                    'activa',

                    'enable',

                    '1',

                    'true'

                ].includes(

                    option

                )

            ) {



                if (

                    config.goodbye

                ) {



                    return await sendMessage(

                        sock,

                        from,

                        {

                            text:

                                ui.info(

                                    '🚪 GOODBYE',

                                    [

                                        [

                                            'Estado',

                                            '● ACTIVADO'

                                        ],

                                        [

                                            'Configurado por',

                                            `@${sender.split('@')[0]}`

                                        ]

                                    ],

                                    'El mensaje de despedida ya estaba activado.'

                                ),



                            mentions: [

                                sender

                            ]

                        }

                    )



                }



                const success =

                    welcomeSystem.setGoodbyeEnabled(

                        from,

                        true

                    )



                if (

                    !success

                ) {



                    throw new Error(

                        'No se pudo guardar la configuración de despedida.'

                    )



                }



                logger.event(

                    `${botName} | Goodbye ON | ${from.split('@')[0]} | ${sender.split('@')[0]}`

                )



                return await sendMessage(

                    sock,

                    from,

                    {

                        text:

                            ui.success(

                                '🚪 GOODBYE ACTIVADO',

                                [

                                    [

                                        'Estado',

                                        '● ACTIVADO'

                                    ],

                                    [

                                        'Configurado por',

                                        `@${sender.split('@')[0]}`

                                    ]

                                ],

                                `${botName} enviará un mensaje cuando un miembro salga del grupo.`

                            ),



                        mentions: [

                            sender

                        ]

                    }

                )



            }



            if (

                [

                    'off',

                    'desactivar',

                    'desactiva',

                    'disable',

                    '0',

                    'false'

                ].includes(

                    option

                )

            ) {



                if (

                    !config.goodbye

                ) {



                    return await sendMessage(

                        sock,

                        from,

                        {

                            text:

                                ui.info(

                                    '🚪 GOODBYE',

                                    [

                                        [

                                            'Estado',

                                            '○ DESACTIVADO'

                                        ],

                                        [

                                            'Configurado por',

                                            `@${sender.split('@')[0]}`

                                        ]

                                    ],

                                    'La despedida ya estaba desactivada.'

                                ),



                            mentions: [

                                sender

                            ]

                        }

                    )



                }



                const success =

                    welcomeSystem.setGoodbyeEnabled(

                        from,

                        false

                    )



                if (

                    !success

                ) {



                    throw new Error(

                        'No se pudo guardar la configuración de despedida.'

                    )



                }



                logger.event(

                    `${botName} | Goodbye OFF | ${from.split('@')[0]} | ${sender.split('@')[0]}`

                )



                return await sendMessage(

                    sock,

                    from,

                    {

                        text:

                            ui.success(

                                '🚪 GOODBYE DESACTIVADO',

                                [

                                    [

                                        'Estado',

                                        '○ DESACTIVADO'

                                    ],

                                    [

                                        'Configurado por',

                                        `@${sender.split('@')[0]}`

                                    ]

                                ],

                                `${botName} dejó de enviar mensajes de despedida.`

                            ),



                        mentions: [

                            sender

                        ]

                    }

                )



            }



            return await sendMessage(

                sock,

                from,

                {

                    text:

                        ui.info(

                            '🚪 GOODBYE DEL GRUPO',

                            [

                                [

                                    'Estado',

                                    config.goodbye

                                        ? '● ACTIVADO'

                                        : '○ DESACTIVADO'

                                ],

                                [

                                    'Bot',

                                    botName

                                ]

                            ],

                            [

                                'Uso:',

                                `${prefix}goodbye on`,

                                `${prefix}goodbye off`,

                                '',

                                'Mensaje personalizado:',

                                `${prefix}setgoodbye <mensaje>`

                            ]

                                .join(

                                    '\n'

                                )

                        )

                }

            )



        } catch (err) {



            logger.error(

                `${getBotName(sock)} | Error goodbye: ${err.stack || err.message}`

            )



            try {



                await sendMessage(

                    sock,

                    from,

                    {

                        text:

                            ui.error(

                                'ERROR DE GOODBYE',

                                'No se pudo cambiar el estado de la despedida.'

                            )

                    }

                )



            } catch {}



            return false



        }



    }



}
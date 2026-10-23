const fs =
    require('fs')

const path =
    require('path')

const ExcelJS =
    require('exceljs')

const logger =
    require('../../src/utils/logger')

const ui =
    require('../../src/utils/ui')

const {
    getAllStats
} = require('../../src/database/mysql')


const tempPath =
    path.join(
        __dirname,
        '../../temp'
    )


function ensureTempDirectory() {

    if (
        !fs.existsSync(
            tempPath
        )
    ) {

        fs.mkdirSync(
            tempPath,
            {
                recursive: true
            }
        )

    }

}


function removeTempFile(
    filePath
) {

    try {

        if (
            filePath &&
            fs.existsSync(
                filePath
            )
        ) {

            fs.unlinkSync(
                filePath
            )

            logger.info(
                `Temp eliminado: ${path.basename(filePath)}`
            )

        }

    } catch (err) {

        logger.warn(
            `Error borrando temp: ${err.message}`
        )

    }

}


function formatDate(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {

        return 'Sin datos'

    }


    try {

        /*
            Si MySQL devuelve timestamp
            numérico, lo convertimos.
        */

        const numeric =
            Number(value)


        const date =
            Number.isFinite(numeric)
                ? new Date(numeric)
                : new Date(value)


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return String(
                value
            )

        }


        return date.toLocaleString(
            'es-MX'
        )

    } catch {

        return String(
            value
        )

    }

}


module.exports = {

    name:
        'exportstats',

    aliases: [
        'excelstats',
        'statsexcel'
    ],

    description:
        'Exporta estadísticas a Excel',

    category:
        'general',

    adminOnly:
        true,
async execute({

        sock,
        from,
        args

    }) {

        let filePath =
            null


        try {

            /* ─────────────────────────────
               SOLO GRUPOS
            ───────────────────────────── */

            if (
                !from.endsWith(
                    '@g.us'
                )
            ) {

                return await sock.sendMessage(

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


            /* ─────────────────────────────
               PERÍODO
            ───────────────────────────── */

            const days =
                Number.parseInt(
                    args?.[0] || '30',
                    10
                )


            if (
                !Number.isFinite(days) ||
                days < 1 ||
                days > 365
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'DÍAS INVÁLIDOS',

                                'Usa un número entre 1 y 365.\n\nEjemplo: /exportstats 30'

                            )

                    }

                )

            }


            /* ─────────────────────────────
               AVISO
            ───────────────────────────── */

            await sock.sendMessage(

                from,

                {

                    text:
                        ui.info(

                            '📊 EXPORTANDO ESTADÍSTICAS',

                            [

                                [
                                    'Período',
                                    `📅 Últimos ${days} días`
                                ],

                                [
                                    'Formato',
                                    'Excel (.xlsx)'
                                ],

                                [
                                    'Estado',
                                    '⏳ GENERANDO'
                                ]

                            ],

                            'Recopilando datos del grupo...'

                        )

                }

            )


            /* ─────────────────────────────
               ESTADÍSTICAS
            ───────────────────────────── */

            const stats =
                await getAllStats(
                    from,
                    days
                )


            if (
                !Array.isArray(stats) ||
                stats.length === 0
            ) {

                return await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.warn(

                                'SIN DATOS',

                                `No hay estadísticas registradas de los últimos ${days} días.`

                            )

                    }

                )

            }


            /* ─────────────────────────────
               TEMP
            ───────────────────────────── */

            ensureTempDirectory()


            /* ─────────────────────────────
               EXCEL
            ───────────────────────────── */

            const workbook =
                new ExcelJS.Workbook()


            workbook.creator =
                'KennyBot V2'


            workbook.created =
                new Date()


            const sheet =
                workbook.addWorksheet(
                    'Estadísticas'
                )


            sheet.columns = [

                {
                    header:
                        '#',

                    key:
                        'rank',

                    width:
                        6
                },

                {
                    header:
                        'Usuario',

                    key:
                        'usuario',

                    width:
                        28
                },

                {
                    header:
                        'Mensajes',

                    key:
                        'total',

                    width:
                        15
                },

                {
                    header:
                        'Último mensaje',

                    key:
                        'ultimo',

                    width:
                        26
                },

                {
                    header:
                        'Primer registro',

                    key:
                        'primera',

                    width:
                        26
                }

            ]


            /* ─────────────────────────────
               ENCABEZADO
            ───────────────────────────── */

            const header =
                sheet.getRow(
                    1
                )


            header.height =
                22


            header.eachCell(

                cell => {

                    cell.font = {

                        bold:
                            true,

                        color: {
                            argb:
                                'FFFFFFFF'
                        }

                    }


                    cell.fill = {

                        type:
                            'pattern',

                        pattern:
                            'solid',

                        fgColor: {
                            argb:
                                'FF1565C0'
                        }

                    }


                    cell.alignment = {

                        horizontal:
                            'center',

                        vertical:
                            'middle'

                    }

                }

            )


            /* ─────────────────────────────
               FILAS
            ───────────────────────────── */

            stats.forEach(

                (user, index) => {

                    const jid =
                        String(
                            user.usuario || ''
                        )


                    const usuario =
                        jid.includes('@')
                            ? jid.split('@')[0]
                            : jid || 'Desconocido'


                    const total =
                        Number.isFinite(
                            Number(
                                user.total
                            )
                        )
                            ? Number(
                                user.total
                            )
                            : 0


                    const ultimo =
                        formatDate(
                            user.ultimo
                        )


                    const primera =
                        formatDate(
                            user.primera_fecha
                        )


                    const row =
                        sheet.addRow({

                            rank:
                                index + 1,

                            usuario,

                            total,

                            ultimo,

                            primera

                        })


                    row.alignment = {
                        vertical:
                            'middle'
                    }


                    /*
                        Filas alternadas.
                    */

                    if (
                        index % 2 === 0
                    ) {

                        row.eachCell(

                            cell => {

                                cell.fill = {

                                    type:
                                        'pattern',

                                    pattern:
                                        'solid',

                                    fgColor: {
                                        argb:
                                            'FFF5F5F5'
                                    }

                                }

                            }

                        )

                    }

                }

            )


            /* ─────────────────────────────
               FORMATO ADICIONAL
            ───────────────────────────── */

            sheet.getColumn(
                'rank'
            )
                .alignment = {
                    horizontal:
                        'center'
                }


            sheet.getColumn(
                'total'
            )
                .numFmt =
                    '#,##0'


            sheet.getColumn(
                'total'
            )
                .alignment = {
                    horizontal:
                        'center'
                }


            sheet.views = [

                {
                    state:
                        'frozen',

                    ySplit:
                        1
                }

            ]


            sheet.autoFilter = {

                from:
                    'A1',

                to:
                    'E1'

            }


            /* ─────────────────────────────
               ARCHIVO
            ───────────────────────────── */

            const groupName =
                from
                    .split('@')[0]
                    .replace(
                        /[^a-zA-Z0-9_-]/g,
                        ''
                    )


            const fileName =
                `stats_${groupName}_${days}dias_${Date.now()}.xlsx`


            filePath =
                path.join(
                    tempPath,
                    fileName
                )


            await workbook.xlsx.writeFile(
                filePath
            )


            /* ─────────────────────────────
               VALIDAR ARCHIVO
            ───────────────────────────── */

            if (
                !fs.existsSync(
                    filePath
                )
            ) {

                throw new Error(
                    'El archivo Excel no fue generado'
                )

            }


            const fileStats =
                fs.statSync(
                    filePath
                )


            /* ─────────────────────────────
               ENVIAR
            ───────────────────────────── */

            await sock.sendMessage(

                from,

                {

                    document:
                        fs.readFileSync(
                            filePath
                        ),

                    fileName,

                    mimetype:
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

                    caption:
                        ui.success(

                            '📊 EXCEL GENERADO',

                            [

                                [
                                    'Período',
                                    `📅 Últimos ${days} días`
                                ],

                                [
                                    'Usuarios',
                                    `👥 ${stats.length}`
                                ],

                                [
                                    'Archivo',
                                    fileName
                                ],

                                [
                                    'Tamaño',
                                    `${(
                                        fileStats.size /
                                        1024
                                    ).toFixed(1)} KB`
                                ]

                            ],

                            'Las estadísticas fueron exportadas correctamente.'

                        )

                }

            )


            logger.event(

                `ExportStats: ${from.split('@')[0]} → ${stats.length} usuarios | ${days} días`

            )


        } catch (err) {

            logger.error(

                `ExportStats Error: ${err.stack || err.message}`

            )


            try {

                await sock.sendMessage(

                    from,

                    {

                        text:
                            ui.error(

                                'ERROR DE EXPORTACIÓN',

                                'No se pudo generar el archivo Excel.'

                            )

                    }

                )

            } catch {}


        } finally {

            /*
                El Excel temporal se elimina
                aunque falle su envío.
            */

            if (
                filePath
            ) {

                removeTempFile(
                    filePath
                )

            }

        }

    }

}
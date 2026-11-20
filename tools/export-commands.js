/*
    Exporta los comandos de KennyBotV2 en el formato del panel.

    Uso (desde la raíz del bot):

        node export-commands.js comandos

    Crea commands.json con { name, cat, folder, uses, on }.
    Los archivos sueltos en la raíz de /comandos se reparten entre
    "Cartas" y "Utilidad" según la lista de abajo.
*/

const { readdirSync, statSync, writeFileSync } = require( 'fs' )
const { basename, extname, join } = require( 'path' )


const ROOT = process.argv[ 2 ] || 'comandos'


const LABELS = {

    admin: 'Admin',
    config: 'Configuración',
    diversion: 'Diversión',
    downloads: 'Descargas',
    economy: 'Economía',
    general: 'General',
    grupos: 'Grupos',
    levels: 'Niveles',
    premium: 'Premium',
    profile: 'Perfil',
    welcome: 'Bienvenida',

}


const CARTAS = [

    'card', 'cardinfo', 'claim', 'collection', 'equip', 'events',
    'myclub', 'objectives', 'openpack', 'packs', 'pick',

]


const out = []


for ( const entry of readdirSync( ROOT ) ) {

    const full = join( ROOT, entry )

    if ( statSync( full ).isDirectory() ) {

        for ( const file of readdirSync( full ) ) {

            if ( extname( file ) === '.js' ) {

                out.push( {

                    name: basename( file, '.js' ),
                    cat: LABELS[ entry ] || entry,
                    folder: entry,
                    uses: 0,
                    on: true,

                } )

            }

        }

    } else if ( extname( entry ) === '.js' ) {

        const name = basename( entry, '.js' )

        out.push( {

            name,
            cat: CARTAS.includes( name ) ? 'Cartas' : 'Utilidad',
            folder: '(raíz)',
            uses: 0,
            on: true,

        } )

    }

}


writeFileSync( 'commands.json', JSON.stringify( out, null, 4 ) )

console.log( `${ out.length } comandos en ${ new Set( out.map( ( c ) => c.cat ) ).size } categorías → commands.json` )

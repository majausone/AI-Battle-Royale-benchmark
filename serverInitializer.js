import { getDatabase } from './database.js';

export async function initServer(server, port) {
    try {
        await getDatabase();

        server.listen(port, () => {
            console.log(`Servidor iniciado en puerto ${port}`);
        });
    } catch (error) {
        console.error('Error al iniciar el servidor:', error);
        process.exit(1);
    }
}
import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const handleAsyncRoute = (fn) => async (req, res) => {
    try {
        const result = await fn(req, res);
        if (result) {
            res.json(result);
        }
    } catch (error) {
        console.error('Error en ruta:', error.message, error.stack);
        res.status(500).json({
            error: error.message || 'Error interno del servidor',
            details: error.toString(),
            stack: error.stack
        });
    }
};

async function loadFilesFromDirectory(directory, extension) {
    try {
        const dir = join(__dirname, 'public', directory);
        const files = await fs.readdir(dir);
        const items = {};

        for (const file of files) {
            if (file.endsWith(extension)) {
                const content = await fs.readFile(join(dir, file), 'utf8');
                const key = file.replace(extension, '');
                items[key] = extension === '.json' ? JSON.parse(content) : content;
            }
        }

        return items;
    } catch (error) {
        throw error;
    }
}

async function saveFile(directory, fileName, content) {
    try {
        const filePath = join(__dirname, 'public', directory, fileName);
        const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 4);
        await fs.writeFile(filePath, fileContent);
        return true;
    } catch (error) {
        throw error;
    }
}

export function setupRouteFX(app) {
    app.get('/api/fx', handleAsyncRoute(async () => {
        return await loadFilesFromDirectory('fx', '.js');
    }));

    app.put('/api/fx/:id', handleAsyncRoute(async (req) => {
        await saveFile('fx', `${req.params.id}.js`, req.body.content);
        return { success: true };
    }));
}
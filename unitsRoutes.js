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

export function setupRouteUnits(app) {
    app.get('/api/units', handleAsyncRoute(async () => {
        const items = await loadFilesFromDirectory('units', '.json');
        return Object.values(items);
    }));

    app.get('/api/units/:id', handleAsyncRoute(async (req) => {
        try {
            const unitId = req.params.id;
            const filePath = join(__dirname, 'public', 'units', `${unitId}.json`);
            const content = await fs.readFile(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Unit with ID ${req.params.id} not found`);
            }
            throw error;
        }
    }));

    app.put('/api/units/:id', handleAsyncRoute(async (req) => {
        await saveFile('units', `${req.params.id}.json`, req.body);
        return { success: true };
    }));

    app.post('/api/units', handleAsyncRoute(async (req) => {
        await saveFile('units', `${req.body.id}.json`, req.body);
        return { success: true };
    }));

    app.delete('/api/units/:id', handleAsyncRoute(async (req) => {
        const filePath = join(__dirname, 'public', 'units', `${req.params.id}.json`);
        await fs.unlink(filePath);
        return { success: true };
    }));
}
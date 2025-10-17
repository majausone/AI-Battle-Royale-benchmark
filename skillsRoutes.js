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

export function setupRouteSkills(app) {
    app.get('/api/skills', handleAsyncRoute(async () => {
        return await loadFilesFromDirectory('skills', '.js');
    }));

    app.get('/api/skills/:id', async (req, res) => {
        try {
            const skillId = req.params.id;
            const filePath = join(__dirname, 'public', 'skills', `${skillId}.js`);
            const content = await fs.readFile(filePath, 'utf8');
            
            const normalizedContent = content.replace(/\r\n/g, '\n');
            
            res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
            res.setHeader('Content-Disposition', 'inline');
            res.send(normalizedContent);
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.status(404).json({
                    error: `Skill with ID ${req.params.id} not found`
                });
            } else {
                console.error('Error en ruta:', error.message, error.stack);
                res.status(500).json({
                    error: error.message || 'Error interno del servidor',
                    details: error.toString(),
                    stack: error.stack
                });
            }
        }
    });

    app.put('/api/skills/:id', handleAsyncRoute(async (req) => {
        await saveFile('skills', `${req.params.id}.js`, req.body.content);
        return { success: true };
    }));
}
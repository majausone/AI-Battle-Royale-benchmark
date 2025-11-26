import express from 'express';
import cors from 'cors';
import { join } from 'path';

export function setupMiddleware(app, dirname) {
    app.use(cors());
    // Allow large prompts/payloads for LLM interactions (adapt prices, etc.)
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    app.use((req, res, next) => {
        if (req.url.endsWith('.js')) {
            res.type('application/javascript');
        }
        next();
    });

    app.use(express.static('public', {
        setHeaders: (res, path) => {
            if (path.endsWith('.js')) {
                res.setHeader('Content-Type', 'application/javascript');
            }
        }
    }));
}

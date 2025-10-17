import express from 'express';
import cors from 'cors';
import { join } from 'path';

export function setupMiddleware(app, dirname) {
    app.use(cors());
    app.use(express.json());

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
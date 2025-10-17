import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { setupMiddleware } from './middlewareSetup.js';
import { setupRouteUnits } from './unitsRoutes.js';
import { setupRouteFX } from './fxRoutes.js';
import { setupRouteSkills } from './skillsRoutes.js';
import { setupRouteSeffects } from './specialEffectsRoutes.js';
import { setupRouteConfig } from './configRoutes.js';
import { setupRouteConfig2 } from './configHandlers.js';
import { setupRouteAITest } from './aiTestRoutes.js';
import { setupRouteAIPrompt } from './aiPromptRoutes.js';
import { setupRouteConfig2AIService } from './aiServiceConfigRoutes.js';
import { setupRouteConfig2GameSettings } from './gameSettingsRoutes.js';
import { setupRouteConfig2Teams } from './teamsRoutes.js';
import { setupRouteConfig2AIServices } from './aiServicesRoutes.js';
import { setupRouteConfig2Display } from './displaySettingsRoutes.js';
import { setupRouteConfig2Round } from './roundDataRoutes.js';
import { setupSocketHandlers } from './socketHandlers.js';
import { initServer } from './serverInitializer.js';
import { setupRouteStats } from './statsRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;
const server = http.createServer(app);
const io = new Server(server);

setupMiddleware(app, __dirname);

setupRouteUnits(app);
setupRouteFX(app);
setupRouteSkills(app);
setupRouteSeffects(app);
setupRouteConfig(app);
setupRouteConfig2(app);
setupRouteAITest(app);
setupRouteAIPrompt(app);
setupRouteConfig2AIService(app);
setupRouteConfig2GameSettings(app);
setupRouteConfig2Teams(app);
setupRouteConfig2AIServices(app);
setupRouteConfig2Display(app);
setupRouteConfig2Round(app);
setupRouteStats(app);

app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'index.html'));
});

setupSocketHandlers(io);
initServer(server, port);

export { app, server, io, __dirname };
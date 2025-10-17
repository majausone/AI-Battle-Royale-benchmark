import {
    getGameSettings,
    createGameSettings,
    updateGameSettings
} from './database.js';

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

const defaultConfig = {
    gameSettings: {
        initialGold: 1000,
        numRounds: 3,
        errorPenalty: 100,
        maxErrors: 3
    }
};

export function setupRouteConfig2GameSettings(app) {
    app.post('/api/config2/game-settings', handleAsyncRoute(async (req) => {
        const settings = req.body;

        try {
            const existingSettings = await getGameSettings();

            if (existingSettings && existingSettings.length > 0) {
                const current = existingSettings[0];
                const newSettings = {
                    initial_gold: settings.initialGold !== undefined ? settings.initialGold : current.initial_gold,
                    num_rounds: settings.numRounds !== undefined ? settings.numRounds : current.num_rounds,
                    error_penalty: settings.errorPenalty !== undefined ? settings.errorPenalty : current.error_penalty,
                    max_errors: settings.maxErrors !== undefined ? settings.maxErrors : current.max_errors
                };

                await updateGameSettings(current.id, newSettings.initial_gold, newSettings.num_rounds, newSettings.error_penalty, newSettings.max_errors);
            } else {
                await createGameSettings(
                    settings.initialGold || defaultConfig.gameSettings.initialGold,
                    settings.numRounds || defaultConfig.gameSettings.numRounds,
                    settings.errorPenalty || defaultConfig.gameSettings.errorPenalty,
                    settings.maxErrors || defaultConfig.gameSettings.maxErrors
                );
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating game settings:', error);
            throw error;
        }
    }));
}
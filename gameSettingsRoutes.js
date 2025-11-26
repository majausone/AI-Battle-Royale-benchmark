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
        unitsNumber: 3,
        promptMode: 'normal'
    }
};

const legacyDefaults = {
    errorPenalty: 100,
    maxErrors: 3
};

export function setupRouteConfig2GameSettings(app) {
    app.post('/api/config2/game-settings', handleAsyncRoute(async (req) => {
        const settings = req.body;

        try {
            const existingSettings = await getGameSettings();

            if (existingSettings && existingSettings.length > 0) {
                const current = existingSettings[0];
                const initialGold = settings.initialGold !== undefined ? settings.initialGold : current.initial_gold;
                const numRounds = settings.numRounds !== undefined ? settings.numRounds : current.num_rounds;
                const unitsNumber = settings.unitsNumber !== undefined
                    ? settings.unitsNumber
                    : (current.units_number !== undefined ? current.units_number : defaultConfig.gameSettings.unitsNumber);
                const errorPenalty = current.error_penalty !== undefined ? current.error_penalty : legacyDefaults.errorPenalty;
                const maxErrors = current.max_errors !== undefined ? current.max_errors : legacyDefaults.maxErrors;
                const rawPromptMode = (settings.promptMode ?? current.prompt_mode ?? defaultConfig.gameSettings.promptMode).toString().toLowerCase();
                const promptMode = ['normal', 'crazy', 'boss'].includes(rawPromptMode) ? rawPromptMode : defaultConfig.gameSettings.promptMode;

                await updateGameSettings(current.id, initialGold, numRounds, errorPenalty, maxErrors, unitsNumber, promptMode);
            } else {
                const rawPromptMode = (settings.promptMode ?? defaultConfig.gameSettings.promptMode).toString().toLowerCase();
                const promptMode = ['normal', 'crazy', 'boss'].includes(rawPromptMode) ? rawPromptMode : defaultConfig.gameSettings.promptMode;

                await createGameSettings(
                    settings.initialGold || defaultConfig.gameSettings.initialGold,
                    settings.numRounds || defaultConfig.gameSettings.numRounds,
                    legacyDefaults.errorPenalty,
                    legacyDefaults.maxErrors,
                    settings.unitsNumber || defaultConfig.gameSettings.unitsNumber,
                    promptMode
                );
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating game settings:', error);
            throw error;
        }
    }));
}

import {
    getDisplaySettings,
    createDisplaySettings,
    updateDisplaySettings
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

export function setupRouteConfig2Display(app) {
    app.post('/api/config2/display', handleAsyncRoute(async (req) => {
        try {
            const displaySettings = await getDisplaySettings();

            if (displaySettings && displaySettings.length > 0) {
                const current = displaySettings[0];

                const newSettings = {
                    show_fps_counter: req.body.showFpsCounter !== undefined ?
                        (req.body.showFpsCounter ? 1 : 0) : current.show_fps_counter,
                    show_units_counter: req.body.showUnitsCounter !== undefined ?
                        (req.body.showUnitsCounter ? 1 : 0) : current.show_units_counter,
                    show_game_speed_indicator: req.body.showGameSpeedIndicator !== undefined ?
                        (req.body.showGameSpeedIndicator ? 1 : 0) : current.show_game_speed_indicator,
                    volume: req.body.volume !== undefined ?
                        req.body.volume : current.volume,
                    game_speed: req.body.gameSpeed !== undefined ?
                        req.body.gameSpeed : current.game_speed
                };

                await updateDisplaySettings(
                    current.id,
                    newSettings.show_fps_counter,
                    newSettings.show_units_counter,
                    newSettings.show_game_speed_indicator,
                    newSettings.volume,
                    newSettings.game_speed
                );
            } else {
                await createDisplaySettings(
                    req.body.showFpsCounter !== undefined ? req.body.showFpsCounter : false,
                    req.body.showUnitsCounter !== undefined ? req.body.showUnitsCounter : false,
                    req.body.showGameSpeedIndicator !== undefined ? req.body.showGameSpeedIndicator : false,
                    req.body.volume !== undefined ? req.body.volume : 50,
                    req.body.gameSpeed !== undefined ? req.body.gameSpeed : 1.0
                );
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating display settings:', error);
            throw error;
        }
    }));
}
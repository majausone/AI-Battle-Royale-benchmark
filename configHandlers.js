import {
    getDatabase,
    getGameSettings,
    getTeams,
    getAIServices,
    getTeamAIs,
    getAIAvailableUnits,
    getAIPurchasedUnits,
    getDisplaySettings,
    getMatchStates,
    getRoundHistory,
    getRoundWins
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
    },
    teams: [],
    aiServices: [{
        name: "Claude 3.5 Sonnet",
        type: "claude",
        endpoint: "https://api.anthropic.com/v1/messages",
        apiKey: "",
        model: "claude-3-5-sonnet-20241022",
        isActive: true
    }, {
        name: "ChatGPT",
        type: "chatgpt",
        endpoint: "https://api.openai.com/v1/chat/completions",
        apiKey: "",
        model: "gpt-3.5-turbo",
        isActive: true,
        reasoning: false
    }, {
        name: "DeepSeek R1",
        type: "deepseek",
        endpoint: "https://api.deepseek.com/v1/chat/completions",
        apiKey: "",
        model: "deepseek-r1-large",
        isActive: true,
        mirror: false
    }, {
        name: "Google Gemini",
        type: "gemini",
        endpoint: "https://generativelanguage.googleapis.com",
        apiKey: "",
        model: "gemini-1.5-flash",
        isActive: true
    }, {
        name: "Grok 4 Fast",
        type: "grok",
        endpoint: "https://api.x.ai/v1/chat/completions",
        apiKey: "",
        model: "grok-4-fast",
        isActive: true
    }],
    display: {
        showFpsCounter: false,
        showUnitsCounter: false,
        volume: 50
    },
    currentRound: 1,
    roundHistory: [],
    roundWins: {}
};

export function setupRouteConfig2(app) {
    app.get('/api/config2', handleAsyncRoute(async () => {
        const dbConfig = {
            gameSettings: {},
            teams: [],
            aiServices: [],
            display: {},
            currentRound: 1,
            roundHistory: [],
            roundWins: {}
        };

        try {
            const [
                gameSettingsResult,
                teamsResult,
                aiServicesResult,
                displaySettingsResult,
                matchStatesResult,
                roundHistoryResult,
                roundWinsResult
            ] = await Promise.all([
                getGameSettings(),
                getTeams(),
                getAIServices(),
                getDisplaySettings(),
                getMatchStates(),
                getRoundHistory(),
                getRoundWins()
            ]);

            if (gameSettingsResult && gameSettingsResult.length > 0) {
                const gs = gameSettingsResult[0];
                dbConfig.gameSettings = {
                    initialGold: gs.initial_gold,
                    numRounds: gs.num_rounds,
                    errorPenalty: gs.error_penalty,
                    maxErrors: gs.max_errors
                };
            } else {
                dbConfig.gameSettings = defaultConfig.gameSettings;
            }

            if (teamsResult && teamsResult.length > 0) {
                const teamsAIPromises = teamsResult.map(async team => {
                    const teamAIs = await getTeamAIs();
                    const teamAIsFiltered = teamAIs.filter(ai => ai.team_id === team.team_id);

                    const aisPromises = teamAIsFiltered.map(async teamAI => {
                        const availableUnits = await getAIAvailableUnits();
                        const availableUnitsFiltered = availableUnits
                            .filter(unit => unit.team_ai_id === teamAI.ai_id)
                            .map(unit => unit.unit_id);

                        const purchasedUnits = await getAIPurchasedUnits();
                        const purchasedUnitsFiltered = purchasedUnits
                            .filter(unit => unit.team_ai_id === teamAI.ai_id)
                            .map(unit => ({
                                id: unit.unit_id,
                                quantity: unit.quantity
                            }));

                        return {
                            id: teamAI.ai_id,
                            service_id: teamAI.service_id,
                            availableUnits: availableUnitsFiltered,
                            purchasedUnits: purchasedUnitsFiltered
                        };
                    });

                    const ais = await Promise.all(aisPromises);

                    return {
                        id: team.team_id,
                        name: team.name,
                        color: team.color,
                        isAvailable: team.is_available === 1,
                        ais: ais
                    };
                });

                dbConfig.teams = await Promise.all(teamsAIPromises);
            }

            if (aiServicesResult && aiServicesResult.length > 0) {
                dbConfig.aiServices = aiServicesResult.map(service => ({
                    service_id: service.service_id,
                    name: service.name,
                    type: service.type,
                    endpoint: service.endpoint,
                    apiKey: service.api_key,
                    model: service.model,
                    isActive: service.is_active === 1,
                    thinking: service.is_thinking === 1,
                    reasoning: service.is_reasoning === 1,
                    mirror: service.is_mirror === 1
                }));
            } else {
                dbConfig.aiServices = defaultConfig.aiServices;
            }

            if (displaySettingsResult && displaySettingsResult.length > 0) {
                const ds = displaySettingsResult[0];
                dbConfig.display = {
                    showFpsCounter: ds.show_fps_counter === 1,
                    showUnitsCounter: ds.show_units_counter === 1,
                    showGameSpeedIndicator: ds.show_game_speed_indicator === 1,
                    volume: ds.volume,
                    gameSpeed: ds.game_speed
                };
            } else {
                dbConfig.display = defaultConfig.display;
            }

            if (matchStatesResult && matchStatesResult.length > 0) {
                const ms = matchStatesResult[0];
                dbConfig.currentRound = ms.current_round;
            }

            if (roundHistoryResult && roundHistoryResult.length > 0) {
                dbConfig.roundHistory = roundHistoryResult.map(rh => ({
                    round: rh.round_number,
                    winner: rh.winner_team_id,
                    winnerName: rh.winner_team_name
                }));
            }

            if (roundWinsResult && roundWinsResult.length > 0) {
                dbConfig.roundWins = roundWinsResult.reduce((acc, rw) => {
                    acc[rw.team_id] = rw.wins_count;
                    return acc;
                }, {});
            }

            return dbConfig;
        } catch (error) {
            console.error('Error loading database config:', error);
            return defaultConfig;
        }
    }));
}
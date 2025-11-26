import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
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

const defaultConfig = {
    gameSettings: {
        initialGold: 1000,
        numRounds: 3,
        unitsNumber: 3,
        promptMode: 'normal'
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
    }, {
        name: "Kimi K2",
        type: "moonshot",
        endpoint: "https://api.moonshot.ai/v1/chat/completions",
        apiKey: "",
        model: "kimi-k2",
        isActive: true
    }],
    display: {
        showFpsCounter: false,
        showUnitsCounter: false,
        showGameSpeedIndicator: false,
        volume: 50,
        gameSpeed: 1.0,
        mapTheme: 'none',
        rainMode: 'never'
    },
    currentRound: 1,
    roundHistory: [],
    roundWins: {}
};

async function getExistingUnitIds() {
    try {
        const dir = join(__dirname, 'public', 'units');
        const files = await fs.readdir(dir);
        return new Set(
            files
                .filter(file => file.endsWith('.json'))
                .map(file => file.replace('.json', ''))
        );
    } catch (error) {
        console.error('Error loading existing unit files:', error);
        return new Set();
    }
}

function pickMatchState(matchStates = [], requestedMatchId = null) {
    if (!matchStates || matchStates.length === 0) return null;

    if (requestedMatchId) {
        const byId = matchStates.find(ms => ms.match_id === requestedMatchId);
        if (byId) return byId;
    }

    const inProgress = matchStates
        .filter(ms => (ms.status || '').toLowerCase() === 'in_progress')
        .sort((a, b) => (b.match_id || 0) - (a.match_id || 0));
    if (inProgress.length > 0) return inProgress[0];

    const ordered = [...matchStates].sort((a, b) => (b.match_id || 0) - (a.match_id || 0));
    return ordered[0];
}

export function setupRouteConfig2(app) {
    app.get('/api/config2', handleAsyncRoute(async (req) => {
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
            const existingUnitIds = await getExistingUnitIds();
            const requestedMatchId = req?.query?.matchId ? parseInt(req.query.matchId, 10) : null;
            const db = await getDatabase();
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
                const promptMode = (gs.prompt_mode || defaultConfig.gameSettings.promptMode).toString().toLowerCase();
                dbConfig.gameSettings = {
                    initialGold: gs.initial_gold,
                    numRounds: gs.num_rounds,
                    unitsNumber: gs.units_number ?? defaultConfig.gameSettings.unitsNumber,
                    promptMode: ['normal', 'crazy', 'boss'].includes(promptMode) ? promptMode : defaultConfig.gameSettings.promptMode
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

                        const validAvailable = [];
                        for (const unitId of availableUnitsFiltered) {
                            if (existingUnitIds.has(unitId)) {
                                validAvailable.push(unitId);
                            } else {
                                try {
                                    await db.runAsync('DELETE FROM ai_available_units WHERE team_ai_id = ? AND unit_id = ?', [teamAI.ai_id, unitId]);
                                    console.warn(`[Config2] Removed missing unit ${unitId} from availableUnits of AI ${teamAI.ai_id}`);
                                } catch (error) {
                                    console.error('Error cleaning missing available unit:', error);
                                }
                            }
                        }

                        const validPurchased = [];
                        for (const pu of purchasedUnitsFiltered) {
                            if (existingUnitIds.has(pu.id)) {
                                validPurchased.push(pu);
                            } else {
                                try {
                                    await db.runAsync('DELETE FROM ai_purchased_units WHERE team_ai_id = ? AND unit_id = ?', [teamAI.ai_id, pu.id]);
                                    console.warn(`[Config2] Removed missing unit ${pu.id} from purchasedUnits of AI ${teamAI.ai_id}`);
                                } catch (error) {
                                    console.error('Error cleaning missing purchased unit:', error);
                                }
                            }
                        }

                        return {
                            id: teamAI.ai_id,
                            service_id: teamAI.service_id,
                            availableUnits: validAvailable,
                            purchasedUnits: validPurchased
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
                    gameSpeed: ds.game_speed,
                    mapTheme: ds.map_theme || 'none',
                    rainMode: ds.rain_mode || 'never'
                };
            } else {
                dbConfig.display = defaultConfig.display;
            }

            const matchState = pickMatchState(matchStatesResult, requestedMatchId);
            const matchId = matchState?.match_id || null;
            if (matchState) {
                dbConfig.currentRound = matchState.current_round;
            }

            if (roundHistoryResult && roundHistoryResult.length > 0) {
                dbConfig.roundHistory = roundHistoryResult
                    .filter(rh => !matchId || rh.match_id === matchId)
                    .map(rh => ({
                        round: rh.round_number,
                        winner: rh.winner_team_id,
                        winnerName: rh.winner_team_name
                    }));
            }

            if (roundWinsResult && roundWinsResult.length > 0) {
                dbConfig.roundWins = roundWinsResult
                    .filter(rw => !matchId || rw.match_id === matchId)
                    .reduce((acc, rw) => {
                        acc[rw.team_id] = rw.wins_count;
                        return acc;
                    }, {});
            }

            if (matchId) {
                dbConfig.matchId = matchId;
            }

            return dbConfig;
        } catch (error) {
            console.error('Error loading database config:', error);
            return defaultConfig;
        }
    }));
}

import {
    getMatchStates,
    createMatchState,
    updateMatchState,
    getRoundHistory,
    createRoundHistory,
    deleteRoundHistory,
    getRoundWins,
    createRoundWin,
    deleteRoundWin,
    updateRoundWin
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

export function setupRouteConfig2Round(app) {
    app.post('/api/config2/round', handleAsyncRoute(async (req) => {
        try {
            const { currentRound, roundHistory, roundWins } = req.body;

            const matchStates = await getMatchStates();

            if (matchStates && matchStates.length > 0) {
                const matchState = matchStates[0];

                if (currentRound !== undefined) {
                    await updateMatchState(matchState.match_id, currentRound, matchState.status);
                }

                if (roundHistory !== undefined && Array.isArray(roundHistory)) {
                    await clearRoundHistory(matchState.match_id);

                    for (const round of roundHistory) {
                        await createRoundHistory(matchState.match_id, round.round, round.winner);
                    }
                }

                if (roundWins !== undefined) {
                    await clearRoundWins(matchState.match_id);

                    for (const [teamId, wins] of Object.entries(roundWins)) {
                        await createRoundWin(matchState.match_id, parseInt(teamId), wins);
                    }
                }
            } else {
                const matchId = await createMatchState(currentRound || 1, 'in_progress');

                if (roundHistory !== undefined && Array.isArray(roundHistory)) {
                    for (const round of roundHistory) {
                        await createRoundHistory(matchId, round.round, round.winner);
                    }
                }

                if (roundWins !== undefined) {
                    for (const [teamId, wins] of Object.entries(roundWins)) {
                        await createRoundWin(matchId, parseInt(teamId), wins);
                    }
                }
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating round data:', error);
            throw error;
        }
    }));

    app.post('/api/round-history/clear', handleAsyncRoute(async () => {
        try {
            const history = await getRoundHistory();
            for (const item of history) {
                await deleteRoundHistory(item.id);
            }
            return { success: true };
        } catch (error) {
            console.error('Error clearing round history:', error);
            throw error;
        }
    }));

    app.post('/api/round-wins/clear', handleAsyncRoute(async () => {
        try {
            const wins = await getRoundWins();
            for (const item of wins) {
                await deleteRoundWin(item.id);
            }
            return { success: true };
        } catch (error) {
            console.error('Error clearing round wins:', error);
            throw error;
        }
    }));

    app.post('/api/round-wins/ensure', handleAsyncRoute(async (req) => {
        const { match_id, team_ids } = req.body;

        if (!match_id || !team_ids || !Array.isArray(team_ids)) {
            throw new Error('Invalid parameters');
        }

        try {
            const wins = await getRoundWins();
            const matchWins = wins.filter(w => w.match_id === match_id);

            const existingTeamIds = matchWins.map(w => w.team_id);
            const missingTeamIds = team_ids.filter(id => !existingTeamIds.includes(id));

            const ensured = [];
            for (const teamId of missingTeamIds) {
                const result = await createRoundWin(match_id, teamId, 0);
                ensured.push({ team_id: teamId, id: result });
            }

            return { success: true, ensured };
        } catch (error) {
            console.error('Error ensuring round wins:', error);
            throw error;
        }
    }));

    app.get('/api/match-state', handleAsyncRoute(async (req) => {
        try {
            const matchId = req.query.match_id;
            const matchStates = await getMatchStates();
            
            if (matchId) {
                const specificMatchState = matchStates.filter(m => m.match_id === parseInt(matchId));
                return { success: true, data: specificMatchState };
            }
            
            return { success: true, data: matchStates };
        } catch (error) {
            console.error('Error getting match states:', error);
            throw error;
        }
    }));

    app.get('/api/round-wins', handleAsyncRoute(async () => {
        try {
            const wins = await getRoundWins();
            return { success: true, data: wins };
        } catch (error) {
            console.error('Error getting round wins:', error);
            throw error;
        }
    }));

    app.post('/api/round-wins', handleAsyncRoute(async (req) => {
        const { match_id, team_id, wins_count } = req.body;
        
        if (!match_id || !team_id) {
            throw new Error('Missing required fields: match_id and team_id are required');
        }
        
        try {
            const existing = await getRoundWins();
            const existingWin = existing.find(win => win.match_id === match_id && win.team_id === team_id);
            
            if (existingWin) {
                await updateRoundWin(existingWin.id, match_id, team_id, wins_count);
                return { success: true, id: existingWin.id, updated: true };
            } else {
                const result = await createRoundWin(match_id, team_id, wins_count || 0);
                return { success: true, id: result };
            }
        } catch (error) {
            console.error('Error creating round win:', error);
            throw error;
        }
    }));

    app.put('/api/round-wins', handleAsyncRoute(async (req) => {
        const { id, match_id, team_id, wins_count } = req.body;
        
        if (!id || !match_id || !team_id) {
            throw new Error('Missing required fields: id, match_id, and team_id are required');
        }
        
        try {
            const result = await updateRoundWin(id, match_id, team_id, wins_count);
            return { success: true, id: id };
        } catch (error) {
            console.error('Error updating round win:', error);
            throw error;
        }
    }));

    app.post('/api/round-history', handleAsyncRoute(async (req) => {
        const { match_id, round_number, winner_team_id } = req.body;
        
        if (!match_id || !round_number || !winner_team_id) {
            throw new Error('Missing required fields: match_id, round_number, and winner_team_id are required');
        }
        
        try {
            const result = await createRoundHistory(match_id, round_number, winner_team_id);
            return { success: true, id: result };
        } catch (error) {
            console.error('Error creating round history:', error);
            throw error;
        }
    }));
}

async function clearRoundHistory(matchId) {
    const history = await getRoundHistory();
    for (const item of history) {
        if (item.match_id === matchId) {
            await deleteRoundHistory(item.id);
        }
    }
}

async function clearRoundWins(matchId) {
    const wins = await getRoundWins();
    for (const item of wins) {
        if (item.match_id === matchId) {
            await deleteRoundWin(item.id);
        }
    }
}
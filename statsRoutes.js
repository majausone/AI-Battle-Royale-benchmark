import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
    getDatabase,
    getAllMatches,
    getMatchDetails,
    getTeams,
    createMatch,
    addParticipantToMatch,
    completeMatch,
    saveResponse,
    saveEvaluation,
    saveFile,
    getFilesByAI,
    getFilesByMatch,
    getFilesByAIAndMatch
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
        console.error('Route error:', error.message, error.stack);
        res.status(500).json({
            error: error.message || 'Internal server error',
            details: error.toString(),
            stack: error.stack
        });
    }
};

export function setupRouteStats(app) {
    app.get('/api/stats/matches', handleAsyncRoute(async (req, res) => {
        try {
            const db = await getDatabase();
            
            const page = parseInt(req.query.page) || 1;
            const pageSize = parseInt(req.query.pageSize) || 10;
            const offset = (page - 1) * pageSize;
            
            let query = `
                SELECT m.match_id, m.start_time, m.end_time, m.status, m.created_at, 
                       (SELECT COUNT(*) FROM match_participants WHERE match_id = m.match_id) as participant_count,
                       (SELECT t.name FROM match_participants mp 
                        JOIN team_ais ta ON mp.ai_id = ta.ai_id 
                        JOIN teams t ON ta.team_id = t.team_id 
                        WHERE mp.match_id = m.match_id AND mp.is_winner = 1 
                        LIMIT 1) as winner_name
                FROM matches m
                WHERE 1=1
            `;
            
            let countQuery = `
                SELECT COUNT(*) as total
                FROM matches m
                WHERE 1=1
            `;
            
            let queryParams = [];
            let whereClause = "";
            
            if (req.query.dateFrom && req.query.dateFrom.trim() !== '') {
                try {
                    new Date(req.query.dateFrom);
                    whereClause += " AND m.start_time >= ?";
                    queryParams.push(req.query.dateFrom);
                } catch (e) {
                    console.error('Invalid dateFrom format:', e);
                }
            }
            
            if (req.query.dateTo && req.query.dateTo.trim() !== '') {
                try {
                    new Date(req.query.dateTo);
                    whereClause += " AND m.start_time <= ?";
                    queryParams.push(req.query.dateTo);
                } catch (e) {
                    console.error('Invalid dateTo format:', e);
                }
            }
            
            if (req.query.aiId && req.query.aiId !== 'all') {
                const aiId = parseInt(req.query.aiId, 10);
                if (!isNaN(aiId)) {
                    whereClause += " AND m.match_id IN (SELECT match_id FROM match_participants WHERE ai_id = ?)";
                    queryParams.push(aiId);
                }
            }
            
            if (req.query.teamId && req.query.teamId !== 'all') {
                const teamId = parseInt(req.query.teamId, 10);
                if (!isNaN(teamId)) {
                    whereClause += " AND m.match_id IN (SELECT mp.match_id FROM match_participants mp JOIN team_ais ta ON mp.ai_id = ta.ai_id WHERE ta.team_id = ?)";
                    queryParams.push(teamId);
                }
            }
            
            query += whereClause + " ORDER BY m.start_time DESC LIMIT ? OFFSET ?";
            countQuery += whereClause;
            
            let matchesParams = [...queryParams];
            matchesParams.push(pageSize, offset);
            
            let matches = await db.allAsync(query, matchesParams);
            let countResult = await db.getAsync(countQuery, queryParams);
            
            return {
                matches,
                total: countResult ? countResult.total : 0,
                page,
                pageSize
            };
        } catch (error) {
            console.error('Error fetching matches:', error);
            throw error;
        }
    }));

    app.get('/api/stats/ais', handleAsyncRoute(async (req, res) => {
        try {
            const db = await getDatabase();
            
            const query = `
                SELECT ta.ai_id as ai_id, 
                       s.name as name,
                       s.type as service_type,
                       t.name as team_name,
                       COUNT(DISTINCT mp.match_id) as total_matches,
                       SUM(CASE WHEN mp.is_winner THEN 1 ELSE 0 END) as wins,
                       (SELECT COUNT(*) FROM responses r WHERE r.ai_id = ta.ai_id AND r.has_errors = 1) as errors
                FROM team_ais ta
                JOIN ai_services s ON ta.service_id = s.service_id
                JOIN teams t ON ta.team_id = t.team_id
                LEFT JOIN match_participants mp ON ta.ai_id = mp.ai_id
                GROUP BY ta.ai_id
                ORDER BY wins DESC, total_matches DESC
            `;
            
            const ais = await db.allAsync(query);
            
            return { ais };
        } catch (error) {
            console.error('Error fetching AIs stats:', error);
            throw error;
        }
    }));

    app.get('/api/stats/teams', handleAsyncRoute(async (req, res) => {
        try {
            const db = await getDatabase();
            
            const query = `
                SELECT t.*, 
                       (SELECT COUNT(DISTINCT mp.match_id) 
                        FROM match_participants mp 
                        JOIN team_ais ta ON mp.ai_id = ta.ai_id 
                        WHERE ta.team_id = t.team_id) as total_matches,
                       (SELECT COUNT(DISTINCT mp.match_id) 
                        FROM match_participants mp 
                        JOIN team_ais ta ON mp.ai_id = ta.ai_id 
                        WHERE ta.team_id = t.team_id AND mp.is_winner = 1) as wins
                FROM teams t
                ORDER BY wins DESC, total_matches DESC
            `;
            
            const teams = await db.allAsync(query);
            
            return { teams };
        } catch (error) {
            console.error('Error fetching teams stats:', error);
            throw error;
        }
    }));

    app.get('/api/stats/team/:id/ais', handleAsyncRoute(async (req, res) => {
        try {
            const teamId = parseInt(req.params.id, 10);
            if (isNaN(teamId)) {
                throw new Error('Invalid team ID');
            }
            
            const db = await getDatabase();
            
            const query = `
                SELECT ta.ai_id, ta.team_id,
                       s.name, s.type as service_type,
                       COUNT(DISTINCT mp.match_id) as total_matches,
                       SUM(CASE WHEN mp.is_winner THEN 1 ELSE 0 END) as wins,
                       (SELECT COUNT(*) FROM responses r WHERE r.ai_id = ta.ai_id AND r.has_errors = 1) as errors
                FROM team_ais ta
                JOIN ai_services s ON ta.service_id = s.service_id
                LEFT JOIN match_participants mp ON ta.ai_id = mp.ai_id
                WHERE ta.team_id = ?
                GROUP BY ta.ai_id
                ORDER BY wins DESC, total_matches DESC
            `;
            
            const ais = await db.allAsync(query, [teamId]);
            
            return { 
                teamId,
                ais 
            };
        } catch (error) {
            console.error('Error fetching team AIs:', error);
            throw error;
        }
    }));

    app.get('/api/stats/ai/:id/files', handleAsyncRoute(async (req, res) => {
        try {
            const aiId = parseInt(req.params.id, 10);
            if (isNaN(aiId)) {
                throw new Error('Invalid AI ID');
            }
            
            const files = await getFilesByAI(aiId);
            
            return { 
                aiId,
                files,
                count: files.length
            };
        } catch (error) {
            console.error('Error fetching AI files:', error);
            throw error;
        }
    }));

    app.get('/api/stats/match/:id/files', handleAsyncRoute(async (req, res) => {
        try {
            const matchId = parseInt(req.params.id, 10);
            if (isNaN(matchId)) {
                throw new Error('Invalid match ID');
            }
            
            const files = await getFilesByMatch(matchId);
            
            const db = await getDatabase();
            const aiInfo = await db.allAsync(`
                SELECT f.ai_id, 
                       (SELECT t.name FROM team_ais ta JOIN teams t ON ta.team_id = t.team_id WHERE ta.ai_id = f.ai_id LIMIT 1) as team_name,
                       (SELECT s.type FROM team_ais ta JOIN ai_services s ON ta.service_id = s.service_id WHERE ta.ai_id = f.ai_id LIMIT 1) as service_type,
                       COUNT(f.file_id) as file_count
                FROM files f
                WHERE f.match_id = ?
                GROUP BY f.ai_id
            `, [matchId]);
            
            return { 
                matchId,
                files,
                aiInfo,
                count: files.length
            };
        } catch (error) {
            console.error('Error fetching match files:', error);
            throw error;
        }
    }));

    app.get('/api/stats/files/:ai/:match', handleAsyncRoute(async (req, res) => {
        try {
            const aiId = parseInt(req.params.ai, 10);
            const matchId = parseInt(req.params.match, 10);
            
            if (isNaN(aiId) || isNaN(matchId)) {
                throw new Error('Invalid AI or match ID');
            }
            
            const files = await getFilesByAIAndMatch(aiId, matchId);
            
            return {
                aiId,
                matchId,
                files,
                count: files.length
            };
        } catch (error) {
            console.error('Error fetching files for AI and match:', error);
            throw error;
        }
    }));

    app.get('/api/stats/summary', handleAsyncRoute(async (req, res) => {
        try {
            const db = await getDatabase();
            
            let whereClause = "";
            const queryParams = [];
            
            if (req.query.dateFrom && req.query.dateFrom.trim() !== '') {
                try {
                    new Date(req.query.dateFrom);
                    whereClause += " AND m.start_time >= ?";
                    queryParams.push(req.query.dateFrom);
                } catch (e) {
                    console.error('Invalid dateFrom format:', e);
                }
            }
            
            if (req.query.dateTo && req.query.dateTo.trim() !== '') {
                try {
                    new Date(req.query.dateTo);
                    whereClause += " AND m.start_time <= ?";
                    queryParams.push(req.query.dateTo);
                } catch (e) {
                    console.error('Invalid dateTo format:', e);
                }
            }
            
            if (req.query.aiId && req.query.aiId !== 'all') {
                const aiId = parseInt(req.query.aiId, 10);
                if (!isNaN(aiId)) {
                    whereClause += " AND m.match_id IN (SELECT match_id FROM match_participants WHERE ai_id = ?)";
                    queryParams.push(aiId);
                }
            }
            
            if (req.query.teamId && req.query.teamId !== 'all') {
                const teamId = parseInt(req.query.teamId, 10);
                if (!isNaN(teamId)) {
                    whereClause += " AND m.match_id IN (SELECT mp.match_id FROM match_participants mp JOIN team_ais ta ON mp.ai_id = ta.ai_id WHERE ta.team_id = ?)";
                    queryParams.push(teamId);
                }
            }
            
            const matchesCountQuery = `
                SELECT COUNT(*) as total_matches
                FROM matches m
                WHERE 1=1 ${whereClause}
            `;
            
            const roundsCountQuery = `
                SELECT COUNT(*) as total_rounds
                FROM round_history rh
                JOIN matches m ON rh.match_id = m.match_id
                WHERE 1=1 ${whereClause}
            `;
            
            const filesCountQuery = `
                SELECT COUNT(*) as total_files
                FROM files f
                JOIN matches m ON f.match_id = m.match_id
                WHERE 1=1 ${whereClause}
            `;
            
            const matchesCountResult = await db.getAsync(matchesCountQuery, queryParams);
            const roundsCountResult = await db.getAsync(roundsCountQuery, queryParams);
            const filesCountResult = await db.getAsync(filesCountQuery, queryParams);
            
            return {
                totalMatches: matchesCountResult ? matchesCountResult.total_matches : 0,
                totalRounds: roundsCountResult ? roundsCountResult.total_rounds : 0,
                totalFiles: filesCountResult ? filesCountResult.total_files : 0
            };
        } catch (error) {
            console.error('Error fetching stats summary:', error);
            throw error;
        }
    }));

    app.get('/api/stats/match/:id', handleAsyncRoute(async (req, res) => {
        try {
            const matchId = parseInt(req.params.id, 10);
            if (isNaN(matchId)) {
                throw new Error('Invalid match ID');
            }
            
            const db = await getDatabase();
            
            const matchQuery = `SELECT * FROM matches WHERE match_id = ?`;
            const match = await db.getAsync(matchQuery, [matchId]);
            
            if (!match) {
                return res.status(404).json({ error: 'Match not found' });
            }
            
            const participantsQuery = `
                SELECT mp.*, 
                       (SELECT s.type FROM team_ais ta JOIN ai_services s ON ta.service_id = s.service_id WHERE ta.ai_id = mp.ai_id LIMIT 1) as service_type,
                       (SELECT t.name FROM team_ais ta JOIN teams t ON ta.team_id = t.team_id WHERE ta.ai_id = mp.ai_id LIMIT 1) as name
                FROM match_participants mp 
                WHERE mp.match_id = ?
            `;
            const participants = await db.allAsync(participantsQuery, [matchId]);
            
            const responsesQuery = `
                SELECT * FROM responses WHERE match_id = ?
            `;
            const responses = await db.allAsync(responsesQuery, [matchId]);
            
            const filesQuery = `
                SELECT * FROM files WHERE match_id = ?
            `;
            const files = await db.allAsync(filesQuery, [matchId]);
            
            const roundHistoryQuery = `
                SELECT rh.*, t.name as winner_team_name 
                FROM round_history rh 
                LEFT JOIN teams t ON rh.winner_team_id = t.team_id
                WHERE rh.match_id = ?
                ORDER BY rh.round_number
            `;
            const roundHistory = await db.allAsync(roundHistoryQuery, [matchId]);
            
            const roundWinsQuery = `
                SELECT rw.*, t.name as team_name 
                FROM round_wins rw 
                LEFT JOIN teams t ON rw.team_id = t.team_id
                WHERE rw.match_id = ?
            `;
            const roundWins = await db.allAsync(roundWinsQuery, [matchId]);
            
            const evaluationsQuery = `
                SELECT * FROM ai_evaluations WHERE match_id = ?
            `;
            const evaluations = await db.allAsync(evaluationsQuery, [matchId]);
            
            return {
                match,
                participants,
                responses,
                files,
                roundHistory,
                roundWins,
                evaluations
            };
        } catch (error) {
            console.error('Error fetching match details:', error);
            throw error;
        }
    }));

    app.delete('/api/stats/match/:id/delete', handleAsyncRoute(async (req, res) => {
        try {
            const matchId = parseInt(req.params.id, 10);
            if (isNaN(matchId)) {
                throw new Error('Invalid match ID');
            }
            
            const db = await getDatabase();
            await db.runAsync('BEGIN TRANSACTION');
            
            try {
                const files = await db.allAsync('SELECT * FROM files WHERE match_id = ?', [matchId]);
                
                for (const file of files) {
                    const fileType = file.filename.split('-')[0];
                    let directory = '';
                    
                    if (fileType === 'skill') {
                        directory = 'skills';
                    } else if (fileType === 'fx') {
                        directory = 'fx';
                    } else if (fileType === 'seffect') {
                        directory = 'seffects';
                    } else {
                        directory = 'units';
                    }
                    
                    const filePath = join(__dirname, 'public', directory, file.filename);
                    
                    try {
                        await fs.unlink(filePath);
                    } catch (err) {
                        console.error(`Error deleting file ${filePath}:`, err);
                    }
                }
                
                await db.runAsync('DELETE FROM ai_evaluations WHERE match_id = ?', [matchId]);
                await db.runAsync('DELETE FROM files WHERE match_id = ?', [matchId]);
                await db.runAsync('DELETE FROM responses WHERE match_id = ?', [matchId]);
                await db.runAsync('DELETE FROM round_team_states WHERE round_history_id IN (SELECT id FROM round_history WHERE match_id = ?)', [matchId]);
                await db.runAsync('DELETE FROM round_history WHERE match_id = ?', [matchId]);
                await db.runAsync('DELETE FROM round_wins WHERE match_id = ?', [matchId]);
                await db.runAsync('DELETE FROM match_participants WHERE match_id = ?', [matchId]);
                await db.runAsync('DELETE FROM match_state WHERE match_id = ?', [matchId]);
                await db.runAsync('DELETE FROM matches WHERE match_id = ?', [matchId]);
                
                await db.runAsync('COMMIT');
                
                return { success: true, message: `Match ${matchId} and all related data deleted successfully` };
            } catch (error) {
                await db.runAsync('ROLLBACK');
                throw error;
            }
        } catch (error) {
            console.error('Error deleting match:', error);
            throw error;
        }
    }));

    app.delete('/api/stats/match/:id/delete-keep-files', handleAsyncRoute(async (req, res) => {
        try {
            const matchId = parseInt(req.params.id, 10);
            if (isNaN(matchId)) {
                throw new Error('Invalid match ID');
            }
            
            const db = await getDatabase();
            await db.runAsync('BEGIN TRANSACTION');
            
            try {
                await db.runAsync('DELETE FROM ai_evaluations WHERE match_id = ?', [matchId]);
                await db.runAsync('DELETE FROM files WHERE match_id = ?', [matchId]);
                await db.runAsync('DELETE FROM responses WHERE match_id = ?', [matchId]);
                await db.runAsync('DELETE FROM round_team_states WHERE round_history_id IN (SELECT id FROM round_history WHERE match_id = ?)', [matchId]);
                await db.runAsync('DELETE FROM round_history WHERE match_id = ?', [matchId]);
                await db.runAsync('DELETE FROM round_wins WHERE match_id = ?', [matchId]);
                await db.runAsync('DELETE FROM match_participants WHERE match_id = ?', [matchId]);
                await db.runAsync('DELETE FROM match_state WHERE match_id = ?', [matchId]);
                await db.runAsync('DELETE FROM matches WHERE match_id = ?', [matchId]);
                
                await db.runAsync('COMMIT');
                
                return { success: true, message: `Match ${matchId} data deleted successfully (files preserved)` };
            } catch (error) {
                await db.runAsync('ROLLBACK');
                throw error;
            }
        } catch (error) {
            console.error('Error deleting match data:', error);
            throw error;
        }
    }));

    app.post('/api/matches/create', handleAsyncRoute(async (req, res) => {
        try {
            const matchId = await createNewMatch();
            return { success: true, matchId };
        } catch (error) {
            console.error('Error creating match:', error);
            throw error;
        }
    }));

    app.post('/api/matches/:id/participants', handleAsyncRoute(async (req, res) => {
        try {
            const matchId = parseInt(req.params.id, 10);
            if (isNaN(matchId)) {
                throw new Error('Invalid match ID');
            }
            
            const { aiIds } = req.body;
            if (!aiIds || !Array.isArray(aiIds) || aiIds.length === 0) {
                throw new Error('Invalid AI IDs array');
            }
            
            const db = await getDatabase();
            const results = [];
            
            for (const aiId of aiIds) {
                try {
                    const parsedAiId = parseInt(aiId, 10);
                    if (isNaN(parsedAiId)) {
                        results.push({ aiId, error: 'Invalid AI ID format', success: false });
                        continue;
                    }
                    
                    const existingParticipant = await db.getAsync(
                        'SELECT participant_id FROM match_participants WHERE match_id = ? AND ai_id = ?',
                        [matchId, parsedAiId]
                    );
                    
                    if (existingParticipant) {
                        results.push({ aiId: parsedAiId, participantId: existingParticipant.participant_id, success: true });
                    } else {
                        const result = await db.runAsync(
                            'INSERT INTO match_participants (match_id, ai_id, is_winner) VALUES (?, ?, 0)',
                            [matchId, parsedAiId]
                        );
                        results.push({ aiId: parsedAiId, participantId: result.lastID, success: true });
                    }
                } catch (error) {
                    console.error('Error adding participant to match:', error);
                    results.push({ aiId, error: error.message, success: false });
                }
            }
            
            return { success: true, results };
        } catch (error) {
            console.error('Error adding participants to match:', error);
            throw error;
        }
    }));

    app.post('/api/matches/:id/complete', handleAsyncRoute(async (req, res) => {
        try {
            const matchId = parseInt(req.params.id, 10);
            if (isNaN(matchId)) {
                throw new Error('Invalid match ID');
            }
            
            const { winnerId } = req.body;
            if (!winnerId) {
                throw new Error('Invalid winner ID');
            }
            
            const winnerIdInt = parseInt(winnerId, 10);
            if (isNaN(winnerIdInt)) {
                throw new Error('Winner ID must be a number');
            }
            
            const db = await getDatabase();
            
            await db.runAsync('BEGIN TRANSACTION');
            
            try {
                await db.runAsync(
                    'UPDATE matches SET end_time = datetime("now"), status = "completed" WHERE match_id = ?',
                    [matchId]
                );
                
                await db.runAsync(
                    'UPDATE match_participants SET is_winner = 0 WHERE match_id = ?',
                    [matchId]
                );
                
                await db.runAsync(
                    'UPDATE match_participants SET is_winner = 1 WHERE match_id = ? AND ai_id = ?',
                    [matchId, winnerIdInt]
                );
                
                await db.runAsync(
                    'UPDATE match_state SET status = "completed" WHERE match_id = ?',
                    [matchId]
                );
                
                const participants = await db.allAsync(
                    'SELECT mp.ai_id FROM match_participants mp WHERE match_id = ?',
                    [matchId]
                );
                
                for (const participant of participants) {
                    const aiId = participant.ai_id;
                    
                    await db.runAsync(
                        'DELETE FROM ai_purchased_units WHERE team_ai_id = ?',
                        [aiId]
                    );
                    
                    const availableUnits = await db.allAsync(
                        'SELECT * FROM ai_available_units WHERE team_ai_id = ?',
                        [aiId]
                    );
                    
                    for (const unit of availableUnits) {
                        if (unit.unit_id !== 'kewoBasico' && unit.unit_id !== 'kewoArco') {
                            await db.runAsync(
                                'DELETE FROM ai_available_units WHERE id = ?',
                                [unit.id]
                            );
                        }
                    }
                }
                
                await db.runAsync('COMMIT');
                
                return { success: true };
            } catch (error) {
                await db.runAsync('ROLLBACK');
                throw error;
            }
        } catch (error) {
            console.error('Error completing match:', error);
            throw error;
        }
    }));

    app.get('/api/round-history', handleAsyncRoute(async (req, res) => {
        try {
            const db = await getDatabase();
            
            const query = `
                SELECT rh.*, t.name as winner_team_name 
                FROM round_history rh 
                LEFT JOIN teams t ON rh.winner_team_id = t.team_id
                ORDER BY rh.match_id, rh.round_number
            `;
            
            const data = await db.allAsync(query);
            
            return { success: true, data };
        } catch (error) {
            console.error('Error fetching round history:', error);
            throw error;
        }
    }));

    app.post('/api/round-history', handleAsyncRoute(async (req, res) => {
        try {
            const { match_id, round_number, winner_team_id } = req.body;
            
            if (!match_id || !round_number || !winner_team_id) {
                throw new Error('Missing required fields');
            }
            
            const matchIdInt = parseInt(match_id, 10);
            const roundNumberInt = parseInt(round_number, 10);
            const winnerTeamIdInt = parseInt(winner_team_id, 10);
            
            if (isNaN(matchIdInt) || isNaN(roundNumberInt) || isNaN(winnerTeamIdInt)) {
                throw new Error('Invalid numeric fields');
            }
            
            const db = await getDatabase();
            
            const existing = await db.getAsync(
                'SELECT id FROM round_history WHERE match_id = ? AND round_number = ?',
                [matchIdInt, roundNumberInt]
            );
            
            if (existing) {
                await db.runAsync(
                    'UPDATE round_history SET winner_team_id = ? WHERE id = ?',
                    [winnerTeamIdInt, existing.id]
                );
                
                return { success: true, id: existing.id, updated: true };
            } else {
                const result = await db.runAsync(
                    'INSERT INTO round_history (match_id, round_number, winner_team_id) VALUES (?, ?, ?)',
                    [matchIdInt, roundNumberInt, winnerTeamIdInt]
                );
                
                return { success: true, id: result.lastID };
            }
        } catch (error) {
            console.error('Error creating round history:', error);
            throw error;
        }
    }));

    app.post('/api/round-history/clear', handleAsyncRoute(async (req, res) => {
        try {
            const db = await getDatabase();
            
            await db.runAsync('DELETE FROM round_history');
            
            return { success: true };
        } catch (error) {
            console.error('Error clearing round history:', error);
            throw error;
        }
    }));

    app.get('/api/round-wins', handleAsyncRoute(async (req, res) => {
        try {
            const db = await getDatabase();
            
            const query = `
                SELECT rw.*, t.name as team_name 
                FROM round_wins rw 
                LEFT JOIN teams t ON rw.team_id = t.team_id
                ORDER BY rw.match_id, rw.team_id
            `;
            
            const data = await db.allAsync(query);
            
            return { success: true, data };
        } catch (error) {
            console.error('Error fetching round wins:', error);
            throw error;
        }
    }));

    app.post('/api/round-wins', handleAsyncRoute(async (req, res) => {
        try {
            const { match_id, team_id, wins_count } = req.body;
            
            if (!match_id || !team_id) {
                throw new Error('Missing required fields');
            }
            
            const matchIdInt = parseInt(match_id, 10);
            const teamIdInt = parseInt(team_id, 10);
            const winsCountInt = parseInt(wins_count || 0, 10);
            
            if (isNaN(matchIdInt) || isNaN(teamIdInt)) {
                throw new Error('Invalid numeric fields');
            }
            
            const db = await getDatabase();
            
            const existing = await db.getAsync(
                'SELECT id FROM round_wins WHERE match_id = ? AND team_id = ?',
                [matchIdInt, teamIdInt]
            );
            
            if (existing) {
                await db.runAsync(
                    'UPDATE round_wins SET wins_count = ? WHERE id = ?',
                    [winsCountInt, existing.id]
                );
                
                return { success: true, id: existing.id, updated: true };
            } else {
                const result = await db.runAsync(
                    'INSERT INTO round_wins (match_id, team_id, wins_count) VALUES (?, ?, ?)',
                    [matchIdInt, teamIdInt, winsCountInt]
                );
                
                return { success: true, id: result.lastID };
            }
        } catch (error) {
            console.error('Error creating round win:', error);
            throw error;
        }
    }));

    app.put('/api/round-wins', handleAsyncRoute(async (req, res) => {
        try {
            const { id, match_id, team_id, wins_count } = req.body;
            
            if (!id || !match_id || !team_id) {
                throw new Error('Missing required fields');
            }
            
            const idInt = parseInt(id, 10);
            const matchIdInt = parseInt(match_id, 10);
            const teamIdInt = parseInt(team_id, 10);
            const winsCountInt = parseInt(wins_count || 0, 10);
            
            if (isNaN(idInt) || isNaN(matchIdInt) || isNaN(teamIdInt)) {
                throw new Error('Invalid numeric fields');
            }
            
            const db = await getDatabase();
            
            await db.runAsync(
                'UPDATE round_wins SET match_id = ?, team_id = ?, wins_count = ? WHERE id = ?',
                [matchIdInt, teamIdInt, winsCountInt, idInt]
            );
            
            return { success: true, id: idInt };
        } catch (error) {
            console.error('Error updating round win:', error);
            throw error;
        }
    }));

    app.post('/api/round-wins/clear', handleAsyncRoute(async (req, res) => {
        try {
            const db = await getDatabase();
            
            await db.runAsync('DELETE FROM round_wins');
            
            return { success: true };
        } catch (error) {
            console.error('Error clearing round wins:', error);
            throw error;
        }
    }));

    app.post('/api/round-wins/ensure', handleAsyncRoute(async (req, res) => {
        try {
            const { match_id, team_ids } = req.body;
            
            if (!match_id || !team_ids || !Array.isArray(team_ids)) {
                throw new Error('Missing required fields');
            }
            
            const matchIdInt = parseInt(match_id, 10);
            if (isNaN(matchIdInt)) {
                throw new Error('Invalid match ID');
            }
            
            const db = await getDatabase();
            const ensured = [];
            
            for (const team_id of team_ids) {
                const teamIdInt = parseInt(team_id, 10);
                if (isNaN(teamIdInt)) {
                    continue;
                }
                
                const existing = await db.getAsync(
                    'SELECT id FROM round_wins WHERE match_id = ? AND team_id = ?',
                    [matchIdInt, teamIdInt]
                );
                
                if (!existing) {
                    const result = await db.runAsync(
                        'INSERT INTO round_wins (match_id, team_id, wins_count) VALUES (?, ?, 0)',
                        [matchIdInt, teamIdInt]
                    );
                    
                    ensured.push({ team_id: teamIdInt, id: result.lastID });
                }
            }
            
            return { success: true, ensured };
        } catch (error) {
            console.error('Error ensuring round wins:', error);
            throw error;
        }
    }));

    async function createNewMatch() {
        try {
            const matchId = await createMatch();
            return matchId;
        } catch (error) {
            console.error('Error creating new match:', error);
            throw error;
        }
    }

    app.post('/api/stats/register-ai', handleAsyncRoute(async (req, res) => {
        try {
            const { name, serviceType, model, team_id, service_id, ai_id } = req.body;
            
            if (!name || !serviceType || !model) {
                throw new Error('Missing required data to register an AI');
            }
            
            const db = await getDatabase();
            
            const teamIdInt = parseInt(team_id || 1, 10);
            const serviceIdInt = parseInt(service_id || 1, 10);
            
            const result = await db.runAsync(
                'INSERT INTO team_ais (team_id, service_id) VALUES (?, ?)',
                [teamIdInt, serviceIdInt]
            );
            
            return { success: true, aiId: result.lastID };
        } catch (error) {
            console.error('Error registering AI:', error);
            throw error;
        }
    }));
    
    app.post('/api/responses/create', handleAsyncRoute(async (req, res) => {
        try {
            const { ai_id, match_id, response, has_errors, has_warnings, response_time } = req.body;
            
            if (!ai_id || !match_id || !response) {
                throw new Error('Missing required fields for response');
            }
            
            const aiIdInt = parseInt(ai_id, 10);
            const matchIdInt = parseInt(match_id, 10);
            
            if (isNaN(aiIdInt) || isNaN(matchIdInt)) {
                throw new Error('Invalid ID format');
            }
            
            const responseId = await saveResponse(
                aiIdInt, 
                matchIdInt, 
                response, 
                has_errors || 0, 
                has_warnings || 0, 
                response_time || 0
            );
            
            return { success: true, responseId };
        } catch (error) {
            console.error('Error creating response:', error);
            throw error;
        }
    }));
    
    app.post('/api/files/create', handleAsyncRoute(async (req, res) => {
        try {
            const { ai_id, match_id, filename } = req.body;
            
            if (!ai_id || !match_id || !filename) {
                throw new Error('Missing required fields for file record');
            }
            
            const aiIdInt = parseInt(ai_id, 10);
            const matchIdInt = parseInt(match_id, 10);
            
            if (isNaN(aiIdInt) || isNaN(matchIdInt)) {
                throw new Error('Invalid ID format');
            }
            
            const fileId = await saveFile(aiIdInt, matchIdInt, filename);
            
            return { success: true, fileId };
        } catch (error) {
            console.error('Error creating file record:', error);
            throw error;
        }
    }));
    
    app.post('/api/evaluations/create', handleAsyncRoute(async (req, res) => {
        try {
            const { 
                match_id, 
                evaluator_ai_id, 
                evaluated_ai_id, 
                knows_evaluated, 
                creativity_score, 
                code_quality_score, 
                comments 
            } = req.body;
            
            if (!match_id || !evaluator_ai_id || !evaluated_ai_id) {
                throw new Error('Missing required fields for evaluation');
            }
            
            const matchIdInt = parseInt(match_id, 10);
            const evaluatorAiIdInt = parseInt(evaluator_ai_id, 10);
            const evaluatedAiIdInt = parseInt(evaluated_ai_id, 10);
            
            if (isNaN(matchIdInt) || isNaN(evaluatorAiIdInt) || isNaN(evaluatedAiIdInt)) {
                throw new Error('Invalid ID format');
            }
            
            const evaluationId = await saveEvaluation(
                matchIdInt,
                evaluatorAiIdInt,
                evaluatedAiIdInt,
                knows_evaluated || 0,
                creativity_score || 0,
                code_quality_score || 0,
                comments || ''
            );
            
            return { success: true, evaluationId };
        } catch (error) {
            console.error('Error creating evaluation:', error);
            throw error;
        }
    }));
}
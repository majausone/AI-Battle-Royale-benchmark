import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'kewo_battle.db');

let db = null;

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
    console.error('❌ ERROR: ENCRYPTION_KEY not found in .env file');
    console.error('Please add ENCRYPTION_KEY to your .env file');
    process.exit(1);
}

const KEY = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);

function encrypt(text) {
    if (!text) return text;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
    if (!text) return text;

    const parts = text.split(':');
    if (parts.length !== 2) {
        return text;
    }

    const iv = parts[0];
    if (iv.length !== 32 || !/^[0-9a-f]+$/i.test(iv)) {
        return text;
    }

    try {
        const ivBuffer = Buffer.from(iv, 'hex');
        const encryptedText = parts[1];
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, ivBuffer);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.warn('Failed to decrypt, returning original value');
        return text;
    }
}

function createDbConnection() {
    const sqlite = sqlite3.verbose();
    return new sqlite.Database(dbPath);
}

async function ensureGameSettingsSchema(database) {
    try {
        const columns = await database.allAsync("PRAGMA table_info('game_settings')");
        const hasUnitsNumber = columns.some(column => column.name === 'units_number');
        const hasPromptMode = columns.some(column => column.name === 'prompt_mode');

        if (!hasUnitsNumber) {
            await database.runAsync("ALTER TABLE game_settings ADD COLUMN units_number INTEGER NOT NULL DEFAULT 3");
            await database.runAsync("UPDATE game_settings SET units_number = 3 WHERE units_number IS NULL");
        }

        if (!hasPromptMode) {
            await database.runAsync("ALTER TABLE game_settings ADD COLUMN prompt_mode TEXT NOT NULL DEFAULT 'normal'");
            await database.runAsync("UPDATE game_settings SET prompt_mode = 'normal' WHERE prompt_mode IS NULL");
        }
    } catch (error) {
        console.error('Error ensuring game_settings schema:', error);
        throw error;
    }
}

async function ensureMatchParticipantsSchema(database) {
    try {
        const columns = await database.allAsync("PRAGMA table_info('match_participants')");
        const hasUnits = columns.some(c => c.name === 'total_units_created');
        const hasErrors = columns.some(c => c.name === 'has_errors');
        const hasWarnings = columns.some(c => c.name === 'has_warnings');
        if (!hasUnits) {
            await database.runAsync("ALTER TABLE match_participants ADD COLUMN total_units_created INTEGER NOT NULL DEFAULT 0");
        }
        if (!hasErrors) {
            await database.runAsync("ALTER TABLE match_participants ADD COLUMN has_errors INTEGER NOT NULL DEFAULT 0");
        }
        if (!hasWarnings) {
            await database.runAsync("ALTER TABLE match_participants ADD COLUMN has_warnings INTEGER NOT NULL DEFAULT 0");
        }
    } catch (error) {
        console.error('Error ensuring match_participants schema:', error);
        throw error;
    }
}

async function ensureDisplaySettingsSchema(database) {
    try {
        const columns = await database.allAsync("PRAGMA table_info('display_settings')");
        const hasMapTheme = columns.some(column => column.name === 'map_theme');
        const hasRainMode = columns.some(column => column.name === 'rain_mode');

        if (!hasMapTheme) {
            await database.runAsync("ALTER TABLE display_settings ADD COLUMN map_theme TEXT NOT NULL DEFAULT 'none'");
        }

        if (!hasRainMode) {
            await database.runAsync("ALTER TABLE display_settings ADD COLUMN rain_mode TEXT NOT NULL DEFAULT 'never'");
        }
    } catch (error) {
        console.error('Error ensuring display_settings schema:', error);
        throw error;
    }
}

async function initDatabase() {
    try {
        const database = createDbConnection();

        database.runAsync = function (sql, params = []) {
            return new Promise((resolve, reject) => {
                this.run(sql, params, function (err) {
                    if (err) return reject(err);
                    resolve({ lastID: this.lastID, changes: this.changes });
                });
            });
        };

        database.getAsync = promisify(database.get).bind(database);
        database.allAsync = promisify(database.all).bind(database);
        database.execAsync = promisify(database.exec).bind(database);

        await database.execAsync(`
            CREATE TABLE IF NOT EXISTS matches (
                match_id        INTEGER     PRIMARY KEY,
                start_time      DATETIME    NOT NULL,
                end_time        DATETIME,
                status          TEXT        NOT NULL,
                created_at      DATETIME    DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS match_participants (
                participant_id  INTEGER     PRIMARY KEY,
                match_id        INTEGER     NOT NULL,
                ai_id           INTEGER     NOT NULL,
                is_winner       INTEGER     DEFAULT 0,
                created_at      DATETIME    DEFAULT CURRENT_TIMESTAMP,
                total_units_created INTEGER NOT NULL DEFAULT 0,
                has_errors      INTEGER     NOT NULL DEFAULT 0,
                has_warnings    INTEGER     NOT NULL DEFAULT 0,
                FOREIGN KEY (match_id) REFERENCES matches (match_id),
                FOREIGN KEY (ai_id) REFERENCES team_ais (ai_id),
                UNIQUE(match_id, ai_id)
            );

            CREATE TABLE IF NOT EXISTS responses (
                response_id     INTEGER     PRIMARY KEY,
                ai_id           INTEGER     NOT NULL,
                match_id        INTEGER     NOT NULL,
                response        TEXT        NOT NULL,
                response_time   REAL,
                created_at      DATETIME    DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (match_id) REFERENCES matches (match_id),
                FOREIGN KEY (ai_id) REFERENCES team_ais (ai_id)
            );

            CREATE TABLE IF NOT EXISTS prompt_metrics (
                metric_id        INTEGER     PRIMARY KEY,
                match_id         INTEGER,
                ai_id            INTEGER,
                team_id          INTEGER,
                service_id       INTEGER,
                service_type     TEXT,
                service_name     TEXT,
                model_name       TEXT,
                prompt_type      TEXT        NOT NULL,
                duration_seconds REAL        NOT NULL DEFAULT 0,
                created_at       DATETIME    DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (match_id) REFERENCES matches (match_id),
                FOREIGN KEY (ai_id) REFERENCES team_ais (ai_id),
                FOREIGN KEY (team_id) REFERENCES teams (team_id),
                FOREIGN KEY (service_id) REFERENCES ai_services (service_id)
            );

            CREATE INDEX IF NOT EXISTS idx_prompt_metrics_match ON prompt_metrics(match_id);
            CREATE INDEX IF NOT EXISTS idx_prompt_metrics_prompt ON prompt_metrics(prompt_type);
            CREATE INDEX IF NOT EXISTS idx_prompt_metrics_ai ON prompt_metrics(ai_id);
            CREATE INDEX IF NOT EXISTS idx_prompt_metrics_service ON prompt_metrics(service_id);

            CREATE TABLE IF NOT EXISTS files (
                file_id         INTEGER     PRIMARY KEY,
                ai_id           INTEGER     NOT NULL,
                match_id        INTEGER     NOT NULL,
                filename        TEXT        NOT NULL,
                created_at      DATETIME    DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (match_id) REFERENCES matches (match_id),
                FOREIGN KEY (ai_id) REFERENCES team_ais (ai_id)
            );

            CREATE TABLE IF NOT EXISTS ai_evaluations (
                evaluation_id     INTEGER     PRIMARY KEY,
                match_id          INTEGER     NOT NULL,
                evaluator_ai_id   INTEGER     NOT NULL,
                evaluated_ai_id   INTEGER     NOT NULL,
                knows_evaluated   INTEGER     DEFAULT 0,
                creativity_score  REAL,
                code_quality_score REAL,
                comments          TEXT,
                created_at        DATETIME    DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (match_id) REFERENCES matches (match_id),
                FOREIGN KEY (evaluator_ai_id) REFERENCES team_ais (ai_id),
                FOREIGN KEY (evaluated_ai_id) REFERENCES team_ais (ai_id)
            );

            CREATE TABLE IF NOT EXISTS game_settings (
                id INTEGER PRIMARY KEY,
                initial_gold INTEGER NOT NULL,
                num_rounds INTEGER NOT NULL,
                error_penalty INTEGER NOT NULL,
                max_errors INTEGER NOT NULL,
                units_number INTEGER NOT NULL DEFAULT 3,
                prompt_mode TEXT NOT NULL DEFAULT 'normal'
            );

            CREATE TABLE IF NOT EXISTS teams (
                team_id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT NOT NULL,
                is_available INTEGER DEFAULT 1,
                deleted INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS ai_services (
                service_id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                api_key TEXT NOT NULL,
                model TEXT NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                is_thinking BOOLEAN DEFAULT 0,
                is_reasoning BOOLEAN DEFAULT 0,
                is_mirror BOOLEAN DEFAULT 0,
                deleted INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS team_ais (
                ai_id INTEGER PRIMARY KEY,
                team_id INTEGER NOT NULL,
                service_id INTEGER NOT NULL,
                FOREIGN KEY (team_id) REFERENCES teams(team_id),
                FOREIGN KEY (service_id) REFERENCES ai_services(service_id)
            );

            CREATE TABLE IF NOT EXISTS ai_available_units (
                id INTEGER PRIMARY KEY,
                team_ai_id INTEGER NOT NULL,
                unit_id TEXT NOT NULL,
                FOREIGN KEY (team_ai_id) REFERENCES team_ais(ai_id),
                UNIQUE(team_ai_id, unit_id)
            );

            CREATE TABLE IF NOT EXISTS ai_purchased_units (
                id INTEGER PRIMARY KEY,
                team_ai_id INTEGER NOT NULL,
                unit_id TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                FOREIGN KEY (team_ai_id) REFERENCES team_ais(ai_id)
            );

            CREATE TABLE IF NOT EXISTS display_settings (
                id INTEGER PRIMARY KEY,
                show_fps_counter BOOLEAN DEFAULT 0,
                show_units_counter BOOLEAN DEFAULT 0,
                show_game_speed_indicator BOOLEAN DEFAULT 0,
                volume INTEGER DEFAULT 50,
                game_speed REAL DEFAULT 1.0,
                map_theme TEXT NOT NULL DEFAULT 'none',
                rain_mode TEXT NOT NULL DEFAULT 'never'
            );

            CREATE TABLE IF NOT EXISTS match_state (
                match_id INTEGER PRIMARY KEY,
                current_round INTEGER NOT NULL DEFAULT 1,
                status TEXT NOT NULL DEFAULT 'in_progress'
            );

            CREATE TABLE IF NOT EXISTS round_history (
                id INTEGER PRIMARY KEY,
                match_id INTEGER NOT NULL,
                round_number INTEGER NOT NULL,
                winner_team_id INTEGER NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (match_id) REFERENCES match_state(match_id),
                FOREIGN KEY (winner_team_id) REFERENCES teams(team_id)
            );

            CREATE TABLE IF NOT EXISTS round_team_states (
                id INTEGER PRIMARY KEY,
                round_history_id INTEGER NOT NULL,
                team_id INTEGER NOT NULL,
                was_alive BOOLEAN NOT NULL,
                FOREIGN KEY (round_history_id) REFERENCES round_history(id),
                FOREIGN KEY (team_id) REFERENCES teams(team_id)
            );

            CREATE TABLE IF NOT EXISTS round_wins (
                id INTEGER PRIMARY KEY,
                match_id INTEGER NOT NULL,
                team_id INTEGER NOT NULL,
                wins_count INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (match_id) REFERENCES match_state(match_id),
                FOREIGN KEY (team_id) REFERENCES teams(team_id),
                UNIQUE(match_id, team_id)
            );

            CREATE INDEX IF NOT EXISTS idx_participants_match ON match_participants(match_id);
            CREATE INDEX IF NOT EXISTS idx_participants_ai ON match_participants(ai_id);
            CREATE INDEX IF NOT EXISTS idx_responses_match ON responses(match_id);
            CREATE INDEX IF NOT EXISTS idx_responses_ai ON responses(ai_id);
            CREATE INDEX IF NOT EXISTS idx_evaluations_match ON ai_evaluations(match_id);
            CREATE INDEX IF NOT EXISTS idx_round_history_match ON round_history(match_id);
            CREATE INDEX IF NOT EXISTS idx_round_wins_match ON round_wins(match_id);
            CREATE INDEX IF NOT EXISTS idx_round_wins_team ON round_wins(team_id);
            CREATE INDEX IF NOT EXISTS idx_files_match ON files(match_id);
            CREATE INDEX IF NOT EXISTS idx_files_ai ON files(ai_id);
        `);

        await ensureGameSettingsSchema(database);
        await ensureMatchParticipantsSchema(database);
        await ensureDisplaySettingsSchema(database);

        console.log('Database initialized successfully');
        return database;
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
}

export async function getDatabase() {
    if (!db) {
        db = await initDatabase();
    }
    return db;
}

export async function createMatch() {
    const database = await getDatabase();
    try {
        const result = await database.runAsync(
            'INSERT INTO matches (start_time, status) VALUES (datetime("now"), "in_progress")'
        );

        const matchId = result.lastID;

        try {
            await database.runAsync(
                'INSERT INTO match_state (match_id, current_round, status) VALUES (?, 1, "in_progress")',
                [matchId]
            );
        } catch (error) {
            console.error('Error creating match state:', error);
        }

        return matchId;
    } catch (error) {
        console.error('Error creating match:', error);
        throw error;
    }
}

export async function addParticipantToMatch(matchId, aiId) {
    const database = await getDatabase();
    try {
        const result = await database.runAsync(
            'INSERT OR IGNORE INTO match_participants (match_id, ai_id) VALUES (?, ?)',
            [matchId, aiId]
        );

        return result.lastID;
    } catch (error) {
        console.error('Error adding participant to match:', error);
        throw error;
    }
}

export async function saveResponse(aiId, matchId, responseText, responseTime) {
    const database = await getDatabase();
    try {
        const result = await database.runAsync(
            'INSERT INTO responses (ai_id, match_id, response, response_time) VALUES (?, ?, ?, ?)',
            [aiId, matchId, responseText, responseTime]
        );

        return result.lastID;
    } catch (error) {
        console.error('Error saving response:', error);
        throw error;
    }
}

export async function incrementParticipantUnits(matchId, aiId, unitsToAdd) {
    const database = await getDatabase();
    try {
        await database.runAsync(
            'UPDATE match_participants SET total_units_created = COALESCE(total_units_created,0) + ? WHERE match_id = ? AND ai_id = ?',
            [unitsToAdd, matchId, aiId]
        );
    } catch (error) {
        console.error('Error incrementing participant units:', error);
        throw error;
    }
}

export async function savePromptMetric(metric) {
    const {
        matchId = null,
        aiId = null,
        teamId = null,
        serviceId = null,
        serviceType = null,
        serviceName = null,
        modelName = null,
        promptType,
        durationSeconds = 0
    } = metric || {};

    if (!promptType) {
        throw new Error('promptType is required to save prompt metric');
    }

    const database = await getDatabase();
    try {
        const result = await database.runAsync(
            `INSERT INTO prompt_metrics 
                (match_id, ai_id, team_id, service_id, service_type, service_name, model_name, prompt_type, duration_seconds) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                matchId,
                aiId,
                teamId,
                serviceId,
                serviceType,
                serviceName,
                modelName,
                promptType,
                durationSeconds
            ]
        );

        return result.lastID;
    } catch (error) {
        console.error('Error saving prompt metric:', error);
        throw error;
    }
}

export async function saveFile(aiId, matchId, filename) {
    const database = await getDatabase();
    try {
        const result = await database.runAsync(
            'INSERT INTO files (ai_id, match_id, filename) VALUES (?, ?, ?)',
            [aiId, matchId, filename]
        );

        return result.lastID;
    } catch (error) {
        console.error('Error saving file record:', error);
        throw error;
    }
}

export async function getFilesByAI(aiId) {
    const database = await getDatabase();
    try {
        return await database.allAsync('SELECT * FROM files WHERE ai_id = ? ORDER BY created_at DESC', [aiId]);
    } catch (error) {
        console.error('Error getting files by AI:', error);
        throw error;
    }
}

export async function getFilesByMatch(matchId) {
    const database = await getDatabase();
    try {
        return await database.allAsync('SELECT * FROM files WHERE match_id = ? ORDER BY ai_id, created_at DESC', [matchId]);
    } catch (error) {
        console.error('Error getting files by match:', error);
        throw error;
    }
}

export async function getFilesByAIAndMatch(aiId, matchId) {
    const database = await getDatabase();
    try {
        return await database.allAsync('SELECT * FROM files WHERE ai_id = ? AND match_id = ? ORDER BY created_at DESC', [aiId, matchId]);
    } catch (error) {
        console.error('Error getting files by AI and match:', error);
        throw error;
    }
}

export async function saveEvaluation(matchId, evaluatorAiId, evaluatedAiId, knowsEvaluated, creativityScore, codeQualityScore, comments) {
    const database = await getDatabase();
    try {
        const result = await database.runAsync(
            'INSERT INTO ai_evaluations (match_id, evaluator_ai_id, evaluated_ai_id, knows_evaluated, creativity_score, code_quality_score, comments) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [matchId, evaluatorAiId, evaluatedAiId, knowsEvaluated, creativityScore, codeQualityScore, comments]
        );

        return result.lastID;
    } catch (error) {
        console.error('Error saving evaluation:', error);
        throw error;
    }
}

export async function completeMatch(matchId, winnerAiId) {
    const database = await getDatabase();
    try {
        await database.runAsync('BEGIN TRANSACTION');

        await database.runAsync(
            'UPDATE matches SET end_time = datetime("now"), status = "completed" WHERE match_id = ?',
            [matchId]
        );

        await database.runAsync(
            'UPDATE match_participants SET is_winner = 1 WHERE match_id = ? AND ai_id = ?',
            [matchId, winnerAiId]
        );

        await database.runAsync(
            'UPDATE match_state SET status = "completed" WHERE match_id = ?',
            [matchId]
        );

        await database.runAsync('COMMIT');

        return true;
    } catch (error) {
        await database.runAsync('ROLLBACK');
        console.error('Error completing match:', error);
        throw error;
    }
}

export async function getMatchDetails(matchId) {
    const database = await getDatabase();
    try {
        const match = await database.getAsync(
            'SELECT * FROM matches WHERE match_id = ?',
            [matchId]
        );

        if (!match) {
            return null;
        }

        const participants = await database.allAsync(
            'SELECT mp.*, s.type as service_type, t.name FROM match_participants mp ' +
            'LEFT JOIN team_ais ta ON mp.ai_id = ta.ai_id ' +
            'LEFT JOIN ai_services s ON ta.service_id = s.service_id ' +
            'LEFT JOIN teams t ON ta.team_id = t.team_id ' +
            'WHERE mp.match_id = ?',
            [matchId]
        );

        const responses = await database.allAsync(
            'SELECT * FROM responses WHERE match_id = ?',
            [matchId]
        );

        const files = await database.allAsync(
            'SELECT * FROM files WHERE match_id = ?',
            [matchId]
        );

        const evaluations = await database.allAsync(
            'SELECT * FROM ai_evaluations WHERE match_id = ?',
            [matchId]
        );

        return {
            match,
            participants,
            responses,
            files,
            evaluations
        };
    } catch (error) {
        console.error('Error getting match details:', error);
        throw error;
    }
}

export async function getAllMatches() {
    const database = await getDatabase();
    try {
        return await database.allAsync('SELECT * FROM matches ORDER BY start_time DESC');
    } catch (error) {
        console.error('Error getting all matches:', error);
        throw error;
    }
}

export async function getGameSettings() {
    const database = await getDatabase();
    try {
        return await database.allAsync('SELECT * FROM game_settings');
    } catch (error) {
        console.error('Error getting game settings:', error);
        throw error;
    }
}

export async function createGameSettings(initialGold, numRounds, errorPenalty, maxErrors, unitsNumber = 3, promptMode = 'normal') {
    const database = await getDatabase();
    try {
        const result = await database.runAsync(
            'INSERT INTO game_settings (initial_gold, num_rounds, error_penalty, max_errors, units_number, prompt_mode) VALUES (?, ?, ?, ?, ?, ?)',
            [initialGold, numRounds, errorPenalty, maxErrors, unitsNumber, promptMode]
        );

        return result.lastID;
    } catch (error) {
        console.error('Error creating game settings:', error);
        throw error;
    }
}

export async function updateGameSettings(id, initialGold, numRounds, errorPenalty, maxErrors, unitsNumber = 3, promptMode = 'normal') {
    const database = await getDatabase();
    try {
        await database.runAsync(
            'UPDATE game_settings SET initial_gold = ?, num_rounds = ?, error_penalty = ?, max_errors = ?, units_number = ?, prompt_mode = ? WHERE id = ?',
            [initialGold, numRounds, errorPenalty, maxErrors, unitsNumber, promptMode, id]
        );
        return { success: true, id };
    } catch (error) {
        console.error('Error updating game settings:', error);
        throw error;
    }
}

export async function deleteGameSettings(id) {
    const database = await getDatabase();
    try {
        await database.runAsync(
            'DELETE FROM game_settings WHERE id = ?',
            [id]
        );
        return id;
    } catch (error) {
        console.error('Error deleting game settings:', error);
        throw error;
    }
}

export async function getTeams() {
    const database = await getDatabase();
    try {
        return await database.allAsync('SELECT * FROM teams WHERE deleted = 0');
    } catch (error) {
        console.error('Error getting teams:', error);
        throw error;
    }
}

export async function createTeam(name, color, isAvailable = true) {
    const database = await getDatabase();
    try {
        const result = await database.runAsync(
            'INSERT INTO teams (name, color, is_available) VALUES (?, ?, ?)',
            [name, color, isAvailable ? 1 : 0]
        );

        return { team_id: result.lastID, name, color, is_available: isAvailable ? 1 : 0 };
    } catch (error) {
        console.error('Error creating team:', error);
        throw error;
    }
}

export async function updateTeam(teamId, name, color, isAvailable) {
    const database = await getDatabase();
    try {
        await database.runAsync(
            'UPDATE teams SET name = ?, color = ?, is_available = ? WHERE team_id = ?',
            [name, color, isAvailable === undefined ? 1 : (isAvailable ? 1 : 0), teamId]
        );
        return { success: true, team_id: teamId };
    } catch (error) {
        console.error('Error updating team:', error);
        throw error;
    }
}

export async function deleteTeam(teamId) {
    const database = await getDatabase();
    try {
        await database.runAsync(
            'UPDATE teams SET deleted = 1 WHERE team_id = ?',
            [teamId]
        );
        return teamId;
    } catch (error) {
        console.error('Error marking team as deleted:', error);
        throw error;
    }
}

export async function getAIServices() {
    const database = await getDatabase();
    try {
        const services = await database.allAsync('SELECT * FROM ai_services WHERE deleted = 0');
        return services.map(service => ({
            ...service,
            api_key: decrypt(service.api_key)
        }));
    } catch (error) {
        console.error('Error getting AI services:', error);
        throw error;
    }
}

export async function createAIService(name, type, endpoint, apiKey, model, isActive, isThinking, isReasoning, isMirror) {
    const database = await getDatabase();
    try {
        const encryptedKey = encrypt(apiKey);
        const result = await database.runAsync(
            'INSERT INTO ai_services (name, type, endpoint, api_key, model, is_active, is_thinking, is_reasoning, is_mirror) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, type, endpoint, encryptedKey, model, isActive ? 1 : 0, isThinking ? 1 : 0, isReasoning ? 1 : 0, isMirror ? 1 : 0]
        );

        return { service_id: result.lastID };
    } catch (error) {
        console.error('Error creating AI service:', error);
        throw error;
    }
}

export async function updateAIService(serviceId, name, type, endpoint, apiKey, model, isActive, isThinking, isReasoning, isMirror) {
    const database = await getDatabase();
    try {
        const encryptedKey = encrypt(apiKey);
        await database.runAsync(
            'UPDATE ai_services SET name = ?, type = ?, endpoint = ?, api_key = ?, model = ?, is_active = ?, is_thinking = ?, is_reasoning = ?, is_mirror = ? WHERE service_id = ?',
            [name, type, endpoint, encryptedKey, model, isActive ? 1 : 0, isThinking ? 1 : 0, isReasoning ? 1 : 0, isMirror ? 1 : 0, serviceId]
        );
        return { success: true, service_id: serviceId };
    } catch (error) {
        console.error('Error updating AI service:', error);
        throw error;
    }
}

export async function deleteAIService(serviceId) {
    const database = await getDatabase();
    try {
        await database.runAsync(
            'UPDATE ai_services SET deleted = 1 WHERE service_id = ?',
            [serviceId]
        );
        return serviceId;
    } catch (error) {
        console.error('Error marking AI service as deleted:', error);
        throw error;
    }
}

export async function getTeamAIs() {
    const database = await getDatabase();
    try {
        return await database.allAsync(`
            SELECT ta.*, t.name as team_name, s.name as service_name, s.type as service_type 
            FROM team_ais ta 
            JOIN teams t ON ta.team_id = t.team_id 
            JOIN ai_services s ON ta.service_id = s.service_id
            WHERE t.deleted = 0 AND s.deleted = 0
        `);
    } catch (error) {
        console.error('Error getting team AIs:', error);
        throw error;
    }
}

export async function createTeamAI(teamId, serviceId) {
    const database = await getDatabase();
    try {
        const result = await database.runAsync(
            'INSERT INTO team_ais (team_id, service_id) VALUES (?, ?)',
            [teamId, serviceId]
        );

        return { ai_id: result.lastID };
    } catch (error) {
        console.error('Error creating team AI:', error);
        throw error;
    }
}

export async function updateTeamAI(aiId, teamId, serviceId) {
    const database = await getDatabase();
    try {
        await database.runAsync(
            'UPDATE team_ais SET team_id = ?, service_id = ? WHERE ai_id = ?',
            [teamId, serviceId, aiId]
        );
        return { success: true, ai_id: aiId };
    } catch (error) {
        console.error('Error updating team AI:', error);
        throw error;
    }
}

export async function deleteTeamAI(aiId) {
    const database = await getDatabase();
    try {
        await database.runAsync('BEGIN TRANSACTION');

        await database.runAsync(
            'DELETE FROM ai_available_units WHERE team_ai_id = ?',
            [aiId]
        );

        await database.runAsync(
            'DELETE FROM ai_purchased_units WHERE team_ai_id = ?',
            [aiId]
        );

        await database.runAsync(
            'DELETE FROM team_ais WHERE ai_id = ?',
            [aiId]
        );

        await database.runAsync('COMMIT');
        return aiId;
    } catch (error) {
        await database.runAsync('ROLLBACK');
        console.error('Error deleting team AI:', error);
        throw error;
    }
}

export async function getAIAvailableUnits() {
    const database = await getDatabase();
    try {
        return await database.allAsync(`
            SELECT au.*, ta.team_id 
            FROM ai_available_units au 
            JOIN team_ais ta ON au.team_ai_id = ta.ai_id
            JOIN teams t ON ta.team_id = t.team_id
            JOIN ai_services s ON ta.service_id = s.service_id
            WHERE t.deleted = 0 AND s.deleted = 0
        `);
    } catch (error) {
        console.error('Error getting AI available units:', error);
        throw error;
    }
}

export async function createAIAvailableUnit(teamAiId, unitId) {
    const database = await getDatabase();
    try {
        const result = await database.runAsync(
            'INSERT OR IGNORE INTO ai_available_units (team_ai_id, unit_id) VALUES (?, ?)',
            [teamAiId, unitId]
        );

        return { id: result.lastID };
    } catch (error) {
        console.error('Error creating AI available unit:', error);
        throw error;
    }
}

export async function deleteAIAvailableUnit(id) {
    const database = await getDatabase();
    try {
        await database.runAsync(
            'DELETE FROM ai_available_units WHERE id = ?',
            [id]
        );
        return { success: true, id };
    } catch (error) {
        console.error('Error deleting AI available unit:', error);
        throw error;
    }
}

export async function getAIPurchasedUnits() {
    const database = await getDatabase();
    try {
        return await database.allAsync(`
            SELECT pu.*, ta.team_id 
            FROM ai_purchased_units pu 
            JOIN team_ais ta ON pu.team_ai_id = ta.ai_id
            JOIN teams t ON ta.team_id = t.team_id
            JOIN ai_services s ON ta.service_id = s.service_id
            WHERE t.deleted = 0 AND s.deleted = 0
        `);
    } catch (error) {
        console.error('Error getting AI purchased units:', error);
        throw error;
    }
}

export async function createAIPurchasedUnit(teamAiId, unitId, quantity) {
    const database = await getDatabase();
    try {
        const result = await database.runAsync(
            'INSERT INTO ai_purchased_units (team_ai_id, unit_id, quantity) VALUES (?, ?, ?)',
            [teamAiId, unitId, quantity]
        );

        return { id: result.lastID };
    } catch (error) {
        console.error('Error creating AI purchased unit:', error);
        throw error;
    }
}

export async function updateAIPurchasedUnit(id, teamAiId, unitId, quantity) {
    const database = await getDatabase();
    try {
        await database.runAsync(
            'UPDATE ai_purchased_units SET team_ai_id = ?, unit_id = ?, quantity = ? WHERE id = ?',
            [teamAiId, unitId, quantity, id]
        );
        return { success: true, id };
    } catch (error) {
        console.error('Error updating AI purchased unit:', error);
        throw error;
    }
}

export async function deleteAIPurchasedUnit(id) {
    const database = await getDatabase();
    try {
        await database.runAsync(
            'DELETE FROM ai_purchased_units WHERE id = ?',
            [id]
        );
        return { success: true, id };
    } catch (error) {
        console.error('Error deleting AI purchased unit:', error);
        throw error;
    }
}

export async function getDisplaySettings() {
    const database = await getDatabase();
    try {
        return await database.allAsync('SELECT * FROM display_settings');
    } catch (error) {
        console.error('Error getting display settings:', error);
        throw error;
    }
}

export async function createDisplaySettings(showFpsCounter, showUnitsCounter, showGameSpeedIndicator, volume, gameSpeed, mapTheme = 'none', rainMode = 'never') {
    const database = await getDatabase();
    try {
        const result = await database.runAsync(
            'INSERT INTO display_settings (show_fps_counter, show_units_counter, show_game_speed_indicator, volume, game_speed, map_theme, rain_mode) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [showFpsCounter ? 1 : 0, showUnitsCounter ? 1 : 0, showGameSpeedIndicator ? 1 : 0, volume, gameSpeed, mapTheme, rainMode]
        );

        return { id: result.lastID };
    } catch (error) {
        console.error('Error creating display settings:', error);
        throw error;
    }
}

export async function updateDisplaySettings(id, showFpsCounter, showUnitsCounter, showGameSpeedIndicator, volume, gameSpeed, mapTheme = 'none', rainMode = 'never') {
    const database = await getDatabase();
    try {
        await database.runAsync(
            'UPDATE display_settings SET show_fps_counter = ?, show_units_counter = ?, show_game_speed_indicator = ?, volume = ?, game_speed = ?, map_theme = ?, rain_mode = ? WHERE id = ?',
            [showFpsCounter ? 1 : 0, showUnitsCounter ? 1 : 0, showGameSpeedIndicator ? 1 : 0, volume, gameSpeed, mapTheme, rainMode, id]
        );
        return { success: true, id };
    } catch (error) {
        console.error('Error updating display settings:', error);
        throw error;
    }
}

export async function deleteDisplaySettings(id) {
    const database = await getDatabase();
    try {
        await database.runAsync(
            'DELETE FROM display_settings WHERE id = ?',
            [id]
        );
        return id;
    } catch (error) {
        console.error('Error deleting display settings:', error);
        throw error;
    }
}

export async function getMatchStates() {
    const database = await getDatabase();
    try {
        return await database.allAsync('SELECT * FROM match_state');
    } catch (error) {
        console.error('Error getting match states:', error);
        throw error;
    }
}

export async function createMatchState(matchId, currentRound, status) {
    const database = await getDatabase();
    try {
        const result = await database.runAsync(
            'INSERT INTO match_state (match_id, current_round, status) VALUES (?, ?, ?)',
            [matchId, currentRound, status]
        );

        return result.lastID;
    } catch (error) {
        console.error('Error creating match state:', error);
        throw error;
    }
}

export async function updateMatchState(matchId, currentRound, status) {
    const database = await getDatabase();
    try {
        await database.runAsync(
            'UPDATE match_state SET current_round = ?, status = ? WHERE match_id = ?',
            [currentRound, status, matchId]
        );
        return { success: true, match_id: matchId };
    } catch (error) {
        console.error('Error updating match state:', error);
        throw error;
    }
}

export async function deleteMatchState(matchId) {
    const database = await getDatabase();
    try {
        await database.runAsync(
            'DELETE FROM match_state WHERE match_id = ?',
            [matchId]
        );
        return matchId;
    } catch (error) {
        console.error('Error deleting match state:', error);
        throw error;
    }
}

export async function getRoundHistory() {
    const database = await getDatabase();
    try {
        return await database.allAsync(`
            SELECT rh.*, t.name as winner_team_name 
            FROM round_history rh 
            JOIN teams t ON rh.winner_team_id = t.team_id
            WHERE t.deleted = 0
        `);
    } catch (error) {
        console.error('Error getting round history:', error);
        throw error;
    }
}

export async function createRoundHistory(matchId, roundNumber, winnerTeamId) {
    const database = await getDatabase();
    try {
        const result = await database.runAsync(
            'INSERT INTO round_history (match_id, round_number, winner_team_id) VALUES (?, ?, ?)',
            [matchId, roundNumber, winnerTeamId]
        );

        return result.lastID;
    } catch (error) {
        console.error('Error creating round history:', error);
        throw error;
    }
}

export async function deleteRoundHistory(id) {
    const database = await getDatabase();
    try {
        await database.runAsync(
            'DELETE FROM round_history WHERE id = ?',
            [id]
        );
        return id;
    } catch (error) {
        console.error('Error deleting round history:', error);
        throw error;
    }
}

export async function getRoundTeamStates() {
    const database = await getDatabase();
    try {
        return await database.allAsync(`
            SELECT rts.*, t.name as team_name 
            FROM round_team_states rts 
            JOIN teams t ON rts.team_id = t.team_id
            WHERE t.deleted = 0
        `);
    } catch (error) {
        console.error('Error getting round team states:', error);
        throw error;
    }
}

export async function createRoundTeamState(roundHistoryId, teamId, wasAlive) {
    const database = await getDatabase();
    try {
        const result = await database.runAsync(
            'INSERT INTO round_team_states (round_history_id, team_id, was_alive) VALUES (?, ?, ?)',
            [roundHistoryId, teamId, wasAlive ? 1 : 0]
        );

        return { id: result.lastID };
    } catch (error) {
        console.error('Error creating round team state:', error);
        throw error;
    }
}

export async function deleteRoundTeamState(id) {
    const database = await getDatabase();
    try {
        await database.runAsync(
            'DELETE FROM round_team_states WHERE id = ?',
            [id]
        );
        return id;
    } catch (error) {
        console.error('Error deleting round team state:', error);
        throw error;
    }
}

export async function getRoundWins() {
    const database = await getDatabase();
    try {
        return await database.allAsync(`
            SELECT rw.*, t.name as team_name 
            FROM round_wins rw 
            JOIN teams t ON rw.team_id = t.team_id
            WHERE t.deleted = 0
        `);
    } catch (error) {
        console.error('Error getting round wins:', error);
        throw error;
    }
}

export async function createRoundWin(matchId, teamId, winsCount) {
    const database = await getDatabase();
    try {
        const result = await database.runAsync(
            'INSERT OR IGNORE INTO round_wins (match_id, team_id, wins_count) VALUES (?, ?, ?)',
            [matchId, teamId, winsCount]
        );

        return result.lastID;
    } catch (error) {
        console.error('Error creating round win:', error);
        throw error;
    }
}

export async function updateRoundWin(id, matchId, teamId, winsCount) {
    const database = await getDatabase();
    try {
        const existingRecord = await database.getAsync(
            'SELECT * FROM round_wins WHERE id = ?',
            [id]
        );

        if (!existingRecord) {
            throw new Error('No se encontró el registro de victorias para actualizar');
        }

        await database.runAsync(
            'UPDATE round_wins SET match_id = ?, team_id = ?, wins_count = ? WHERE id = ?',
            [matchId, teamId, winsCount, id]
        );

        return { success: true, id };
    } catch (error) {
        console.error('Error updating round win:', error);
        throw error;
    }
}

export async function deleteRoundWin(id) {
    const database = await getDatabase();
    try {
        await database.runAsync(
            'DELETE FROM round_wins WHERE id = ?',
            [id]
        );
        return id;
    } catch (error) {
        console.error('Error deleting round win:', error);
        throw error;
    }
}

export async function checkTeamDependencies(teamId) {
    const database = await getDatabase();
    try {
        const result = await database.getAsync(`
            SELECT COUNT(*) as dependency_count 
            FROM match_participants mp 
            JOIN team_ais ta ON mp.ai_id = ta.ai_id 
            WHERE ta.team_id = ?
        `, [teamId]);

        return result ? result.dependency_count > 0 : false;
    } catch (error) {
        console.error('Error checking team dependencies:', error);
        throw error;
    }
}

export async function checkServiceDependencies(serviceId) {
    const database = await getDatabase();
    try {
        const result = await database.getAsync(`
            SELECT COUNT(*) as dependency_count 
            FROM match_participants mp 
            JOIN team_ais ta ON mp.ai_id = ta.ai_id 
            WHERE ta.service_id = ?
        `, [serviceId]);

        return result ? result.dependency_count > 0 : false;
    } catch (error) {
        console.error('Error checking service dependencies:', error);
        throw error;
    }
}

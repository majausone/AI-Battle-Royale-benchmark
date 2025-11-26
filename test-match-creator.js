import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import fs from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getDatabase() {
    return new Promise((resolve, reject) => {
        const dbPath = join(__dirname, 'kewo_battle.db');
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) reject(err);
            else {
                db.runAsync = function(sql, params = []) {
                    return new Promise((resolve, reject) => {
                        this.run(sql, params, function(err) {
                            if (err) return reject(err);
                            resolve({ lastID: this.lastID, changes: this.changes });
                        });
                    });
                };
                db.getAsync = promisify(db.get).bind(db);
                db.allAsync = promisify(db.all).bind(db);
                resolve(db);
            }
        });
    });
}

async function createTestUnit(unitId, matchId, aiId) {
    const unitData = {
        id: unitId,
        name: `TestUnit_${matchId}_${aiId}`,
        cost: 100,
        life: 100,
        attack: 20,
        defense: 10,
        speed: 5,
        range: 3,
        skills: ['testSkill'],
        description: 'Test unit created by test script'
    };

    const skillData = {
        id: 'testSkill',
        name: 'Test Skill',
        type: 'attack',
        damage: 30,
        cooldown: 2,
        range: 3,
        cost: 20
    };

    const seffectData = {
        id: 'testSeffect',
        duration: 3,
        type: 'buff',
        stat: 'attack',
        value: 10
    };

    const fxData = {
        id: 'testFx',
        type: 'particle',
        color: '#FF0000',
        duration: 1,
        size: 10
    };

    const filename = `unit-${unitId}-${Date.now()}.json`;
    const skillFilename = `skill-${unitId}-${Date.now()}.json`;
    const seffectFilename = `seffect-${unitId}-${Date.now()}.json`;
    const fxFilename = `fx-${unitId}-${Date.now()}.json`;

    const unitsDir = join(__dirname, 'public', 'units');
    const skillsDir = join(__dirname, 'public', 'skills');
    const seffectsDir = join(__dirname, 'public', 'seffects');
    const fxDir = join(__dirname, 'public', 'fx');

    await fs.mkdir(unitsDir, { recursive: true });
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.mkdir(seffectsDir, { recursive: true });
    await fs.mkdir(fxDir, { recursive: true });

    await fs.writeFile(join(unitsDir, filename), JSON.stringify(unitData, null, 2));
    await fs.writeFile(join(skillsDir, skillFilename), JSON.stringify(skillData, null, 2));
    await fs.writeFile(join(seffectsDir, seffectFilename), JSON.stringify(seffectData, null, 2));
    await fs.writeFile(join(fxDir, fxFilename), JSON.stringify(fxData, null, 2));

    return { filename, skillFilename, seffectFilename, fxFilename };
}

async function main() {
    console.log('Starting test match creation...');
    
    const db = await getDatabase();

    await db.runAsync('BEGIN TRANSACTION');

    try {
        let serviceId = await db.getAsync('SELECT service_id FROM ai_services WHERE deleted = 0 LIMIT 1');
        if (!serviceId) {
            const result = await db.runAsync(
                'INSERT INTO ai_services (name, type, endpoint, api_key, model, is_active) VALUES (?, ?, ?, ?, ?, ?)',
                ['TestService', 'openai', 'http://test', 'test-key', 'gpt-4', 1]
            );
            serviceId = { service_id: result.lastID };
        }
        console.log('Service ID:', serviceId.service_id);

        let teamId = await db.getAsync('SELECT team_id FROM teams WHERE deleted = 0 LIMIT 1');
        if (!teamId) {
            const result = await db.runAsync(
                'INSERT INTO teams (name, color, is_available) VALUES (?, ?, ?)',
                ['TestTeam', '#FF0000', 1]
            );
            teamId = { team_id: result.lastID };
        }
        console.log('Team ID:', teamId.team_id);

        const aiResult = await db.runAsync(
            'INSERT INTO team_ais (team_id, service_id) VALUES (?, ?)',
            [teamId.team_id, serviceId.service_id]
        );
        const aiId = aiResult.lastID;
        console.log('AI ID:', aiId);

        const matchResult = await db.runAsync(
            'INSERT INTO matches (start_time, status) VALUES (datetime("now"), "completed")'
        );
        const matchId = matchResult.lastID;
        console.log('Match ID:', matchId);

        await db.runAsync(
            'INSERT INTO match_state (match_id, current_round, status) VALUES (?, ?, ?)',
            [matchId, 5, 'completed']
        );

        await db.runAsync(
            'INSERT INTO match_participants (match_id, ai_id, is_winner) VALUES (?, ?, ?)',
            [matchId, aiId, 1]
        );

        console.log('Creating test files...');
        const { filename, skillFilename, seffectFilename, fxFilename } = await createTestUnit(`test-${matchId}`, matchId, aiId);

        await db.runAsync(
            'INSERT INTO files (ai_id, match_id, filename) VALUES (?, ?, ?)',
            [aiId, matchId, filename]
        );
        await db.runAsync(
            'INSERT INTO files (ai_id, match_id, filename) VALUES (?, ?, ?)',
            [aiId, matchId, skillFilename]
        );
        await db.runAsync(
            'INSERT INTO files (ai_id, match_id, filename) VALUES (?, ?, ?)',
            [aiId, matchId, seffectFilename]
        );
        await db.runAsync(
            'INSERT INTO files (ai_id, match_id, filename) VALUES (?, ?, ?)',
            [aiId, matchId, fxFilename]
        );

        await db.runAsync(
            'INSERT INTO responses (ai_id, match_id, response, response_time) VALUES (?, ?, ?, ?)',
            [aiId, matchId, '{"unit": "test"}', 0, 0, 1.5]
        );

        await db.runAsync(
            'INSERT INTO round_history (match_id, round_number, winner_team_id) VALUES (?, ?, ?)',
            [matchId, 1, teamId.team_id]
        );

        await db.runAsync(
            'INSERT INTO round_wins (match_id, team_id, wins_count) VALUES (?, ?, ?)',
            [matchId, teamId.team_id, 3]
        );

        await db.runAsync('COMMIT');

        console.log('\n=== Test Match Created Successfully ===');
        console.log(`Match ID: ${matchId}`);
        console.log(`AI ID: ${aiId}`);
        console.log(`Team ID: ${teamId.team_id}`);
        console.log(`Files created:`);
        console.log(`  - ${filename}`);
        console.log(`  - ${skillFilename}`);
        console.log(`  - ${seffectFilename}`);
        console.log(`  - ${fxFilename}`);
        console.log('\nYou can now test the Delete All functionality in the Data tab.');

    } catch (error) {
        await db.runAsync('ROLLBACK');
        console.error('Error creating test match:', error);
        throw error;
    } finally {
        db.close();
    }
}

main().catch(console.error);

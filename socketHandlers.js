import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
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
    getRoundWins,
    createAIAvailableUnit,
    addParticipantToMatch,
    saveResponse,
    saveFile,
    savePromptMetric,
    incrementParticipantUnits
} from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Issue tracking weights: errors count as 4, warnings count as 1 with a 30-issue cap
const ISSUE_LIMIT = 30;
const ERROR_WEIGHT = 4;
const WARNING_WEIGHT = 1;

async function callLLM(serviceType, serviceModel, serviceApiKey, prompt, isReasoning = false, isMirror = false, serviceEndpoint = null) {
    let responseText = "";

    try {
        if (serviceType === 'claude') {
            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'x-api-key': serviceApiKey
                },
                body: JSON.stringify({
                    model: serviceModel,
                    messages: [{
                        role: "user",
                        content: prompt
                    }],
                    max_tokens: 64000,
                    temperature: 1.0
                })
            });

            if (!response.ok) {
                throw new Error(`Claude API error: ${await response.text()}`);
            }

            const data = await response.json();
            responseText = data.content[0]?.text || "";
        }
        else if (serviceType === 'deepseek') {
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceApiKey}`
            };

            const requestBody = {
                model: serviceModel,
                messages: [{
                    role: "user",
                    content: prompt
                }],
                max_tokens: 8192,
                temperature: 1.0
            };

            if (isMirror) {
                requestBody.mirror = true;
            }

            const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`DeepSeek API error: ${await response.text()}`);
            }

            const data = await response.json();
            if (data.choices && data.choices.length > 0) {
                responseText = data.choices[0].message.content;
            }
        }
        else if (serviceType === 'gemini') {
            const isThinkingModel = serviceModel.includes('2.5');
            
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${serviceModel}:generateContent?key=${serviceApiKey}`;
            
            const requestBody = {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    maxOutputTokens: 64000,
                    temperature: 0.7
                }
            };
            
            if (isThinkingModel) {
                const thinkingBudget = serviceModel.includes('pro') ? 10000 : 5000;
                requestBody.generationConfig.thinkingConfig = {
                    thinkingBudget: thinkingBudget
                };
            }
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`Gemini API error: ${await response.text()}`);
            }

            const data = await response.json();
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                responseText = data.candidates[0].content.parts[0].text || "";
            }
        }
        else if (serviceType === 'grok') {
            const response = await fetch("https://api.x.ai/v1/chat/completions", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${serviceApiKey}`
                },
                body: JSON.stringify({
                    model: serviceModel,
                    messages: [{
                        role: "user",
                        content: prompt
                    }],
                    max_tokens: 64000
                })
            });

            if (!response.ok) {
                throw new Error(`Grok API error: ${await response.text()}`);
            }

            const data = await response.json();
            if (data.choices && data.choices.length > 0) {
                responseText = data.choices[0].message.content;
            }
        }
        else if (serviceType === 'moonshot') {
            const endpoint = serviceEndpoint || 'https://api.moonshot.ai/v1/chat/completions';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${serviceApiKey}`
                },
                body: JSON.stringify({
                    model: serviceModel,
                    messages: [{
                        role: "user",
                        content: prompt
                    }],
                    temperature: 0.7,
                    max_tokens: 64000
                })
            });

            if (!response.ok) {
                throw new Error(`Moonshot API error: ${await response.text()}`);
            }

            const data = await response.json();
            if (data.choices && data.choices.length > 0) {
                const message = data.choices[0].message;
                if (typeof message === 'string') {
                    responseText = message;
                } else if (message?.content) {
                    responseText = Array.isArray(message.content)
                        ? message.content.map(part => part?.text || part).join('\n')
                        : message.content;
                }
            }
        }
        else if (serviceType === 'chatgpt' && isReasoning) {
            const isO3Model = serviceModel.startsWith('o3-');

            if (isO3Model) {
                const requestBody = {
                    model: serviceModel,
                    input: [{
                        role: "user",
                        content: prompt
                    }],
                    reasoning: { effort: "high" },
                    max_output_tokens: 64000,
                    temperature: 1.0
                };

                const response = await fetch("https://api.openai.com/v1/responses", {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${serviceApiKey}`
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
                }

                const data = await response.json();

                if (data.output_text) {
                    responseText = data.output_text;
                } else if (data.output && Array.isArray(data.output)) {
                    for (const item of data.output) {
                        if (item.content && Array.isArray(item.content)) {
                            for (const contentItem of item.content) {
                                if (contentItem.type === "output_text" && contentItem.text) {
                                    responseText += contentItem.text;
                                }
                            }
                        }
                    }
                } else {
                    responseText = JSON.stringify(data);
                }
            } else {
                const requestBody = {
                    model: serviceModel,
                    messages: [{
                        role: "user",
                        content: prompt
                    }],
                    max_completion_tokens: 64000,
                    temperature: 1.0
                };

                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${serviceApiKey}`
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
                }

                const data = await response.json();

                if (data.choices && data.choices.length > 0) {
                    responseText = data.choices[0].message.content;
                } else {
                    responseText = JSON.stringify(data);
                }
            }
        }
        else {
            const endpoint = (serviceType === 'custom' || serviceType === 'chatgpt') && serviceEndpoint ? serviceEndpoint : "https://api.openai.com/v1/chat/completions";
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${serviceApiKey}`
                },
                body: JSON.stringify({
                    model: serviceModel,
                    messages: [{
                        role: "user",
                        content: prompt
                    }],
                    max_completion_tokens: 64000,
                    temperature: 1.0
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${await response.text()}`);
            }

            const data = await response.json();
            if (data.choices && data.choices.length > 0) {
                responseText = data.choices[0].message.content;
            }
        }

    return responseText;
} catch (error) {
    throw error;
}
}

async function listExistingIds(directory, extension) {
    try {
        const entries = await fs.readdir(join(__dirname, 'public', directory));
        return new Set(
            entries
                .filter(name => name.endsWith(extension))
                .map(name => name.replace(extension, ''))
        );
    } catch (error) {
        console.error(`[Validation] Unable to read ${directory} directory:`, error.message);
        return new Set();
    }
}

function extractSkillDependencies(code = "") {
    const seffects = [];
    const fx = [];

    const seffectRegex = /seffects?\s*:\s*["'`]([^"'`]+)["'`]/g;
    let match;
    while ((match = seffectRegex.exec(code)) !== null) {
        seffects.push(match[1]);
    }

    const fxKeys = ['start', 'end', 'continuous', 'impact'];
    fxKeys.forEach(key => {
        const regex = new RegExp(`${key}\\s*:\\s*["'\\\`]([^"'\\\`]+)["'\\\`]`, 'g');
        let fxMatch;
        while ((fxMatch = regex.exec(code)) !== null) {
            fx.push(fxMatch[1]);
        }
    });

    return { seffects, fx };
}

function collectSeffectFx(effect = {}) {
    const fx = [];

    const fxSources = [effect.targetFx, effect.sourceFx];
    fxSources.forEach(source => {
        if (source?.start) fx.push(source.start);
        if (source?.continuous) fx.push(source.continuous);
        if (source?.end) fx.push(source.end);
    });

    if (effect.pulseFx) {
        fx.push(effect.pulseFx);
    }

    return fx.filter(Boolean);
}

function addIssue(issues, cache, issue) {
    const key = `${issue.fileName}:${issue.message}:${issue.isError ? 'error' : 'warn'}`;
    if (cache.has(key)) return;
    cache.add(key);
    issues.push(issue);
}

async function processAIResponse(textContent, ai, matchId) {
    if (!textContent) {
        return {
            success: false,
            error: 'No text content to process',
            errors: [{
                fileName: `request-units-${ai?.id || 'unknown'}.json`,
                message: 'The AI did not return any content for the request units prompt.',
                isError: true,
                errorIncrement: 1
            }]
        };
    }

    try {
        const files = {};
        let currentFileName = '';
        let currentContent = [];
        const lines = textContent.split('\n');
        let foundFiles = false;
        const savedFiles = [];
    const issues = [];
    const issueKeys = new Set();
    const createdUnits = new Map();
    const createdSeffects = new Map();
        const createdSkills = new Map();
        const createdFx = new Set();
        // Ensure DB row even when parse fails
        const ensureFileRecord = async (fileName) => {
            if (!matchId || !ai?.id || !fileName) return;
            const db = await getDatabase();
            const existing = await db.getAsync(
                'SELECT file_id FROM files WHERE ai_id = ? AND match_id = ? AND filename = ?',
                [ai.id, matchId, fileName]
            );
            if (!existing) {
                await saveFile(ai.id, matchId, fileName);
            }
        };

        const existingSkills = await listExistingIds('skills', '.js');
        const existingSeffects = await listExistingIds('seffects', '.json');
        const existingFx = await listExistingIds('fx', '.js');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.startsWith('//') && (line.endsWith('.json') || line.endsWith('.js'))) {
                foundFiles = true;

                if (currentFileName) {
                    files[currentFileName] = currentContent.join('\n').trim();
                }

                currentFileName = line.substring(2).trim();
                currentContent = [];
            } else if (currentFileName) {
                currentContent.push(lines[i]);
            }
        }

        if (currentFileName) {
            files[currentFileName] = currentContent.join('\n').trim();
        }

        if (!foundFiles) {
            addIssue(issues, issueKeys, {
                fileName: `response-${ai?.id || 'unknown'}.txt`,
                message: 'No file markers found in AI response. The model did not use the expected format.',
                isError: true,
                errorIncrement: 1
            });
            return {
                success: false,
                error: 'No file markers found in AI response. The model did not use the expected format.',
                errors: issues
            };
        }

        const fileNames = Object.keys(files);

        if (fileNames.length === 0) {
            addIssue(issues, issueKeys, {
                fileName: `response-${ai?.id || 'unknown'}.txt`,
                message: 'No files found in AI response. The AI response did not contain the expected format.',
                isError: true,
                errorIncrement: 1
            });
            return {
                success: false,
                error: 'No files found in AI response. The AI response did not contain the expected format.',
                errors: issues
            };
        }

        let unitIds = [];

        for (const [fileName, content] of Object.entries(files)) {
            const baseFileName = fileName.replace(/\.(js|json)$/, '');

            if (fileName.endsWith('.json')) {
                if (baseFileName.startsWith('seffect-')) {
                    let seffectData = null;
                    if (content && content.trim()) {
                        try {
                            seffectData = JSON.parse(content);
                        } catch (error) {
                            addIssue(issues, issueKeys, {
                                fileName,
                                message: `Error parsing JSON for seffect ${fileName}: ${error.message}`,
                                isError: true
                            });
                            await ensureFileRecord(fileName);
                            continue;
                        }
                    }

                    await saveFileToFS('seffects', fileName, content);
                    savedFiles.push(fileName);
                    if (matchId) {
                        await saveFile(ai.id, matchId, fileName);
                    }

                    if (seffectData && (seffectData.id || baseFileName)) {
                        createdSeffects.set(seffectData.id || baseFileName, seffectData);
                    }
                } else {
                    try {
                        const unitData = JSON.parse(content);
                        unitIds.push(unitData.id);
                        createdUnits.set(unitData.id, unitData);

                        await saveFileToFS('units', fileName, content);
                        savedFiles.push(fileName);
                        if (matchId) {
                            await saveFile(ai.id, matchId, fileName);
                        }
                    } catch (error) {
                        addIssue(issues, issueKeys, {
                            fileName,
                            message: `Error parsing JSON for unit ${fileName}: ${error.message}`,
                            isError: true,
                            errorIncrement: 1
                        });
                        await ensureFileRecord(fileName);
                        continue;
                    }
                }
            } else if (baseFileName.startsWith('skill-')) {
                await saveFileToFS('skills', fileName, content);
                createdSkills.set(baseFileName, content);
                savedFiles.push(fileName);
                if (matchId) {
                    await saveFile(ai.id, matchId, fileName);
                }
            } else if (baseFileName.startsWith('fx-')) {
                await saveFileToFS('fx', fileName, content);
                createdFx.add(baseFileName);
                savedFiles.push(fileName);
                if (matchId) {
                    await saveFile(ai.id, matchId, fileName);
                }
            }
        }

        if (unitIds.length === 0) {
            addIssue(issues, issueKeys, {
                fileName: `response-${ai?.id || 'unknown'}.txt`,
                message: 'No valid units found in AI response',
                isError: true,
                errorIncrement: 1
            });
            return {
                success: false,
                error: 'No valid units found in AI response',
                errors: issues
            };
        }

        const allSkills = new Set([...existingSkills, ...createdSkills.keys()]);
        const allSeffects = new Set([...existingSeffects, ...createdSeffects.keys()]);
        const allFx = new Set([...existingFx, ...createdFx]);

        createdUnits.forEach((unitData, unitId) => {
            const unitFile = `${unitId || 'unit-unknown'}.json`;

            if (Array.isArray(unitData?.skills)) {
                unitData.skills.forEach(skillId => {
                    if (skillId && !allSkills.has(skillId)) {
                        addIssue(issues, issueKeys, {
                            fileName: unitFile,
                            message: `Missing skill '${skillId}' referenced by unit '${unitId || unitFile}'.`,
                            isError: true
                        });
                    }
                });
            }

            if (unitData?.effects && typeof unitData.effects === 'object') {
                Object.values(unitData.effects).forEach(fxId => {
                    if (fxId && !allFx.has(fxId)) {
                        addIssue(issues, issueKeys, {
                            fileName: unitFile,
                            message: `Missing FX '${fxId}' referenced by unit '${unitId || unitFile}'.`,
                            isError: true
                        });
                    }
                });
            }
        });

        createdSkills.forEach((code, skillId) => {
            const { seffects, fx } = extractSkillDependencies(code);
            const skillFile = `${skillId}.js`;

            seffects.forEach(effectId => {
                if (effectId && !allSeffects.has(effectId)) {
                    addIssue(issues, issueKeys, {
                        fileName: skillFile,
                        message: `Missing seffect '${effectId}' referenced by skill '${skillId}'.`,
                        isError: true
                    });
                }
            });

            fx.forEach(fxId => {
                if (fxId && !allFx.has(fxId)) {
                    addIssue(issues, issueKeys, {
                        fileName: skillFile,
                        message: `Missing FX '${fxId}' referenced by skill '${skillId}'.`,
                        isError: true
                    });
                }
            });
        });

        createdSeffects.forEach((effectData, seffectId) => {
            const seffectFile = `${seffectId || 'seffect-unknown'}.json`;

            if (effectData?.targetEffectId && !allSeffects.has(effectData.targetEffectId)) {
                addIssue(issues, issueKeys, {
                    fileName: seffectFile,
                    message: `Missing target effect '${effectData.targetEffectId}' referenced by '${seffectId || seffectFile}'.`,
                    isError: true
                });
            }

            collectSeffectFx(effectData).forEach(fxId => {
                if (fxId && !allFx.has(fxId)) {
                    addIssue(issues, issueKeys, {
                        fileName: seffectFile,
                        message: `Missing FX '${fxId}' referenced by '${seffectId || seffectFile}'.`,
                        isError: true
                    });
                }
            });
        });

        try {
            const settings = await getGameSettings();
            const expectedUnits = parseInt(settings?.[0]?.units_number, 10);

            if (!Number.isNaN(expectedUnits) && expectedUnits > 0 && unitIds.length < expectedUnits) {
                const missingUnits = expectedUnits - unitIds.length;
                addIssue(issues, issueKeys, {
                    fileName: `request-units-${ai.id}.json`,
                    message: `The AI created ${unitIds.length}/${expectedUnits} units. Missing ${missingUnits} required units.`,
                    isError: false,
                    warningIncrement: missingUnits
                });
            }
        } catch (error) {
            console.error('Error checking expected units count:', error);
        }

        for (const unitId of unitIds) {
            if (!ai.availableUnits.includes(unitId)) {
                ai.availableUnits.push(unitId);
                await createAIAvailableUnit(ai.id, unitId);
            }
        }

        return {
            success: true,
            unitIds,
            savedFiles,
            errors: issues
        };
    } catch (error) {
        return {
            success: false,
            error: `Error processing AI response: ${error.message}`,
            errors: []
        };
    }
}

async function saveFileToFS(directory, fileName, content) {
    try {
        const filePath = join(__dirname, 'public', directory, fileName);
        const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 4);
        await fs.writeFile(filePath, fileContent);
        return true;
    } catch (error) {
        throw error;
    }
}

async function getAvailableTeams() {
    const db = await getDatabase();
    const availableTeams = await db.allAsync(
        'SELECT * FROM teams WHERE is_available = 1 AND deleted = 0'
    );
    return availableTeams;
}

async function ensureMatchParticipant(matchId, aiId) {
    if ((!matchId && matchId !== 0) || (!aiId && aiId !== 0)) {
        return false;
    }

    try {
        await addParticipantToMatch(matchId, aiId);
        return true;
    } catch (error) {
        console.error(`[ValidationLog-Server] Failed to ensure participant for match ${matchId}, AI ${aiId}:`, error);
        return false;
    }
}

async function updateResponseIssues(matchId, aiId, errorIncrement = 0, warningIncrement = 0) {
    if (!matchId && matchId !== 0) {
        return {
            acceptedErrors: 0,
            acceptedWarnings: 0,
            totals: { errors: 0, warnings: 0 },
            remainingWeight: ISSUE_LIMIT,
            reason: 'matchId missing',
            rowsChanged: 0,
            updatedMatchId: null
        };
    }

    if (!aiId && aiId !== 0) {
        return {
            acceptedErrors: 0,
            acceptedWarnings: 0,
            totals: { errors: 0, warnings: 0 },
            remainingWeight: ISSUE_LIMIT,
            reason: 'AI missing',
            rowsChanged: 0,
            updatedMatchId: null
        };
    }

    if (errorIncrement === 0 && warningIncrement === 0) {
        const currentTotals = await getCurrentIssueTotals(matchId, aiId);
        const remainingWeight = Math.max(0, ISSUE_LIMIT - (currentTotals.errors * ERROR_WEIGHT + currentTotals.warnings * WARNING_WEIGHT));
        return {
            acceptedErrors: 0,
            acceptedWarnings: 0,
            totals: currentTotals,
            remainingWeight,
            reason: remainingWeight > 0 ? null : 'issue cap reached',
            rowsChanged: 0,
            updatedMatchId: matchId
        };
    }

    try {
        const db = await getDatabase();
        const aggregateTotals = await getCurrentIssueTotals(matchId, aiId);

        // Ensure participant exists
        let participant = await db.getAsync('SELECT has_errors, has_warnings FROM match_participants WHERE match_id = ? AND ai_id = ?', [matchId, aiId]);
        if (!participant) {
            const ensured = await ensureMatchParticipant(matchId, aiId);
            if (ensured) {
                participant = await db.getAsync('SELECT has_errors, has_warnings FROM match_participants WHERE match_id = ? AND ai_id = ?', [matchId, aiId]);
            }
        }
        if (!participant) {
            return {
                acceptedErrors: 0,
                acceptedWarnings: 0,
                totals: { errors: 0, warnings: 0 },
                remainingWeight: ISSUE_LIMIT,
                reason: `participant not found/created for match ${matchId}`,
                rowsChanged: 0,
                updatedMatchId: matchId
            };
        }

        const usedWeight = (aggregateTotals.errors * ERROR_WEIGHT) + (aggregateTotals.warnings * WARNING_WEIGHT);
        let remainingWeight = Math.max(0, ISSUE_LIMIT - usedWeight);
        if (remainingWeight <= 0) {
            return {
                acceptedErrors: 0,
                acceptedWarnings: 0,
                totals: aggregateTotals,
                remainingWeight,
                reason: 'issue cap reached',
                rowsChanged: 0,
                updatedMatchId: matchId
            };
        }

        const allowedErrors = errorIncrement > 0
            ? Math.min(errorIncrement, Math.floor(remainingWeight / ERROR_WEIGHT))
            : 0;

        remainingWeight -= allowedErrors * ERROR_WEIGHT;

        const allowedWarnings = warningIncrement > 0
            ? Math.min(warningIncrement, remainingWeight)
            : 0;

        if (allowedErrors === 0 && allowedWarnings === 0) {
            return {
                acceptedErrors: 0,
                acceptedWarnings: 0,
                totals: aggregateTotals,
                remainingWeight,
                reason: 'issue cap reached',
                rowsChanged: 0,
                updatedMatchId: matchId
            };
        }

        const updateResult = await db.runAsync(
            'UPDATE match_participants SET has_errors = has_errors + ?, has_warnings = has_warnings + ? WHERE match_id = ? AND ai_id = ?',
            [allowedErrors, allowedWarnings, matchId, aiId]
        );

        const newTotals = {
            errors: aggregateTotals.errors + allowedErrors,
            warnings: aggregateTotals.warnings + allowedWarnings
        };
        const updatedRemaining = Math.max(0, ISSUE_LIMIT - (newTotals.errors * ERROR_WEIGHT + newTotals.warnings * WARNING_WEIGHT));
        const rowsChanged = updateResult?.changes || 0;
        const reason = rowsChanged > 0 ? null : 'participant update failed';

        return {
            acceptedErrors: allowedErrors,
            acceptedWarnings: allowedWarnings,
            totals: newTotals,
            remainingWeight: updatedRemaining,
            reason,
            rowsChanged,
            updatedMatchId: matchId
        };
    } catch (error) {
        console.error('[ValidationLog-Server] Error updating response issues:', error);
        return {
            acceptedErrors: 0,
            acceptedWarnings: 0,
            totals: { errors: 0, warnings: 0 },
            remainingWeight: ISSUE_LIMIT,
            reason: error.message || 'db error applying issues',
            rowsChanged: 0,
            updatedMatchId: matchId
        };
    }
}

async function getCurrentIssueTotals(matchId, aiId) {
    if (!aiId) return { errors: 0, warnings: 0 };
    const db = await getDatabase();
    const row = matchId
        ? await db.getAsync('SELECT COALESCE(SUM(has_errors),0) as errors, COALESCE(SUM(has_warnings),0) as warnings FROM match_participants WHERE match_id = ? AND ai_id = ?', [matchId, aiId])
        : await db.getAsync('SELECT COALESCE(SUM(has_errors),0) as errors, COALESCE(SUM(has_warnings),0) as warnings FROM match_participants WHERE ai_id = ?', [aiId]);
    return {
        errors: row?.errors || 0,
        warnings: row?.warnings || 0
    };
}

function clampIssues(issues = [], totals = { errors: 0, warnings: 0 }, limit = ISSUE_LIMIT) {
    let remainingWeight = Math.max(0, limit - (totals.errors * ERROR_WEIGHT + totals.warnings * WARNING_WEIGHT));
    if (remainingWeight === 0) {
        return [];
    }

    const weightedIssues = issues.map(issue => {
        const errorInc = issue.errorIncrement !== undefined
            ? Number(issue.errorIncrement) || 0
            : (issue.isError ? 1 : 0);
        const warningInc = issue.warningIncrement !== undefined
            ? Number(issue.warningIncrement) || 0
            : (issue.isError ? 0 : 1);
        const weight = (errorInc * ERROR_WEIGHT) + (warningInc * WARNING_WEIGHT);
        return { issue, weight, errorInc, warningInc };
    }).sort((a, b) => {
        if (a.issue.isError && !b.issue.isError) return -1;
        if (!a.issue.isError && b.issue.isError) return 1;
        return b.weight - a.weight;
    });

    const selected = [];
    for (const { issue, weight } of weightedIssues) {
        if (weight <= 0) continue;
        if (remainingWeight - weight < 0) continue;
        selected.push(issue);
        remainingWeight -= weight;
        if (remainingWeight <= 0) break;
    }

    return selected;
}

function mapIssuesToPayload(issues, team, ai, serviceName, matchId = null) {
    if (!issues || issues.length === 0) {
        return [];
    }

    const aiId = ai?.ai_id || ai?.id || null;
    const teamId = team?.team_id || team?.id || null;

    return issues.map(issue => ({
        filename: issue.fileName,
        message: issue.message,
        isError: issue.isError !== undefined ? issue.isError : true,
        warningIncrement: issue.warningIncrement !== undefined ? issue.warningIncrement : (issue.isError ? 0 : 1),
        errorIncrement: issue.errorIncrement !== undefined ? issue.errorIncrement : (issue.isError ? 1 : 0),
        aiId,
        teamId,
        teamName: team?.name || null,
        aiName: serviceName || null,
        matchId
    }));
}

async function getRequestUnitsPromptText() {
    const promptPath = join(__dirname, 'public', 'promt-resquest-unit.txt');
    const promptTemplate = await fs.readFile(promptPath, 'utf8');
    let unitsNumber = 3;
    let promptMode = 'normal';

    try {
        const settings = await getGameSettings();
        if (settings && settings.length > 0) {
            const storedValue = parseInt(settings[0].units_number, 10);
            if (!Number.isNaN(storedValue)) {
                unitsNumber = storedValue;
            }
            const storedPromptMode = (settings[0].prompt_mode || '').toString().toLowerCase();
            if (['crazy', 'boss'].includes(storedPromptMode)) {
                promptMode = storedPromptMode;
            }
        }
    } catch (error) {
        console.warn('Unable to load game settings, using defaults:', error.message);
    }

    let prompt = promptTemplate.replace(/{{UNITS_NUMBER}}/g, unitsNumber);

    if (promptMode === 'crazy') {
        prompt += '\n\nCreate units that are spectacular both visually and in their FX; go wild and make them incredible.';
    } else if (promptMode === 'boss') {
        prompt += '\n\nBOSS MODE: One of the units MUST be a BOSS — significantly stronger and bigger than the others, with a 15x15 sprite. It must include animationGraphics (move1, move2, attack) mandatory. Make it obvious which unit is the BOSS and keep the others normal sized (<=12x12).';
    }

    return { prompt, unitsNumber };
}

export function setupSocketHandlers(io) {
    io.on('connection', (socket) => {
        socket.on('requestUnits', async (data) => {
            try {
                const matchId = data?.matchId || null;

                socket.emit('requestStatus', {
                    status: 'started',
                    matchId,
                    message: 'Starting units request process'
                });

                try {
                    const { prompt: promptText, unitsNumber } = await getRequestUnitsPromptText();

                    const teams = await getAvailableTeams();
                    const teamAIs = await getTeamAIs();
                    const aiServices = await getAIServices();

                    const tasks = [];

                    for (const team of teams) {
                        const ais = teamAIs.filter(ai => ai.team_id === team.team_id);

                        for (const ai of ais) {
                            const service = aiServices.find(s => s.service_id === ai.service_id && s.is_active === 1);
                            if (!service) continue;

                            const task = (async () => {
                                if (matchId !== null && matchId !== undefined) {
                                    await ensureMatchParticipant(matchId, ai.ai_id);
                                }

                                const serviceName = service.name || service.type;
                                const modelName = service.model || 'Unknown model';

                                socket.emit('requestStatus', {
                                    status: 'processing',
                                    teamId: team.team_id,
                                    aiId: ai.ai_id,
                                    teamName: team.name,
                                    matchId,
                                    message: `Sending request units prompt to ${team.name} using ${serviceName} (${modelName})`,
                                    expectedUnits: unitsNumber,
                                    receivedUnits: 0,
                                    durationSeconds: null
                                });

                                try {
                                    const startTime = Date.now();

                                    socket.emit('requestStatus', {
                                        status: 'processing',
                                        teamId: team.team_id,
                                        aiId: ai.ai_id,
                                        teamName: team.name,
                                        matchId,
                                        message: `Waiting for response from ${team.name}...`
                                    });

                                    const uniquePrompt = `${promptText}\n\n---\nAI Service: ${serviceName}\nModel: ${modelName}\nTeam: ${team.name}\nTimestamp: ${Date.now()}\nNote: Create UNIQUE units different from what other AI models might generate. Be creative and avoid common or obvious concepts.`;

                                    const responseText = await callLLM(
                                        service.type,
                                        service.model,
                                        service.api_key,
                                        uniquePrompt,
                                        service.is_reasoning === 1,
                                        service.is_mirror === 1,
                                        service.endpoint
                                    );

                                    const responseTime = (Date.now() - startTime) / 1000;

                                    // Hold for 60s after response (do not count in responseTime) so others keep waiting
                                    if (service.type === 'claude') {
                                        await new Promise(resolve => setTimeout(resolve, 60000));
                                    }

                                    socket.emit('requestStatus', {
                                        status: 'processing',
                                        teamId: team.team_id,
                                        aiId: ai.ai_id,
                                        teamName: team.name,
                                        matchId,
                                        message: `Processing response from ${team.name}...`
                                    });

                                    if (matchId) {
                                        try {
                                            const responseId = await saveResponse(
                                                ai.ai_id,
                                                matchId,
                                                responseText,
                                                responseTime
                                            );
                                            await savePromptMetric({
                                                matchId,
                                                aiId: ai.ai_id,
                                                teamId: team.team_id,
                                                serviceId: service.service_id,
                                                serviceType: service.type,
                                                serviceName: service.name || service.type,
                                                modelName: service.model,
                                                promptType: 'request_units',
                                                durationSeconds: responseTime
                                            });
                                        } catch (saveError) {
                                            console.error('Error saving AI response:', saveError);
                                        }
                                    }

                                    const availableUnits = await getAIAvailableUnits();
                                    const aiAvailableUnits = availableUnits
                                        .filter(unit => unit.team_ai_id === ai.ai_id)
                                        .map(unit => unit.unit_id);

                                    const aiData = {
                                        id: ai.ai_id,
                                        availableUnits: aiAvailableUnits
                                    };

                                    const result = await processAIResponse(responseText, aiData, matchId);
                                    const rawIssues = mapIssuesToPayload(result.errors, team, ai, serviceName, matchId);
                                    const totals = await getCurrentIssueTotals(matchId, ai.ai_id);
                                    const validationIssues = clampIssues(rawIssues, totals, ISSUE_LIMIT);

                                    if (matchId && validationIssues.length > 0) {
                                        const errorIncrement = validationIssues.reduce((sum, issue) => sum + (issue.errorIncrement || (issue.isError ? 1 : 0)), 0);
                                        const warningIncrement = validationIssues.reduce((sum, issue) => sum + (issue.warningIncrement || (issue.isError ? 0 : 1)), 0);
                                        await updateResponseIssues(matchId, ai.ai_id, errorIncrement, warningIncrement);
                                        validationIssues.forEach(issue => { issue.alreadyPersisted = true; });
                                    }

                                    if (validationIssues.length > 0 && result.success) {
                                        socket.emit('requestStatus', {
                                            status: 'warning',
                                            teamId: team.team_id,
                                            aiId: ai.ai_id,
                                            teamName: team.name,
                                            matchId,
                                            message: `Some files were skipped for ${team.name} due to format errors.`,
                                            validationIssues,
                                            durationSeconds: responseTime,
                                            expectedUnits: unitsNumber,
                                            receivedUnits: result.unitIds ? result.unitIds.length : 0
                                        });
                                    }

                                    if (result.success) {
                                        await incrementParticipantUnits(matchId, ai.ai_id, result.unitIds ? result.unitIds.length : 0);
                                        socket.emit('requestStatus', {
                                            status: 'success',
                                            teamId: team.team_id,
                                            aiId: ai.ai_id,
                                            teamName: team.name,
                                            matchId,
                                            unitIds: result.unitIds,
                                            savedFiles: result.savedFiles,
                                            message: `Units received for ${team.name} using ${serviceName} - Created units: ${result.unitIds.join(', ')}`,
                                            durationSeconds: responseTime,
                                            expectedUnits: unitsNumber,
                                            receivedUnits: result.unitIds.length
                                        });
                                    } else {
                                        socket.emit('requestStatus', {
                                            status: 'error',
                                            teamId: team.team_id,
                                            aiId: ai.ai_id,
                                            teamName: team.name,
                                            matchId,
                                            error: result.error,
                                            message: `Error processing units for ${team.name}: ${result.error}`,
                                            validationIssues,
                                            durationSeconds: responseTime,
                                            expectedUnits: unitsNumber,
                                            receivedUnits: result.unitIds ? result.unitIds.length : 0
                                        });
                                    }
                                } catch (error) {
                                    socket.emit('requestStatus', {
                                        status: 'error',
                                        teamId: team.team_id,
                                        aiId: ai.ai_id,
                                        teamName: team.name,
                                        error: error.message,
                                        message: `Error requesting units for ${team.name} using ${serviceName}: ${error.message}`
                                    });
                                }
                            })();

                            tasks.push(task);
                        }
                    }

                    await Promise.all(tasks);

                socket.emit('requestStatus', {
                    status: 'completed',
                    matchId,
                    message: 'Process completed'
                });
        } catch (error) {
                socket.emit('requestStatus', {
                    status: 'error',
                    matchId,
                    error: 'Error reading prompt file',
                    message: 'Error reading instruction file'
                });
                }

            } catch (error) {
                socket.emit('requestStatus', {
                    status: 'error',
                    matchId,
                    error: error.message,
                    message: 'Error processing request'
                });
            }
        });

        socket.on('requestUnitsForAI', async (data) => {
            try {
                const matchId = data?.matchId || null;
                const targetTeamId = data?.teamId;
                const targetAiId = data?.aiId;

                if (!targetTeamId || !targetAiId) {
                    socket.emit('requestStatus', {
                        status: 'error',
                        error: 'Missing teamId or aiId',
                        message: 'Error: Missing team or AI identification'
                    });
                    return;
                }

                socket.emit('requestStatus', {
                    status: 'started',
                    matchId,
                    message: 'Starting units request process for specific AI'
                });

                try {
                    const { prompt: promptText, unitsNumber } = await getRequestUnitsPromptText();

                    const teams = await getAvailableTeams();
                    const teamAIs = await getTeamAIs();
                    const aiServices = await getAIServices();

                    const team = teams.find(t => t.team_id === targetTeamId);
                    if (!team) {
                        socket.emit('requestStatus', {
                            status: 'error',
                            error: 'Team not found or not available',
                            message: 'Error: Specified team not found or not available'
                        });
                        return;
                    }

                    const ai = teamAIs.find(a => a.team_id === targetTeamId && a.ai_id === targetAiId);
                    if (!ai) {
                        socket.emit('requestStatus', {
                            status: 'error',
                            error: 'AI not found',
                            message: 'Error: Specified AI not found'
                        });
                        return;
                    }

                    const service = aiServices.find(s => s.service_id === ai.service_id && s.is_active === 1);
                    if (!service) {
                        socket.emit('requestStatus', {
                            status: 'error',
                            error: 'Service not found',
                            message: 'Error: AI service not found or inactive'
                        });
                        return;
                    }

                    if (matchId !== null && matchId !== undefined) {
                        await ensureMatchParticipant(matchId, ai.ai_id);
                    }

                    const serviceName = service.name || service.type;
                    const modelName = service.model || 'Unknown model';

                    socket.emit('requestStatus', {
                        status: 'processing',
                        teamId: team.team_id,
                        aiId: ai.ai_id,
                        teamName: team.name,
                        matchId,
                        message: `Sending request units prompt to ${team.name} using ${serviceName} (${modelName})`
                    });

                    try {
                        const startTime = Date.now();

                        socket.emit('requestStatus', {
                            status: 'processing',
                            teamId: team.team_id,
                            aiId: ai.ai_id,
                            teamName: team.name,
                            matchId,
                            message: `Waiting for response from ${team.name}...`
                        });

                        // Add unique identifier to prevent API caching across different AIs
                        const uniquePrompt = `${promptText}\n\n---\nAI Service: ${serviceName}\nModel: ${modelName}\nTeam: ${team.name}\nTimestamp: ${Date.now()}\nNote: Create UNIQUE units different from what other AI models might generate. Be creative and avoid common or obvious concepts.`;

                        const responseText = await callLLM(
                            service.type,
                            service.model,
                            service.api_key,
                            uniquePrompt,
                            service.is_reasoning === 1,
                            service.is_mirror === 1,
                            service.endpoint
                        );

                        const responseTime = (Date.now() - startTime) / 1000;

                        // No extra delay in single-AI path

                        socket.emit('requestStatus', {
                            status: 'processing',
                            teamId: team.team_id,
                            aiId: ai.ai_id,
                            teamName: team.name,
                            message: `Processing response from ${team.name}...`
                        });

                        if (matchId) {
                            try {
                                const responseId = await saveResponse(
                                    ai.ai_id,
                                    matchId,
                                    responseText,
                                    0,
                                    0,
                                    responseTime
                                );
                                await savePromptMetric({
                                    matchId,
                                    aiId: ai.ai_id,
                                    teamId: team.team_id,
                                    serviceId: service.service_id,
                                    serviceType: service.type,
                                    serviceName: service.name || service.type,
                                    modelName: service.model,
                                    promptType: 'request_units',
                                    durationSeconds: responseTime
                                });
                            } catch (saveError) {
                                console.error('Error saving AI response:', saveError);
                            }
                        }

                        const availableUnits = await getAIAvailableUnits();
                        const aiAvailableUnits = availableUnits
                            .filter(unit => unit.team_ai_id === ai.ai_id)
                            .map(unit => unit.unit_id);

                        const aiData = {
                            id: ai.ai_id,
                            availableUnits: aiAvailableUnits
                        };

                        const result = await processAIResponse(responseText, aiData, matchId);
                                    const rawIssues = mapIssuesToPayload(result.errors, team, ai, serviceName, matchId);
                                    const totals = await getCurrentIssueTotals(matchId, ai.ai_id);
                                    const validationIssues = clampIssues(rawIssues, totals, ISSUE_LIMIT);

                                    // Persist issues server-side to avoid UI desync
                                    if (matchId && validationIssues.length > 0) {
                                        const errorIncrement = validationIssues.reduce((sum, issue) => sum + (issue.errorIncrement || (issue.isError ? 1 : 0)), 0);
                                        const warningIncrement = validationIssues.reduce((sum, issue) => sum + (issue.warningIncrement || (issue.isError ? 0 : 1)), 0);
                                        await updateResponseIssues(matchId, ai.ai_id, errorIncrement, warningIncrement);
                                        validationIssues.forEach(issue => { issue.alreadyPersisted = true; });
                                    }

                        if (validationIssues.length > 0 && result.success) {
                            socket.emit('requestStatus', {
                                status: 'warning',
                                teamId: team.team_id,
                                aiId: ai.ai_id,
                                teamName: team.name,
                                matchId,
                                message: `Some files were skipped for ${team.name} due to format errors.`,
                                validationIssues
                            });
                        }

                                    if (result.success) {
                                        await incrementParticipantUnits(matchId, ai.ai_id, result.unitIds ? result.unitIds.length : 0);
                                        socket.emit('requestStatus', {
                                            status: 'success',
                                            teamId: team.team_id,
                                            aiId: ai.ai_id,
                                            teamName: team.name,
                                            matchId,
                                            unitIds: result.unitIds,
                                            savedFiles: result.savedFiles,
                                            message: `Units received for ${team.name} using ${serviceName} - Created units: ${result.unitIds.join(', ')}`,
                                            durationSeconds: responseTime,
                                            expectedUnits: unitsNumber,
                                            receivedUnits: result.unitIds.length
                                        });
                                    } else {
                                        socket.emit('requestStatus', {
                                            status: 'error',
                                            teamId: team.team_id,
                                            aiId: ai.ai_id,
                                            teamName: team.name,
                                            matchId,
                                            error: result.error,
                                            message: `Error processing units for ${team.name}: ${result.error}`,
                                            validationIssues,
                                            durationSeconds: responseTime,
                                            expectedUnits: unitsNumber,
                                            receivedUnits: result.unitIds ? result.unitIds.length : 0
                                        });
                        }
            } catch (error) {
                socket.emit('requestStatus', {
                    status: 'error',
                    teamId: team.team_id,
                    aiId: ai.ai_id,
                    teamName: team.name,
                    matchId,
                    error: error.message,
                    message: `Error requesting units for ${team.name} using ${serviceName}: ${error.message}`
                });
            }

            socket.emit('requestStatus', {
                status: 'completed',
                matchId,
                message: 'Process completed for specific AI'
            });

                } catch (error) {
                    socket.emit('requestStatus', {
                        status: 'error',
                        error: 'Error reading prompt file',
                        matchId,
                        message: 'Error reading instruction file'
                    });
                }

            } catch (error) {
                socket.emit('requestStatus', {
                    status: 'error',
                    error: error.message,
                    matchId,
                    message: 'Error processing request for specific AI'
                });
            }
        });

        socket.on('validation_issue', async (data, ack) => {
            const respond = (payload) => {
                if (typeof ack === 'function') {
                    try {
                        ack(payload);
                    } catch (ackError) {
                        console.error('[ValidationLog-Server] Failed to acknowledge validation issue:', ackError);
                    }
                }
            };

            try {
                const { matchId: rawMatchId, filename, errorIncrement = 0, warningIncrement = 0, aiId: providedAiId } = data;

                const matchId = rawMatchId || null;
                let aiId = providedAiId || null;

                if (!matchId) {
                    console.error('[ValidationLog-Server] Missing matchId in validation_issue payload');
                    respond({
                        acceptedErrors: 0,
                        acceptedWarnings: 0,
                        error: 'matchId missing'
                    });
                    return;
                }

                const db = await getDatabase();

                if (!aiId && filename && matchId) {
                    const fileInfo = await db.getAsync('SELECT ai_id FROM files WHERE match_id = ? AND filename = ?', [matchId, filename]);
                    if (fileInfo && fileInfo.ai_id) {
                        aiId = fileInfo.ai_id;
                    }
                }

                if (!aiId) {
                    console.error('[ValidationLog-Server] Unable to determine AI for validation issue:', data);
                    respond({
                        acceptedErrors: 0,
                        acceptedWarnings: 0,
                        error: 'AI not resolved for match'
                    });
                    return;
                }

                const updateResult = await updateResponseIssues(matchId, aiId, errorIncrement, warningIncrement);

                if (!updateResult || updateResult.updatedMatchId !== matchId || updateResult.rowsChanged === 0) {
                    respond({
                        acceptedErrors: 0,
                        acceptedWarnings: 0,
                        error: updateResult?.reason || 'response not updated',
                        rowsChanged: updateResult?.rowsChanged || 0,
                        updatedMatchId: updateResult?.updatedMatchId ?? null
                    });
                    return;
                }

                respond({
                    acceptedErrors: updateResult.acceptedErrors || 0,
                    acceptedWarnings: updateResult.acceptedWarnings || 0,
                    totals: updateResult.totals || { errors: 0, warnings: 0 },
                    remainingIssueWeight: updateResult.remainingWeight ?? ISSUE_LIMIT,
                    reason: null,
                    rowsChanged: updateResult.rowsChanged || 0,
                    updatedMatchId: updateResult.updatedMatchId ?? null
                });

            } catch (error) {
                console.error('[ValidationLog-Server] Error processing validation issue:', error);
                respond({
                    acceptedErrors: 0,
                    acceptedWarnings: 0,
                    error: error.message || 'Unknown validation issue error',
                    reason: error.message || 'Unknown validation issue error',
                    rowsChanged: 0,
                    updatedMatchId: data?.matchId ?? null
                });
            }
        });

        socket.on('disconnect', () => {
        });
    });
}

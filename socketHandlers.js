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
    saveResponse,
    saveFile
} from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
                    max_tokens: 64000
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
                max_tokens: 8192
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
                    maxOutputTokens: isThinkingModel ? 64000 : 8192,
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
                    max_output_tokens: 64000
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
                    max_completion_tokens: 64000
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
                    max_completion_tokens: 64000
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

async function processAIResponse(textContent, ai, matchId) {
    if (!textContent) {
        return { success: false, error: 'No text content to process' };
    }

    try {
        const files = {};
        let currentFileName = '';
        let currentContent = [];
        const lines = textContent.split('\n');
        let foundFiles = false;
        const savedFiles = [];

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
            const firstLines = textContent.split('\n').slice(0, 10).join('\n');
            return {
                success: false,
                error: 'No file markers found in AI response. The model did not use the expected format.'
            };
        }

        const fileNames = Object.keys(files);

        if (fileNames.length === 0) {
            return {
                success: false,
                error: 'No files found in AI response. The AI response did not contain the expected format.'
            };
        }

        let unitIds = [];

        for (const [fileName, content] of Object.entries(files)) {
            const baseFileName = fileName.replace(/\.(js|json)$/, '');

            if (fileName.endsWith('.json')) {
                if (baseFileName.startsWith('seffect-')) {
                    await saveFileToFS('seffects', fileName, content);
                    savedFiles.push(fileName);
                    if (matchId) {
                        await saveFile(ai.id, matchId, fileName);
                    }
                } else {
                    try {
                        const unitData = JSON.parse(content);
                        unitIds.push(unitData.id);

                        await saveFileToFS('units', fileName, content);
                        savedFiles.push(fileName);
                        if (matchId) {
                            await saveFile(ai.id, matchId, fileName);
                        }
                    } catch (error) {
                        return {
                            success: false,
                            error: `Error parsing JSON for unit ${fileName}: ${error.message}`
                        };
                    }
                }
            } else if (baseFileName.startsWith('skill-')) {
                await saveFileToFS('skills', fileName, content);
                savedFiles.push(fileName);
                if (matchId) {
                    await saveFile(ai.id, matchId, fileName);
                }
            } else if (baseFileName.startsWith('fx-')) {
                await saveFileToFS('fx', fileName, content);
                savedFiles.push(fileName);
                if (matchId) {
                    await saveFile(ai.id, matchId, fileName);
                }
            }
        }

        if (unitIds.length === 0) {
            return {
                success: false,
                error: 'No valid units found in AI response'
            };
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
            savedFiles
        };
    } catch (error) {
        return {
            success: false,
            error: `Error processing AI response: ${error.message}`
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

export function setupSocketHandlers(io) {
    io.on('connection', (socket) => {
        socket.on('requestUnits', async (data) => {
            try {
                const matchId = data?.matchId || null;

                socket.emit('requestStatus', {
                    status: 'started',
                    message: 'Starting units request process'
                });

                try {
                    const promptPath = join(__dirname, 'public', 'promt-resquest-unit.txt');
                    const promptText = await fs.readFile(promptPath, 'utf8');

                    const teams = await getAvailableTeams();
                    const teamAIs = await getTeamAIs();
                    const aiServices = await getAIServices();

                    for (const team of teams) {
                        const ais = teamAIs.filter(ai => ai.team_id === team.team_id);

                        for (const ai of ais) {
                            const service = aiServices.find(s => s.service_id === ai.service_id && s.is_active === 1);

                            if (service) {
                                const serviceName = service.name || service.type;
                                const modelName = service.model || 'Unknown model';

                                socket.emit('requestStatus', {
                                    status: 'processing',
                                    teamId: team.team_id,
                                    aiId: ai.ai_id,
                                    teamName: team.name,
                                    message: `Sending request units prompt to ${team.name} using ${serviceName} (${modelName})`
                                });

                                try {
                                    const startTime = Date.now();

                                    socket.emit('requestStatus', {
                                        status: 'processing',
                                        teamId: team.team_id,
                                        aiId: ai.ai_id,
                                        teamName: team.name,
                                        message: `Waiting for response from ${team.name}...`
                                    });

                                    const responseText = await callLLM(
                                        service.type,
                                        service.model,
                                        service.api_key,
                                        promptText,
                                        service.is_reasoning === 1,
                                        service.is_mirror === 1,
                                        service.endpoint
                                    );

                                    const responseTime = (Date.now() - startTime) / 1000;

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

                                    if (result.success) {
                                        socket.emit('requestStatus', {
                                            status: 'success',
                                            teamId: team.team_id,
                                            aiId: ai.ai_id,
                                            teamName: team.name,
                                            unitIds: result.unitIds,
                                            savedFiles: result.savedFiles,
                                            message: `Units received for ${team.name} using ${serviceName} - Created units: ${result.unitIds.join(', ')}`
                                        });
                                    } else {
                                        socket.emit('requestStatus', {
                                            status: 'error',
                                            teamId: team.team_id,
                                            aiId: ai.ai_id,
                                            teamName: team.name,
                                            error: result.error,
                                            message: `Error processing units for ${team.name}: ${result.error}`
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
                            }
                        }
                    }

                    socket.emit('requestStatus', {
                        status: 'completed',
                        message: 'Process completed'
                    });
                } catch (error) {
                    socket.emit('requestStatus', {
                        status: 'error',
                        error: 'Error reading prompt file',
                        message: 'Error reading instruction file'
                    });
                }

            } catch (error) {
                socket.emit('requestStatus', {
                    status: 'error',
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
                    message: 'Starting units request process for specific AI'
                });

                try {
                    const promptPath = join(__dirname, 'public', 'promt-resquest-unit.txt');
                    const promptText = await fs.readFile(promptPath, 'utf8');

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

                    const serviceName = service.name || service.type;
                    const modelName = service.model || 'Unknown model';

                    socket.emit('requestStatus', {
                        status: 'processing',
                        teamId: team.team_id,
                        aiId: ai.ai_id,
                        teamName: team.name,
                        message: `Sending request units prompt to ${team.name} using ${serviceName} (${modelName})`
                    });

                    try {
                        const startTime = Date.now();

                        socket.emit('requestStatus', {
                            status: 'processing',
                            teamId: team.team_id,
                            aiId: ai.ai_id,
                            teamName: team.name,
                            message: `Waiting for response from ${team.name}...`
                        });

                        const responseText = await callLLM(
                            service.type,
                            service.model,
                            service.api_key,
                            promptText,
                            service.is_reasoning === 1,
                            service.is_mirror === 1,
                            service.endpoint
                        );

                        const responseTime = (Date.now() - startTime) / 1000;

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

                        if (result.success) {
                            socket.emit('requestStatus', {
                                status: 'success',
                                teamId: team.team_id,
                                aiId: ai.ai_id,
                                teamName: team.name,
                                unitIds: result.unitIds,
                                savedFiles: result.savedFiles,
                                message: `Units received for ${team.name} using ${serviceName} - Created units: ${result.unitIds.join(', ')}`
                            });
                        } else {
                            socket.emit('requestStatus', {
                                status: 'error',
                                teamId: team.team_id,
                                aiId: ai.ai_id,
                                teamName: team.name,
                                error: result.error,
                                message: `Error processing units for ${team.name}: ${result.error}`
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

                    socket.emit('requestStatus', {
                        status: 'completed',
                        message: 'Process completed for specific AI'
                    });

                } catch (error) {
                    socket.emit('requestStatus', {
                        status: 'error',
                        error: 'Error reading prompt file',
                        message: 'Error reading instruction file'
                    });
                }

            } catch (error) {
                socket.emit('requestStatus', {
                    status: 'error',
                    error: error.message,
                    message: 'Error processing request for specific AI'
                });
            }
        });

        socket.on('validation_issue', async (data) => {
            try {
                const { matchId, filename, message, errorIncrement, warningIncrement } = data;

                if (!matchId || !filename) {
                    console.error('[ValidationLog-Server] Invalid validation issue data:', data);
                    return;
                }

                const db = await getDatabase();

                const fileInfo = await db.getAsync(
                    'SELECT ai_id FROM files WHERE match_id = ? AND filename = ?',
                    [matchId, filename]
                );

                if (!fileInfo || !fileInfo.ai_id) {
                    console.error(`[ValidationLog-Server] No AI found for file ${filename} in match ${matchId}`);

                    const allFilesForMatch = await db.allAsync('SELECT * FROM files WHERE match_id = ?', [matchId]);
                    return;
                }

                const responseInfo = await db.getAsync(
                    'SELECT response_id, has_errors, has_warnings FROM responses WHERE match_id = ? AND ai_id = ? ORDER BY created_at DESC LIMIT 1',
                    [matchId, fileInfo.ai_id]
                );

                if (!responseInfo) {
                    console.error(`[ValidationLog-Server] No response found for AI ${fileInfo.ai_id} in match ${matchId}`);
                    return;
                }

                const newErrors = responseInfo.has_errors + errorIncrement;
                const newWarnings = responseInfo.has_warnings + warningIncrement;

                await db.runAsync(
                    'UPDATE responses SET has_errors = ?, has_warnings = ? WHERE response_id = ?',
                    [newErrors, newWarnings, responseInfo.response_id]
                );

            } catch (error) {
                console.error('[ValidationLog-Server] Error processing validation issue:', error);
            }
        });

        socket.on('disconnect', () => {
        });
    });
}
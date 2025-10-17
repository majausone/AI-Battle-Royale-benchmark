import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { saveResponse, saveFile } from './database.js';

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

async function processResponseFiles(responseText, aiId, matchId) {
    if (!responseText || !aiId || !matchId) {
        return { success: false, files: [] };
    }

    try {
        const files = {};
        let currentFileName = '';
        let currentContent = [];
        const lines = responseText.split('\n');
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
            return { success: false, files: [] };
        }

        const fileNames = Object.keys(files);

        if (fileNames.length === 0) {
            return { success: false, files: [] };
        }

        for (const fileName of fileNames) {
            const content = files[fileName];

            if (fileName.endsWith('.json') || fileName.endsWith('.js')) {
                const filePath = getDirectoryForFile(fileName);
                if (filePath) {
                    await saveFileToFS(filePath, fileName, content);
                    await saveFile(aiId, matchId, fileName);
                    savedFiles.push(fileName);
                }
            }
        }

        return { success: true, files: savedFiles };
    } catch (error) {
        console.error('Error processing response files:', error);
        return { success: false, files: [], error: error.message };
    }
}

function getDirectoryForFile(fileName) {
    const baseFileName = fileName.replace(/\.(js|json)$/, '');

    if (fileName.endsWith('.json')) {
        if (baseFileName.startsWith('seffect-')) {
            return 'seffects';
        } else {
            return 'units';
        }
    } else if (baseFileName.startsWith('skill-')) {
        return 'skills';
    } else if (baseFileName.startsWith('fx-')) {
        return 'fx';
    }

    return null;
}

async function saveFileToFS(directory, fileName, content) {
    try {
        const filePath = join(__dirname, 'public', directory, fileName);
        const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 4);
        await fs.writeFile(filePath, fileContent);
        return true;
    } catch (error) {
        console.error(`Error saving file ${fileName} to ${directory}:`, error);
        throw error;
    }
}

export function setupRouteAIPrompt(app) {
    app.post('/api/ai/prompt', handleAsyncRoute(async (req) => {
        const { service, prompt, aiId, matchId } = req.body;

        if (!service || !service.endpoint || !service.apiKey || !service.model || !prompt) {
            throw new Error('Missing required fields: service (endpoint, apiKey, model) or prompt');
        }

        const startTime = Date.now();

        const responseText = await callLLM(
            service.type,
            service.model,
            service.apiKey,
            prompt,
            service.reasoning,
            service.mirror,
            service.endpoint
        );

        if (aiId && matchId) {
            const responseTime = (Date.now() - startTime) / 1000;
            await saveResponse(
                aiId,
                matchId,
                responseText,
                0,
                0,
                responseTime
            );

            await processResponseFiles(responseText, aiId, matchId);
        }

        return { content: responseText };
    }));
}
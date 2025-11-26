import fetch from 'node-fetch';

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

async function makeAIRequest(service, prompt, isTest = false) {
    if (isTest) {
        if (service.type === 'claude') {
            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'x-api-key': service.apiKey
                },
                body: JSON.stringify({
                    model: service.model,
                    messages: [{
                        role: "user",
                        content: "Test connection"
                    }],
                    max_tokens: 100
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${await response.text()}`);
            }

            return { success: true };
        }
        else if (service.type === 'deepseek') {
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${service.apiKey}`
            };

            const requestBody = {
                model: service.model,
                messages: [{
                    role: "user",
                    content: "Test connection"
                }],
                max_tokens: 100
            };

            const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`API error: ${await response.text()}`);
            }

            return { success: true };
        }
        else if (service.type === 'gemini') {
            const isThinkingModel = service.model.includes('2.5');
            
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${service.model}:generateContent?key=${service.apiKey}`;
            
            const requestBody = {
                contents: [{
                    parts: [{
                        text: "Test connection"
                    }]
                }],
                generationConfig: {
                    maxOutputTokens: 100,
                    temperature: 0.1
                }
            };
            
            if (isThinkingModel) {
                const minBudget = service.model.includes('pro') ? 128 : 0;
                requestBody.generationConfig.thinkingConfig = {
                    thinkingBudget: minBudget
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
                throw new Error(`API error: ${await response.text()}`);
            }

            return { success: true };
        }
        else if (service.type === 'chatgpt' && service.reasoning) {
            const isO3Model = service.model.startsWith('o3-');

            if (isO3Model) {
                const requestBody = {
                    model: service.model,
                    input: [{
                        role: "user",
                        content: "Test connection"
                    }],
                    max_output_tokens: 100
                };

                const response = await fetch("https://api.openai.com/v1/responses", {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${service.apiKey}`
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    throw new Error(`API error: ${await response.text()}`);
                }
            } else {
                const requestBody = {
                    model: service.model,
                    messages: [{
                        role: "user",
                        content: "Test connection"
                    }],
                    max_completion_tokens: 1000
                };

                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${service.apiKey}`
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    throw new Error(`API error: ${await response.text()}`);
                }
            }

            return { success: true };
        }
        else if (service.type === 'grok') {
            const response = await fetch("https://api.x.ai/v1/chat/completions", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${service.apiKey}`
                },
                body: JSON.stringify({
                    model: service.model,
                    messages: [{
                        role: "user",
                        content: "Test connection"
                    }],
                    max_tokens: 100
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${await response.text()}`);
            }

            return { success: true };
        }
        else if (service.type === 'moonshot') {
            const endpoint = service.endpoint || 'https://api.moonshot.ai/v1/chat/completions';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${service.apiKey}`
                },
                body: JSON.stringify({
                    model: service.model,
                    messages: [{
                        role: "user",
                        content: "Test connection"
                    }],
                    temperature: 0.1,
                    max_tokens: 256
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${await response.text()}`);
            }

            return { success: true };
        }
        else {
            const endpoint = (service.type === 'custom' || service.type === 'chatgpt') && service.endpoint ? service.endpoint : "https://api.openai.com/v1/chat/completions";
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${service.apiKey}`
                },
                body: JSON.stringify({
                    model: service.model,
                    messages: [{
                        role: "user",
                        content: "Test connection"
                    }],
                    max_completion_tokens: 1000
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${await response.text()}`);
            }

            return { success: true };
        }
    }

    const responseText = await callLLM(
        service.type,
        service.model,
        service.apiKey,
        prompt,
        service.reasoning,
        service.mirror
    );

    return { content: responseText };
}

export function setupRouteAITest(app) {
    app.post('/api/ai/test', handleAsyncRoute(async (req) => {
        const service = req.body;

        if (!service || !service.endpoint || !service.apiKey || !service.model) {
            throw new Error('Missing required fields: endpoint, apiKey, model');
        }

        await makeAIRequest(service, null, true);
        return { success: true };
    }));
}

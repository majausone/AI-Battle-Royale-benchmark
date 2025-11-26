import { loadedUnits } from './unitLoader.js';
import { testMode } from './round-tab.js';
import { sendPrompt } from './aiSender.js';
import { matchProcessPopup } from './matchProcessPopup.js';

export let simplePriceMode = false;

async function updateUnitPrice(unitId, newPrice) {
    try {
        const unit = loadedUnits.get(unitId);
        if (!unit) return false;

        unit.cost = newPrice;
        const response = await fetch(`/api/units/${unitId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(unit)
        });

        return response.ok;
    } catch (error) {
        console.error('Error updating unit prices:', error);
        return false;
    }
}

export function setSimplePriceMode(mode) {
    simplePriceMode = mode;
}

export async function adaptUnitPrices() {
    matchProcessPopup.show();
    
    if (testMode) {
        if (simplePriceMode) {
            await adaptUnitPricesSimple();
        } else {
            await adaptUnitPricesWithProgress();
        }
    } else {
        await adaptUnitPricesWithLLM();
    }
}

async function getUnitData(unitId) {
    try {
        const unit = loadedUnits.get(unitId);
        if (unit) return unit;
        
        const response = await fetch(`/api/units/${unitId}`);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error(`Error fetching data for unit ${unitId}:`, error);
        return null;
    }
}

async function getSkillData(skillId) {
    try {
        const response = await fetch(`/api/skills/${skillId}`);
        if (!response.ok) return null;
        return await response.text();
    } catch (error) {
        console.error(`Error fetching data for skill ${skillId}:`, error);
        return null;
    }
}

async function getSeffectData(seffectId) {
    try {
        const response = await fetch(`/api/seffects/${seffectId}`);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error(`Error fetching data for seffect ${seffectId}:`, error);
        return null;
    }
}

async function collectUnitInfo(unitId) {
    const unit = await getUnitData(unitId);
    if (!unit) return null;
    
    const unitInfo = {
        unit,
        skills: [],
        seffects: []
    };
    
    if (unit.skills && Array.isArray(unit.skills)) {
        for (const skillId of unit.skills) {
            const skillCode = await getSkillData(skillId);
            if (skillCode) {
                unitInfo.skills.push({
                    id: skillId,
                    code: skillCode
                });
                
                const seffectsRegex = /seffects:\s*["']([^"']+)["']/;
                const match = skillCode.match(seffectsRegex);
                
                if (match && match[1]) {
                    const seffectId = match[1];
                    const seffect = await getSeffectData(seffectId);
                    
                    if (seffect) {
                        unitInfo.seffects.push({
                            id: seffectId,
                            data: seffect
                        });
                        
                        if (seffect.targetEffectId) {
                            const targetSeffect = await getSeffectData(seffect.targetEffectId);
                            if (targetSeffect) {
                                unitInfo.seffects.push({
                                    id: seffect.targetEffectId,
                                    data: targetSeffect
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    
    return unitInfo;
}

async function adaptUnitPricesWithLLM() {
    function sendLog(message, level = 'info') {
        window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
            detail: {
                type: 'log',
                process: 'adaptPrices',
                message: message,
                level: level
            }
        }));
    }
    
    function sendProgress(message) {
        window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
            detail: {
                type: 'progress',
                process: 'adaptPrices',
                statusMessage: message
            }
        }));
    }
    
    try {
        sendLog('Starting price adaptation process...');
        sendProgress('Getting configuration...');
        
        const configResponse = await fetch('/api/config2');
        const config = await configResponse.json();
        
        if (!config || !config.aiServices || !config.teams) {
            sendLog('Error: Could not get system configuration.', 'error');
            return;
        }
        
        sendLog('Configuration obtained.');
        
        const availableTeams = config.teams.filter(team => team.isAvailable);
        const servicesInMatch = new Map();
        const matchId = window.currentMatchId || null;
        
        availableTeams.forEach(team => {
            team.ais.forEach(ai => {
                if (ai.service_id && !servicesInMatch.has(ai.service_id)) {
                    servicesInMatch.set(ai.service_id, []);
                }
                if (ai.service_id) {
                    servicesInMatch.get(ai.service_id).push({
                        aiId: ai.id,
                        teamId: team.id,
                        teamName: team.name
                    });
                }
            });
        });
        
        const activeServices = config.aiServices.filter(service => 
            service.isActive && service.apiKey && servicesInMatch.has(service.service_id)
        );
        
        if (activeServices.length === 0) {
            sendLog('Error: No active AI services configured for teams in match.', 'error');
            return;
        }
        
        sendLog(`Found ${activeServices.length} active AI services for teams in match.`);
        
        const unitInfoPromises = [];
        const unitIds = new Set();
        
        sendProgress('Collecting information about available units...');
        
        sendLog(`Processing ${availableTeams.length} available teams.`);
        
        availableTeams.forEach(team => {
            team.ais.forEach(ai => {
                ai.availableUnits.forEach(unitId => {
                    if (!unitIds.has(unitId)) {
                        unitIds.add(unitId);
                        unitInfoPromises.push(collectUnitInfo(unitId));
                    }
                });
            });
        });
        
        sendLog(`Processing ${unitInfoPromises.length} unique units...`);
        
        const unitsInfo = await Promise.all(unitInfoPromises);
        const validUnitsInfo = unitsInfo.filter(info => info !== null);
        
        sendLog(`Information collected for ${validUnitsInfo.length} units.`);
        
        const promptData = validUnitsInfo.map(info => {
            const unit = info.unit;
            const skills = info.skills;
            const seffects = info.seffects;
            
            let unitDetails = `
## Unit: ${unit.name} (ID: ${unit.id})
Description: ${unit.description || 'Not available'}
Stats:
- Life: ${unit.life}
- Damage: ${unit.damage}
- Speed: ${unit.speed}
- Scale: ${unit.scale}
- Attack Type: ${unit.attackType}`;

            if (unit.attackType === 'melee') {
                unitDetails += `
- Attack Range: ${unit.attackRange || 50}
- Attack Speed: ${unit.attackSpeed || 1000}`;
            } else if (unit.attackType === 'ranged') {
                unitDetails += `
- Optimal Range: ${unit.optimalRange || 300}
- Projectile Speed: ${unit.projectileSpeed || 6}
- Attack Interval: Min ${unit.attackInterval?.min || 3000}ms, Max ${unit.attackInterval?.max || 4000}ms`;
            }

            unitDetails += `

Skills:
${skills.length > 0 ? skills.map(skill => `- ${skill.id}`).join('\n') : 'None'}

${skills.length > 0 ? `Skill details:
${skills.map(skill => `

### Skill: ${skill.id}
${skill.code}
`).join('\n')}` : ''}

${seffects.length > 0 ? `Special effects:
${seffects.map(seffect => `

### Special Effect: ${seffect.id}
${JSON.stringify(seffect.data, null, 2)}
`).join('\n')}` : ''}`;

            return unitDetails;
        }).join('\n\n');
        
        try {
            sendProgress('Loading prompt template...');
            const promptTemplateResponse = await fetch('prompt-adapt-prices.txt');
            let promptTemplate = await promptTemplateResponse.text();
            
            const fullPrompt = `${promptTemplate}\n\n${promptData}`;
            
            sendLog('Full prompt built:');
            sendLog('------ START OF PROMPT ------');
            sendLog(fullPrompt);
            sendLog('------ END OF PROMPT ------');
            
            const unitPrices = {};
            const unitPricesByAI = {};
            
            const tasks = activeServices.map(service => {
                return (async () => {
                    const usageList = servicesInMatch.get(service.service_id) || [];
                    const usageInfo = usageList[0] || null;
                    const serviceLabel = service.name || service.type;
                    sendProgress(`Sending prompt to ${serviceLabel}...`);
                    usageList.forEach(info => {
                        window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                            detail: {
                                type: 'progress',
                                process: 'adaptPrices',
                                aiId: info.aiId || service.service_id,
                                teamId: info.teamId,
                                teamName: info.teamName || serviceLabel,
                                status: 'processing',
                                durationSeconds: null,
                                expectedUnits: validUnitsInfo.length,
                                receivedUnits: 0
                            }
                        }));
                    });
                    const startTime = Date.now();
                    try {
                        const llmResponse = await sendPrompt(service, fullPrompt, {
                            aiId: usageInfo?.aiId || null,
                            matchId,
                            teamId: usageInfo?.teamId || null,
                            promptType: 'adapt_prices'
                        });
                        
                        const responseTime = (Date.now() - startTime) / 1000;
                        
                        sendLog(`Response received from ${serviceLabel}:`);
                        sendLog('------ START OF RESPONSE ------');
                        sendLog(llmResponse.content);
                        sendLog('------ END OF RESPONSE ------');
                        
                        sendProgress(`Processing response from ${serviceLabel}...`);
                        
                        let contentText = llmResponse.content;
                        let jsonStart = contentText.indexOf('{');
                        let jsonEnd = contentText.lastIndexOf('}') + 1;
                        
                        if (jsonStart === -1 || jsonEnd === 0) {
                            throw new Error('No JSON found in response');
                        }
                        
                        const jsonContent = contentText.substring(jsonStart, jsonEnd);
                        const pricesData = JSON.parse(jsonContent);
                        
                        if (!pricesData.prices) {
                            throw new Error('Incorrect JSON format, "prices" object not found');
                        }
                        
                        sendLog(`Analyzing price response from ${serviceLabel}...`);
                        
                        const priceEntries = Object.entries(pricesData.prices);
                        sendLog(`Found ${priceEntries.length} prices to update:`);
                        
                        for (const [unitId, price] of priceEntries) {
                            sendLog(`- Unit ${unitId}: ${price} gold`);
                            
                            if (!unitPricesByAI[unitId]) {
                                unitPricesByAI[unitId] = [];
                            }
                            
                            unitPricesByAI[unitId].push(price);
                        }

                        // Emit per each AI associated with this service to keep UI consistent
                        usageList.forEach(info => {
                        window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                            detail: {
                                type: 'progress',
                                process: 'adaptPrices',
                                aiId: info.aiId || service.service_id,
                                teamId: info.teamId,
                                teamName: info.teamName || serviceLabel,
                                status: 'success',
                                durationSeconds: responseTime,
                                expectedUnits: priceEntries.length,
                                receivedUnits: priceEntries.length
                            }
                        }));
                        });
                    } catch (jsonError) {
                        usageList.forEach(info => {
                            window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                                detail: {
                                    type: 'progress',
                                    process: 'adaptPrices',
                                    aiId: info.aiId || service.service_id,
                                    teamId: info.teamId,
                                    teamName: info.teamName || serviceLabel,
                                    status: 'error',
                                    durationSeconds: null,
                                    expectedUnits: validUnitsInfo.length,
                                    receivedUnits: 0
                                }
                            }));
                        });
                        sendLog(`Error processing JSON response from ${serviceLabel}: ${jsonError.message}`, 'error');
                        sendLog('Continuing with next AI service...', 'warning');
                    }
                })();
            });

            await Promise.all(tasks);
            
            sendProgress('Calculating average prices...');
            
            for (const [unitId, prices] of Object.entries(unitPricesByAI)) {
                if (prices.length > 0) {
                    const sum = prices.reduce((acc, price) => acc + price, 0);
                    const average = Math.round(sum / prices.length);
                    unitPrices[unitId] = average;
                    
                    sendLog(`Average price for ${unitId}: ${average} gold (from ${prices.length} AIs)`);
                }
            }
            
            sendProgress('Updating unit prices...');
            
            for (const [unitId, price] of Object.entries(unitPrices)) {
                const updateResult = await updateUnitPrice(unitId, price);
                if (updateResult) {
                    sendLog(`✓ Price updated for ${unitId}: ${price} gold`);
                } else {
                    sendLog(`✗ Error updating price for ${unitId}`, 'error');
                }
            }
            
            sendLog('Price update process completed.');
            
        } catch (promptError) {
            sendLog(`Error building or sending prompt: ${promptError.message}`, 'error');
        }
        
    } catch (error) {
        sendLog(`General error: ${error.message}`, 'error');
    }
}

async function adaptUnitPricesSimple() {
    try {
        const response = await fetch('/api/config2');
        const config = await response.json();
        if (!config) return;

        const updatePromises = [];
        const availableTeams = config.teams.filter(team => team.isAvailable);

        availableTeams.forEach(team => {
            team.ais.forEach(ai => {
                ai.availableUnits.forEach(unitId => {
                    const newPrice = Math.floor(Math.random() * 101) + 100;
                    const promise = updateUnitPrice(unitId, newPrice);
                    updatePromises.push(promise);
                });
            });
        });

        await Promise.all(updatePromises);
    } catch (error) {
        console.error('Error adapting unit prices:', error);
    }
}

async function adaptUnitPricesWithProgress() {
    window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
        detail: { 
            type: 'progress', 
            process: 'adaptPrices',
            statusMessage: 'Adapting unit prices...'
        }
    }));

    try {
        const response = await fetch('/api/config2');
        const config = await response.json();
        if (!config) return;

        let unitCount = 0;
        let processedCount = 0;

        const availableTeams = config.teams.filter(team => team.isAvailable);

        availableTeams.forEach(team => {
            team.ais.forEach(ai => {
                unitCount += ai.availableUnits.length;
            });
        });

        const updatePromises = [];

        availableTeams.forEach(team => {
            team.ais.forEach(ai => {
                ai.availableUnits.forEach(unitId => {
                    const newPrice = Math.floor(Math.random() * 101) + 100;
                    const promise = updateUnitPrice(unitId, newPrice).then(() => {
                        processedCount++;

                        window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                            detail: {
                                type: 'progress',
                                process: 'adaptPrices',
                                statusMessage: `Adapting prices: ${processedCount}/${unitCount} units processed...`
                            }
                        }));
                    });

                    updatePromises.push(promise);
                });
            });
        });

        await Promise.all(updatePromises);
        window.dispatchEvent(new CustomEvent('unitsUpdated'));
    } catch (error) {
        console.error('Error adapting unit prices:', error);
    }
}

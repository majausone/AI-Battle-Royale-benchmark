import { loadedUnits } from './unitLoader.js';
import { sendPrompt } from './aiSender.js';
import { matchProcessPopup } from './matchProcessPopup.js';
import { reportValidationIssue } from './socketManager.js';

export let simpleBuyMode = false;

function canAffordUnit(goldAvailable, unitCost) {
    return goldAvailable >= unitCost;
}

function getAffordableUnits(availableUnits, goldAvailable) {
    return availableUnits.filter(unitId => {
        const unit = loadedUnits.get(unitId);
        return unit && canAffordUnit(goldAvailable, unit.cost);
    });
}

export function setSimpleBuyMode(mode) {
    simpleBuyMode = mode;
}

export async function buyUnitsSimple() {
    try {
        const response = await fetch('/api/config2');
        const config = await response.json();
        if (!config) return;

        const updatedTeams = [...config.teams];
        const availableTeams = updatedTeams.filter(team => team.isAvailable);

        availableTeams.forEach(team => {
            team.ais.forEach(ai => {
                let goldAvailable = config.gameSettings.initialGold;
                const purchasedUnits = [];

                while (goldAvailable > 0) {
                    const affordableUnits = getAffordableUnits(ai.availableUnits, goldAvailable);
                    if (affordableUnits.length === 0) break;

                    const randomIndex = Math.floor(Math.random() * affordableUnits.length);
                    const unitId = affordableUnits[randomIndex];
                    const unit = loadedUnits.get(unitId);

                    if (unit) {
                        goldAvailable -= unit.cost;

                        const existingUnit = purchasedUnits.find(pu => pu.id === unitId);
                        if (existingUnit) {
                            existingUnit.quantity++;
                        } else {
                            purchasedUnits.push({
                                id: unitId,
                                quantity: 1
                            });
                        }
                    }
                }

                ai.purchasedUnits = purchasedUnits;
            });
        });

        await fetch('/api/config2/teams', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedTeams)
        });
        
        window.dispatchEvent(new CustomEvent('unitsUpdated'));
        
        return updatedTeams;
    } catch (error) {
        console.error('Error buying units for teams:', error);
        return null;
    }
}

export async function buyUnitsWithProgress() {
    window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
        detail: { 
            type: 'progress', 
            process: 'buyUnits',
            statusMessage: 'Buying units for teams...'
        }
    }));

    try {
        const response = await fetch('/api/config2');
        const config = await response.json();
        if (!config) return;

        const updatedTeams = [...config.teams];
        const availableTeams = updatedTeams.filter(team => team.isAvailable);
        
        let teamCount = availableTeams.length;
        let processedTeams = 0;

        availableTeams.forEach(team => {
            team.ais.forEach(ai => {
                let goldAvailable = config.gameSettings.initialGold;
                const purchasedUnits = [];

                while (goldAvailable > 0) {
                    const affordableUnits = getAffordableUnits(ai.availableUnits, goldAvailable);
                    if (affordableUnits.length === 0) break;

                    const randomIndex = Math.floor(Math.random() * affordableUnits.length);
                    const unitId = affordableUnits[randomIndex];
                    const unit = loadedUnits.get(unitId);

                    if (unit) {
                        goldAvailable -= unit.cost;

                        const existingUnit = purchasedUnits.find(pu => pu.id === unitId);
                        if (existingUnit) {
                            existingUnit.quantity++;
                        } else {
                            purchasedUnits.push({
                                id: unitId,
                                quantity: 1
                            });
                        }
                    }
                }

                ai.purchasedUnits = purchasedUnits;
            });

            processedTeams++;
            window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                detail: {
                    type: 'progress',
                    process: 'buyUnits',
                    statusMessage: `Buying units for teams (${processedTeams}/${teamCount})`
                }
            }));
        });

        await fetch('/api/config2/teams', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedTeams)
        });

        window.dispatchEvent(new CustomEvent('gameSettingsUpdated', { detail: config }));
        
        return updatedTeams;
    } catch (error) {
        console.error('Error buying units for teams:', error);
        return null;
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

async function processLLMBuying() {
    function sendLog(message, level = 'info') {
        window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
            detail: {
                type: 'log',
                process: 'buyUnits',
                message: message,
                level: level
            }
        }));
    }
    
    function sendProgress(message) {
        window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
            detail: {
                type: 'progress',
                process: 'buyUnits',
                statusMessage: message
            }
        }));
    }
    
    try {
        sendLog('Starting unit purchasing process...');
        sendProgress('Getting configuration...');

        const matchId = window.currentMatchId || null;
        
        const configResponse = await fetch('/api/config2');
        const config = await configResponse.json();
        
        if (!config || !config.aiServices || !config.teams) {
            sendLog('Error: Could not get system configuration.', 'error');
            return;
        }
        
        const flagCriticalBuyError = (ai, team, serviceName, reason) => {
            if (!matchId || !ai?.id || !team?.id) {
                return;
            }

            reportValidationIssue(
                `buy-units-${team.id}-${ai.id}.json`,
                reason,
                true,
                {
                    aiId: ai.id,
                    teamId: team.id,
                    aiName: serviceName,
                    teamName: team.name
                }
            ).catch(error => {
                console.error('Error reporting buy units failure:', error);
            });
        };
        
        sendLog('Configuration obtained.');
        
        const availableTeams = config.teams.filter(team => team.isAvailable);
        const servicesInMatch = new Map();
        
        availableTeams.forEach(team => {
            team.ais.forEach(ai => {
                if (ai.service_id) {
                    servicesInMatch.set(ai.service_id, true);
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
        
        const initialGold = config.gameSettings.initialGold;
        sendLog(`Initial gold for each team: ${initialGold}`);
        
        sendLog('Loading prompt template...');
        const promptTemplateResponse = await fetch('prompt-buy-units.txt');
        const promptTemplate = await promptTemplateResponse.text();
        
        sendProgress('Starting purchasing process for each team...');
        
        const updatedTeams = [...config.teams];
        
        sendLog(`Processing ${availableTeams.length} available teams.`);
        
        const tasks = [];
        
        availableTeams.forEach(team => {
            sendLog(`\nProcessing team: ${team.name}`);
            team.ais.forEach(ai => {
                tasks.push((async () => {
                    const serviceId = ai.service_id;
                    const service = activeServices.find(s => s.service_id === serviceId);
                    
                    if (!service) {
                        sendLog(`Skipping AI ${ai.id} - Service not active or not in match`, 'warning');
                        window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                            detail: {
                                type: 'progress',
                                process: 'buyUnits',
                                aiId: ai.id,
                                teamId: team.id,
                                teamName: team.name,
                                status: 'error',
                                durationSeconds: null,
                                expectedUnits: ai.availableUnits?.length || 0,
                                receivedUnits: 0
                            }
                        }));
                        return;
                    }
                    
                    const serviceName = service.name || service.type;
                    sendLog(`\nProcessing AI using ${serviceName}`);
                    
                    if (!ai.availableUnits || ai.availableUnits.length === 0) {
                        sendLog(`No available units for this AI, skipping.`, 'warning');
                        window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                            detail: {
                                type: 'progress',
                                process: 'buyUnits',
                                aiId: ai.id,
                                teamId: team.id,
                                teamName: team.name,
                                status: 'error',
                                durationSeconds: null,
                                expectedUnits: 0,
                                receivedUnits: 0
                            }
                        }));
                        return;
                    }
                    
                    sendProgress(`Collecting data for ${team.name}...`);
                    
                    const unitInfoPromises = ai.availableUnits.map(unitId => collectUnitInfo(unitId));
                    const unitsInfo = await Promise.all(unitInfoPromises);
                    const validUnitsInfo = unitsInfo.filter(info => info !== null);
                    
                    sendLog(`Data collected for ${validUnitsInfo.length} units.`);
                    
                    if (validUnitsInfo.length === 0) {
                        sendLog(`No valid units available, skipping.`, 'warning');
                        window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                            detail: {
                                type: 'progress',
                                process: 'buyUnits',
                                aiId: ai.id,
                                teamId: team.id,
                                teamName: team.name,
                                status: 'error',
                                durationSeconds: null,
                                expectedUnits: 0,
                                receivedUnits: 0
                            }
                        }));
                        return;
                    }
                    
                    const promptData = validUnitsInfo.map(info => {
                    const unit = info.unit;
                    const skills = info.skills;
                    const seffects = info.seffects;
                    
                    let unitDetails = `
## Unit: ${unit.name} (ID: ${unit.id})
Description: ${unit.description || 'Not available'}
Cost: ${unit.cost}
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
                
                    const fullPrompt = `${promptTemplate}\n\nInitial Gold: ${initialGold}\n\n${promptData}`;
                    
                    sendLog('Full prompt built:');
                    sendLog('------ START OF PROMPT ------');
                    sendLog(fullPrompt);
                    sendLog('------ END OF PROMPT ------');
                    
                    window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                        detail: {
                            type: 'progress',
                            process: 'buyUnits',
                            aiId: ai.id,
                            teamId: team.id,
                            teamName: team.name,
                            status: 'processing',
                            durationSeconds: null,
                            budget: initialGold,
                            spend: 0
                        }
                    }));
                    
                    try {
                        sendProgress(`Sending buy units prompt to ${team.name}...`);
                        const startTime = Date.now();
                        const llmResponse = await sendPrompt(service, fullPrompt, {
                            aiId: ai.id,
                            matchId,
                            teamId: team.id,
                            promptType: 'buy_units'
                        });
                        
                        const responseTime = (Date.now() - startTime) / 1000;
                        
                        sendLog(`Response received from ${serviceName}:`);
                        sendLog('------ START OF RESPONSE ------');
                        sendLog(llmResponse.content);
                        sendLog('------ END OF RESPONSE ------');
                        
                        sendProgress(`Processing response from ${team.name}...`);
                        
                        try {
                            let contentText = llmResponse.content;
                            
                            let jsonStart = contentText.indexOf('{');
                            let jsonEnd = contentText.lastIndexOf('}') + 1;
                            
                            if (jsonStart === -1 || jsonEnd === 0) {
                                throw new Error('No JSON found in response');
                            }
                            
                            const jsonContent = contentText.substring(jsonStart, jsonEnd);
                            const purchasesData = JSON.parse(jsonContent);
                            
                            if (!purchasesData.purchases) {
                                throw new Error('Incorrect JSON format, "purchases" object not found');
                            }
                            
                            sendLog(`Analyzing purchases response from ${serviceName}...`);
                            
                            let totalCost = 0;
                            const purchasedUnits = [];
                            let budgetWarningSent = false;
                            
                            for (const [unitId, quantity] of Object.entries(purchasesData.purchases)) {
                                const unit = loadedUnits.get(unitId);
                                if (!unit) {
                                    sendLog(`Warning: Unit ${unitId} not found in loaded units, skipping`, 'warning');
                                    continue;
                                }
                                
                                const unitCost = unit.cost * quantity;
                                totalCost += unitCost;
                                
                                if (totalCost > initialGold) {
                                    sendLog(`Warning: Budget exceeded (${totalCost}/${initialGold}), adjusting purchases`, 'warning');
                                    if (!budgetWarningSent && matchId) {
                                        budgetWarningSent = true;
                                        reportValidationIssue(
                                            `buy-units-${team.id}-${ai.id}.json`,
                                            `Budget exceeded while purchasing units. Requested ${totalCost}/${initialGold} gold.`,
                                            false,
                                            {
                                                aiId: ai.id,
                                                teamId: team.id,
                                                aiName: serviceName,
                                                teamName: team.name,
                                                matchId
                                            },
                                            { warningIncrement: 1 }
                                        ).catch(error => console.error('Error reporting budget overrun:', error));
                                    }
                                    break;
                                }
                                
                                purchasedUnits.push({
                                    id: unitId,
                                    quantity: quantity
                                });
                                
                                sendLog(`- Purchasing ${quantity}x ${unit.name} (${unitId}) for ${unitCost} gold`);
                            }
                            
                            sendLog(`Total cost: ${totalCost}/${initialGold} gold`);
                            
                            if (purchasedUnits.length > 0) {
                                ai.purchasedUnits = purchasedUnits;
                                sendLog(`Successfully purchased ${purchasedUnits.length} different unit types.`);
                            } else {
                                sendLog(`No valid units purchased.`, 'warning');
                            }

                            window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                                detail: {
                                    type: 'progress',
                                    process: 'buyUnits',
                                    aiId: ai.id,
                                    teamId: team.id,
                                    teamName: team.name,
                                    status: 'success',
                                    durationSeconds: responseTime,
                                    budget: initialGold,
                                    spend: totalCost
                                }
                            }));
                            
                        } catch (jsonError) {
                            const errorMessage = `Error processing JSON response from ${serviceName}: ${jsonError.message}`;
                            sendLog(errorMessage, 'error');
                            ai.purchasedUnits = [];
                            flagCriticalBuyError(ai, team, serviceName, errorMessage);
                            window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                                detail: {
                                    type: 'progress',
                                    process: 'buyUnits',
                                    aiId: ai.id,
                                    teamId: team.id,
                                    teamName: team.name,
                                    status: 'error',
                                    durationSeconds: null,
                                    expectedUnits: ai.availableUnits.length,
                                    receivedUnits: 0
                                }
                            }));
                            return;
                        }
                        
                    } catch (serviceError) {
                        const errorMessage = `Error getting response from ${serviceName}: ${serviceError.message}`;
                        sendLog(errorMessage, 'error');
                        ai.purchasedUnits = [];
                        flagCriticalBuyError(ai, team, serviceName, errorMessage);
                        window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                            detail: {
                                type: 'progress',
                                process: 'buyUnits',
                                aiId: ai.id,
                                teamId: team.id,
                                teamName: team.name,
                                status: 'error',
                                durationSeconds: null,
                                expectedUnits: ai.availableUnits.length,
                                receivedUnits: 0
                            }
                        }));
                        return;
                    }
                })());
            });
        });

        await Promise.all(tasks);
        
        sendProgress('Saving updated team configuration...');
        
        try {
            await fetch('/api/config2/teams', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedTeams)
            });
            
            sendLog('Team configuration saved successfully.');
        } catch (saveError) {
            sendLog(`Error saving team configuration: ${saveError.message}`, 'error');
        }
        
        sendLog('\nUnit purchase process completed.');
        
    } catch (error) {
        sendLog(`General error: ${error.message}`, 'error');
    }
}

export async function buyUnitsForTeams() {
    matchProcessPopup.show();
    
    const isTestMode = document.getElementById('test-mode-checkbox')?.checked || false;
    
    if (isTestMode) {
        if (simpleBuyMode) {
            return await buyUnitsSimple();
        } else {
            return await buyUnitsWithProgress();
        }
    } else {
        return await processLLMBuying();
    }
}

import { activeErrors } from './gameState.js';
import { simpleBuyMode } from './aiBuy.js';

let socket = null;
const eventHandlers = new Map();
const validationIssuesCache = new Set();

export function initSocket() {
    if (socket) return socket;

    socket = io();

    socket.on('connect', () => {
        console.log('Socket connected');
    });

    socket.on('disconnect', () => {
        console.log('Socket disconnected');
    });

    socket.on('requestStatus', (data) => {
        let statusMessage = '';
        
        if (data.status === 'started') {
            statusMessage = 'Starting unit request process...';
        } else if (data.status === 'processing' && data.teamName) {
            statusMessage = `Requesting units for ${data.teamName}`;
        } else if (data.status === 'success' && data.teamName) {
            statusMessage = `Units received for ${data.teamName}`;
        } else if (data.status === 'completed') {
            statusMessage = 'Unit request process completed';
        } else if (data.status === 'error') {
            statusMessage = data.message || 'Error in unit request process';
        } else {
            statusMessage = data.message || 'Processing...';
        }

        window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
            detail: {
                type: 'progress',
                process: 'requestUnits',
                statusMessage: statusMessage,
                message: data.message,
                teamId: data.teamId,
                aiId: data.aiId,
                teamName: data.teamName,
                status: data.status
            }
        }));
        
        if (data.status === 'error' && data.error) {
            window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                detail: {
                    type: 'log',
                    process: 'requestUnits',
                    message: data.error,
                    level: 'error'
                }
            }));
        }
        
        const handlers = eventHandlers.get('requestStatus') || [];
        handlers.forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                console.error('Error in requestStatus handler:', error);
            }
        });
    });

    socket.on('apiError', (data) => {
        const handlers = eventHandlers.get('apiError') || [];
        handlers.forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                console.error('Error in apiError handler:', error);
            }
        });
    });

    socket.on('apiSuccess', (data) => {
        const handlers = eventHandlers.get('apiSuccess') || [];
        handlers.forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                console.error('Error in apiSuccess handler:', error);
            }
        });
    });

    return socket;
}

export function onRequestStatus(handler) {
    if (!socket) {
        initSocket();
    }

    if (!eventHandlers.has('requestStatus')) {
        eventHandlers.set('requestStatus', []);
    }

    eventHandlers.get('requestStatus').push(handler);

    return () => {
        const handlers = eventHandlers.get('requestStatus');
        const index = handlers.indexOf(handler);
        if (index !== -1) {
            handlers.splice(index, 1);
        }
    };
}

export function onApiError(handler) {
    if (!socket) {
        initSocket();
    }

    if (!eventHandlers.has('apiError')) {
        eventHandlers.set('apiError', []);
    }

    eventHandlers.get('apiError').push(handler);

    return () => {
        const handlers = eventHandlers.get('apiError');
        const index = handlers.indexOf(handler);
        if (index !== -1) {
            handlers.splice(index, 1);
        }
    };
}

export function onApiSuccess(handler) {
    if (!socket) {
        initSocket();
    }

    if (!eventHandlers.has('apiSuccess')) {
        eventHandlers.set('apiSuccess', []);
    }

    eventHandlers.get('apiSuccess').push(handler);

    return () => {
        const handlers = eventHandlers.get('apiSuccess');
        const index = handlers.indexOf(handler);
        if (index !== -1) {
            handlers.splice(index, 1);
        }
    };
}

export function requestUnits(matchId) {
    if (!socket) {
        initSocket();
    }

    if (socket.connected) {
        socket.emit('requestUnits', { matchId });
    } else {
        const onConnect = () => {
            socket.emit('requestUnits', { matchId });
            socket.off('connect', onConnect);
        };
        socket.on('connect', onConnect);
    }
}

export function requestUnitsForAI(matchId, teamId, aiId) {
    if (!socket) {
        initSocket();
    }

    if (socket.connected) {
        socket.emit('requestUnitsForAI', { matchId, teamId, aiId });
    } else {
        const onConnect = () => {
            socket.emit('requestUnitsForAI', { matchId, teamId, aiId });
            socket.off('connect', onConnect);
        };
        socket.on('connect', onConnect);
    }
}

async function getAIAndTeamInfo(matchId, filename) {
    try {
        const matchResponse = await fetch(`/api/stats/match/${matchId}`);
        const matchDetails = await matchResponse.json();
        
        let ai = 'Unknown AI';
        let team = 'Unknown Team';
        
        if (matchDetails && matchDetails.files && matchDetails.participants) {
            const fileInfo = matchDetails.files.find(file => file.filename === filename);
            
            if (fileInfo && fileInfo.ai_id) {
                const participant = matchDetails.participants.find(p => p.ai_id === fileInfo.ai_id);
                
                if (participant) {
                    const servicessResponse = await fetch('/api/config2');
                    const config = await servicessResponse.json();
                    
                    if (config && config.aiServices) {
                        const service = config.aiServices.find(s => s.type === participant.service_type);
                        if (service) {
                            ai = service.name || service.type;
                        } else {
                            ai = participant.service_type;
                        }
                    } else {
                        ai = participant.service_type;
                    }
                    
                    if (config && config.teams) {
                        for (const teamObj of config.teams) {
                            const aiInTeam = teamObj.ais.find(a => a.id === fileInfo.ai_id);
                            if (aiInTeam) {
                                team = teamObj.name;
                                break;
                            }
                        }
                    }
                }
            }
        }
        
        return { ai, team };
    } catch (error) {
        console.error('Error getting AI and team info:', error);
        return { ai: 'Unknown AI', team: 'Unknown Team' };
    }
}

export async function reportValidationIssue(filename, message, isError = false) {
    if (!socket) {
        initSocket();
    }

    const currentMatchId = window.currentMatchId;

    if (!currentMatchId) {
        console.log('[ValidationLog] No matchId available, validation issue not reported');
        return;
    }

    const uniqueId = `${currentMatchId}:${filename}:${message}`;

    if (validationIssuesCache.has(uniqueId)) return;

    validationIssuesCache.add(uniqueId);

    const { ai, team } = await getAIAndTeamInfo(currentMatchId, filename);

    const errorData = {
        type: isError ? 'error' : 'warning',
        time: new Date().toLocaleTimeString(),
        file: filename,
        ai: ai,
        team: team,
        message: message
    };

    activeErrors.push(errorData);

    window.dispatchEvent(new CustomEvent('errorAdded', { detail: errorData }));

    if (socket.connected) {
        socket.emit('validation_issue', {
            matchId: currentMatchId,
            filename: filename,
            message: message,
            isError: isError,
            errorIncrement: isError ? 1 : 0,
            warningIncrement: isError ? 0 : 1
        });
    } else {
        const onConnect = () => {
            socket.emit('validation_issue', {
                matchId: currentMatchId,
                filename: filename,
                message: message,
                isError: isError,
                errorIncrement: isError ? 1 : 0,
                warningIncrement: isError ? 0 : 1
            });
            socket.off('connect', onConnect);
        };
        socket.on('connect', onConnect);
    }
}

export function clearValidationCache() {
    validationIssuesCache.clear();
}

export function simulateUnitRequest(matchId) {
    const handlers = eventHandlers.get('requestStatus') || [];

    window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
        detail: {
            type: 'progress',
            process: 'requestUnits',
            statusMessage: 'Starting unit request process (TEST MODE)',
            message: 'Starting units request process (TEST MODE)'
        }
    }));

    handlers.forEach(handler => {
        try {
            handler({
                status: 'started',
                message: 'Starting units request process (TEST MODE)'
            });
        } catch (error) {
            console.error('Error in simulateUnitRequest start handler:', error);
        }
    });

    fetch('/api/config2')
        .then(response => response.json())
        .then(async config => {
            if (!config) return;

            const availableTeams = config.teams.filter(team => team.isAvailable);

            for (const team of availableTeams) {
                for (const ai of team.ais) {
                    window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                        detail: {
                            type: 'progress',
                            process: 'requestUnits',
                            statusMessage: `Creating test unit for ${team.name}`,
                            message: `Simulating unit request for ${team.name} (TEST MODE)`,
                            teamId: team.id,
                            aiId: ai.id,
                            teamName: team.name
                        }
                    }));

                    handlers.forEach(handler => {
                        try {
                            handler({
                                status: 'processing',
                                teamId: team.id,
                                aiId: ai.id,
                                teamName: team.name,
                                message: `Simulating unit request for ${team.name} (TEST MODE)`
                            });
                        } catch (error) {
                            console.error('Error in simulateUnitRequest processing handler:', error);
                        }
                    });

                    if (!simpleBuyMode) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }

                    const timestamp = Date.now();
                    const colors = ["#FF5722", "#9C27B0", "#3F51B5", "#009688", "#FFC107", "#795548"];
                    const randomColor = colors[Math.floor(Math.random() * colors.length)];
                    const testUnitId = `kewoTest${timestamp}`;

                    const testUnit = {
                        id: testUnitId,
                        name: "Test Unit",
                        description: "A test unit created in test mode.",
                        cost: 100 + Math.floor(Math.random() * 100),
                        life: 10 + Math.floor(Math.random() * 10),
                        speed: 1 + Math.random(),
                        scale: 5,
                        damage: 2 + Math.floor(Math.random() * 5),
                        attackType: Math.random() > 0.5 ? "melee" : "ranged",
                        graphics: [
                            [0, 0, randomColor, 0, 0],
                            [0, randomColor, randomColor, randomColor, 0],
                            [0, randomColor, "#000000", randomColor, 0],
                            ["#8B4513", randomColor, randomColor, randomColor, "#8B4513"],
                            [0, "#8B4513", "#8B4513", "#8B4513", 0],
                            [0, "#8B4513", 0, "#8B4513", 0],
                            [0, "#8B4513", 0, "#8B4513", 0]
                        ],
                        attackRange: 50,
                        attackSpeed: 1000,
                        swordGraphics: {
                            width: 40,
                            height: 4,
                            color: "#808080"
                        },
                        sounds: {
                            spawn: [
                                "sine",
                                330,
                                200,
                                2,
                                30,
                                800,
                                2,
                                0,
                                0,
                                false,
                                false,
                                0,
                                0,
                                0
                            ],
                            death: [
                                "sawtooth",
                                110,
                                800,
                                5,
                                60,
                                400,
                                8,
                                0,
                                0,
                                false,
                                false,
                                0,
                                0,
                                0
                            ],
                            attack: [
                                "triangle",
                                550,
                                100,
                                0.5,
                                20,
                                1200,
                                4,
                                0,
                                0,
                                false,
                                false,
                                0,
                                0,
                                0
                            ]
                        },
                        effects: {
                            spawn: "fx-basicSpawn",
                            death: "fx-basicDeath",
                            attack: "fx-basicAttack",
                            continuous: "fx-basicGlow"
                        }
                    };

                    if (testUnit.attackType === "ranged") {
                        testUnit.optimalRange = 300;
                        testUnit.projectileSpeed = 6;
                        testUnit.attackInterval = {
                            min: 3000,
                            max: 4000
                        };
                        testUnit.projectileColor = randomColor;
                        testUnit.projectileTrailColor = randomColor;
                    }

                    try {
                        const response = await fetch('/api/units', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(testUnit)
                        });

                        if (!response.ok) {
                            throw new Error('Failed to save test unit');
                        }

                        if (!ai.availableUnits.includes(testUnitId)) {
                            ai.availableUnits.push(testUnitId);
                        }

                        window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                            detail: {
                                type: 'log',
                                process: 'requestUnits',
                                message: `TEST MODE: Created unit ${testUnitId} for ${team.name}`,
                                level: 'info'
                            }
                        }));

                        handlers.forEach(handler => {
                            try {
                                handler({
                                    status: 'success',
                                    teamId: team.id,
                                    aiId: ai.id,
                                    unitId: testUnitId,
                                    message: `TEST MODE: Created unit ${testUnitId} for ${team.name}`
                                });
                            } catch (error) {
                                console.error('Error in simulateUnitRequest success handler:', error);
                            }
                        });
                    } catch (error) {
                        window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                            detail: {
                                type: 'log',
                                process: 'requestUnits',
                                message: `Error in test mode: ${error.message}`,
                                level: 'error'
                            }
                        }));

                        handlers.forEach(handler => {
                            try {
                                handler({
                                    status: 'error',
                                    teamId: team.id,
                                    aiId: ai.id,
                                    error: error.message,
                                    message: `Error in test mode: ${error.message}`
                                });
                            } catch (err) {
                                console.error('Error in simulateUnitRequest error handler:', err);
                            }
                        });
                    }
                }
            }

            await fetch('/api/config2/teams', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config.teams)
            });

            handlers.forEach(handler => {
                try {
                    handler({
                        status: 'completed',
                        message: 'Test mode process completed'
                    });
                } catch (error) {
                    console.error('Error in simulateUnitRequest completion handler:', error);
                }
            });
        })
        .catch(error => {
            window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                detail: {
                    type: 'log',
                    process: 'requestUnits',
                    message: `Error in test mode simulation: ${error.message}`,
                    level: 'error'
                }
            }));

            handlers.forEach(handler => {
                try {
                    handler({
                        status: 'error',
                        error: error.message,
                        message: 'Error in test mode simulation'
                    });
                } catch (err) {
                    console.error('Error in simulateUnitRequest global error handler:', err);
                }
            });
        });
}

export function simulateUnitRequestForAI(matchId, teamId, aiId) {
    const handlers = eventHandlers.get('requestStatus') || [];

    window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
        detail: {
            type: 'progress',
            process: 'requestUnits',
            statusMessage: 'Starting unit request for specific AI (TEST MODE)',
            message: 'Starting units request process for specific AI (TEST MODE)'
        }
    }));

    handlers.forEach(handler => {
        try {
            handler({
                status: 'started',
                message: 'Starting units request process for specific AI (TEST MODE)'
            });
        } catch (error) {
            console.error('Error in simulateUnitRequestForAI start handler:', error);
        }
    });

    fetch('/api/config2')
        .then(response => response.json())
        .then(async config => {
            if (!config) return;

            const team = config.teams.find(t => t.id === teamId && t.isAvailable);
            if (!team) return;

            const ai = team.ais.find(a => a.id === aiId);
            if (!ai) return;

            window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                detail: {
                    type: 'progress',
                    process: 'requestUnits',
                    statusMessage: `Creating test unit for ${team.name}`,
                    message: `Simulating unit request for ${team.name} - Specific AI (TEST MODE)`,
                    teamId: team.id,
                    aiId: ai.id,
                    teamName: team.name
                }
            }));

            handlers.forEach(handler => {
                try {
                    handler({
                        status: 'processing',
                        teamId: team.id,
                        aiId: ai.id,
                        teamName: team.name,
                        message: `Simulating unit request for ${team.name} - Specific AI (TEST MODE)`
                    });
                } catch (error) {
                    console.error('Error in simulateUnitRequestForAI processing handler:', error);
                }
            });

            if (!simpleBuyMode) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            const timestamp = Date.now();
            const colors = ["#FF5722", "#9C27B0", "#3F51B5", "#009688", "#FFC107", "#795548"];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            const testUnitId = `kewoTest${timestamp}`;

            const testUnit = {
                id: testUnitId,
                name: "Test Unit",
                description: "A test unit created in test mode for specific AI.",
                cost: 100 + Math.floor(Math.random() * 100),
                life: 10 + Math.floor(Math.random() * 10),
                speed: 1 + Math.random(),
                scale: 5,
                damage: 2 + Math.floor(Math.random() * 5),
                attackType: Math.random() > 0.5 ? "melee" : "ranged",
                graphics: [
                    [0, 0, randomColor, 0, 0],
                    [0, randomColor, randomColor, randomColor, 0],
                    [0, randomColor, "#000000", randomColor, 0],
                    ["#8B4513", randomColor, randomColor, randomColor, "#8B4513"],
                    [0, "#8B4513", "#8B4513", "#8B4513", 0],
                    [0, "#8B4513", 0, "#8B4513", 0],
                    [0, "#8B4513", 0, "#8B4513", 0]
                ],
                attackRange: 50,
                attackSpeed: 1000,
                swordGraphics: {
                    width: 40,
                    height: 4,
                    color: "#808080"
                },
                sounds: {
                    spawn: [
                        "sine",
                        330,
                        200,
                        2,
                        30,
                        800,
                        2,
                        0,
                        0,
                        false,
                        false,
                        0,
                        0,
                        0
                    ],
                    death: [
                        "sawtooth",
                        110,
                        800,
                        5,
                        60,
                        400,
                        8,
                        0,
                        0,
                        false,
                        false,
                        0,
                        0,
                        0
                    ],
                    attack: [
                        "triangle",
                        550,
                        100,
                        0.5,
                        20,
                        1200,
                        4,
                        0,
                        0,
                        false,
                        false,
                        0,
                        0,
                        0
                    ]
                },
                effects: {
                    spawn: "fx-basicSpawn",
                    death: "fx-basicDeath",
                    attack: "fx-basicAttack",
                    continuous: "fx-basicGlow"
                }
            };

            if (testUnit.attackType === "ranged") {
                testUnit.optimalRange = 300;
                testUnit.projectileSpeed = 6;
                testUnit.attackInterval = {
                    min: 3000,
                    max: 4000
                };
                testUnit.projectileColor = randomColor;
                testUnit.projectileTrailColor = randomColor;
            }

            try {
                const response = await fetch('/api/units', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(testUnit)
                });

                if (!response.ok) {
                    throw new Error('Failed to save test unit');
                }

                if (!ai.availableUnits.includes(testUnitId)) {
                    ai.availableUnits.push(testUnitId);
                }

                window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                    detail: {
                        type: 'log',
                        process: 'requestUnits',
                        message: `TEST MODE: Created unit ${testUnitId} for specific AI in ${team.name}`,
                        level: 'info'
                    }
                }));

                handlers.forEach(handler => {
                    try {
                        handler({
                            status: 'success',
                            teamId: team.id,
                            aiId: ai.id,
                            unitId: testUnitId,
                            message: `TEST MODE: Created unit ${testUnitId} for specific AI in ${team.name}`
                        });
                    } catch (error) {
                        console.error('Error in simulateUnitRequestForAI success handler:', error);
                    }
                });
            } catch (error) {
                window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                    detail: {
                        type: 'log',
                        process: 'requestUnits',
                        message: `Error in test mode for specific AI: ${error.message}`,
                        level: 'error'
                    }
                }));

                handlers.forEach(handler => {
                    try {
                        handler({
                            status: 'error',
                            teamId: team.id,
                            aiId: ai.id,
                            error: error.message,
                            message: `Error in test mode for specific AI: ${error.message}`
                        });
                    } catch (err) {
                        console.error('Error in simulateUnitRequestForAI error handler:', err);
                    }
                });
            }

            await fetch('/api/config2/teams', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config.teams)
            });

            handlers.forEach(handler => {
                try {
                    handler({
                        status: 'completed',
                        message: 'Test mode process completed for specific AI'
                    });
                } catch (error) {
                    console.error('Error in simulateUnitRequestForAI completion handler:', error);
                }
            });
        })
        .catch(error => {
            window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                detail: {
                    type: 'log',
                    process: 'requestUnits',
                    message: `Error in test mode simulation for specific AI: ${error.message}`,
                    level: 'error'
                }
            }));

            handlers.forEach(handler => {
                try {
                    handler({
                        status: 'error',
                        error: error.message,
                        message: 'Error in test mode simulation for specific AI'
                    });
                } catch (err) {
                    console.error('Error in simulateUnitRequestForAI global error handler:', err);
                }
            });
        });
}
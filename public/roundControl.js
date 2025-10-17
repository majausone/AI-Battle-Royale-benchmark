import { clearAllCharacters } from './characters.js';
import { initializeCanvas, render } from './render.js';
import { updateUI } from './ui.js';
import * as gameState from './gameState.js';
import { matchProcessPopup } from './matchProcessPopup.js';
import { requestUnitsForTeams } from './aiRequestUnits.js';
import { adaptUnitPrices } from './aiPrices.js';
import { buyUnitsForTeams } from './aiBuy.js';
import { onRequestStatus, initSocket, clearValidationCache } from './socketManager.js';
import { initializeUnits } from './unitLoader.js';

let autoPlayTimeout = null;
let isWaitingForRequests = false;
let currentMatchId = null;
let pendingSpawn = null;
let checkRoundInterval = null;

window.currentMatchId = null;

async function loadConfig() {
    try {
        const response = await fetch('/api/config2');
        return await response.json();
    } catch (error) {
        console.error('Error loading config:', error);
        return null;
    }
}

async function saveRoundData(data) {
    try {
        const response = await fetch('/api/config2/round', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        return response.ok;
    } catch (error) {
        console.error('Error saving round data:', error);
        return false;
    }
}

async function saveTeamsData(teams) {
    try {
        const response = await fetch('/api/config2/teams', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(teams)
        });
        return response.ok;
    } catch (error) {
        console.error('Error saving teams data:', error);
        return false;
    }
}

async function clearRoundHistory() {
    try {
        const response = await fetch('/api/round-history/clear', {
            method: 'POST'
        });
        return response.ok;
    } catch (error) {
        console.error('Error clearing round history:', error);
        return false;
    }
}

async function clearRoundWins() {
    try {
        const response = await fetch('/api/round-wins/clear', {
            method: 'POST'
        });
        return response.ok;
    } catch (error) {
        console.error('Error clearing round wins:', error);
        return false;
    }
}

async function ensureRoundWins(matchId, teamIds) {
    try {
        if (!matchId) {
            console.error('Missing matchId in ensureRoundWins');
            return { success: false, error: 'No match ID provided' };
        }

        const response = await fetch('/api/round-wins/ensure', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                match_id: matchId,
                team_ids: teamIds
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to ensure round wins: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error ensuring round wins:', error);
        return { success: false, error: error.message };
    }
}

async function addParticipantsToMatch(matchId, teams) {
    try {
        if (!matchId) {
            console.error('Missing matchId in addParticipantsToMatch');
            return { success: false, error: 'No match ID provided' };
        }

        const aiIds = [];
        teams.forEach(team => {
            team.ais.forEach(ai => {
                if (ai.id) aiIds.push(ai.id);
            });
        });

        if (aiIds.length === 0) {
            console.error('No AIs found in teams');
            return { success: false, error: 'No AIs found' };
        }

        const response = await fetch(`/api/matches/${matchId}/participants`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ aiIds })
        });

        if (!response.ok) {
            throw new Error(`Server returned error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error adding participants to match:', error);
        return { success: false, error: error.message };
    }
}

function cleanupRound() {
    clearAllCharacters();
    gameState.resetGameState();
}

function checkTeamAlive(teamId) {
    return Array.from(gameState.gameObjects.values()).some(obj => obj.teamId === teamId);
}

function getAliveTeams() {
    const aliveTeams = new Set();
    gameState.gameObjects.forEach(obj => {
        if (obj.teamId) {
            aliveTeams.add(obj.teamId);
        }
    });
    return Array.from(aliveTeams);
}

function waitForRequestCompletion() {
    return new Promise((resolve) => {
        isWaitingForRequests = true;

        const unsubscribe = onRequestStatus((data) => {
            if (data.status === 'completed' && isWaitingForRequests) {
                isWaitingForRequests = false;
                if (unsubscribe) unsubscribe();
                resolve();
            }
        });
    });
}

async function waitForPurchasedUnits(config) {
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
        const hasPurchasedUnits = config.teams.some(team =>
            team.ais.some(ai => ai.purchasedUnits && ai.purchasedUnits.length > 0)
        );

        if (hasPurchasedUnits) {
            return true;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        const newConfigResponse = await fetch('/api/config2');
        if (newConfigResponse.ok) {
            const newConfig = await newConfigResponse.json();
            config.teams = newConfig.teams;
        }
        attempts++;
    }

    return false;
}

async function executeFullRound(gameState, initTeams, spawnUnits, isFirstRound = false, matchId = null) {
    initSocket();

    if (matchId) {
        if (currentMatchId !== matchId) {
            clearValidationCache();
            currentMatchId = matchId;
            window.currentMatchId = matchId;
        }
    }

    try {
        if (!isFirstRound) {
            matchProcessPopup.show(currentMatchId);
        }

        const configResponse = await fetch('/api/config2');
        if (!configResponse.ok) {
            throw new Error('Error loading configuration');
        }

        const config = await configResponse.json();
        if (!config || config.currentRound > config.gameSettings.numRounds) {
            autoPlayTimeout = null;
            return;
        }

        if (currentMatchId && config.teams) {
            const participantsResult = await addParticipantsToMatch(currentMatchId, config.teams);
            if (!participantsResult.success) {
                console.error('Failed to add participants:', participantsResult.error);
            }
        }

        if (isFirstRound) {
            gameState.clearGameErrors();
            
            window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                detail: { type: 'start', process: 'requestUnits' }
            }));
            
            isWaitingForRequests = false;
            await requestUnitsForTeams(currentMatchId);
            await waitForRequestCompletion();
            
            window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                detail: { type: 'complete', process: 'requestUnits', success: true }
            }));

            await initializeUnits();
            await new Promise(resolve => setTimeout(resolve, 500));

            window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                detail: { type: 'start', process: 'adaptPrices' }
            }));
            
            await adaptUnitPrices();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                detail: { type: 'complete', process: 'adaptPrices', success: true }
            }));

            window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                detail: { type: 'start', process: 'buyUnits' }
            }));
            
            await buyUnitsForTeams();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                detail: { type: 'complete', process: 'buyUnits', success: true }
            }));

            await initializeUnits();
            await new Promise(resolve => setTimeout(resolve, 1000));

            const purchased = await waitForPurchasedUnits(config);
            if (!purchased) {
                console.error('Failed to purchase units');
                return;
            }
        }

        if (!gameState.isInitialized) {
            gameState.initGame();
            initTeams();
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        if (currentMatchId) {
            const teamIds = config.teams.map(team => team.id);
            const winsResult = await ensureRoundWins(currentMatchId, teamIds);
            if (!winsResult.success) {
                console.error('Failed to ensure round wins:', winsResult.error);
            }
        }

        await initializeUnits();
        await new Promise(resolve => setTimeout(resolve, 500));

        pendingSpawn = {
            teams: config.teams,
            spawnUnits: spawnUnits,
            initTeams: initTeams
        };

        window.dispatchEvent(new CustomEvent('battleReady', {
            detail: { 
                matchId: currentMatchId,
                teams: config.teams
            }
        }));

    } catch (error) {
        console.error('Error executing full round:', error);
        autoPlayTimeout = null;
        matchProcessPopup.hide();
    }
}

function startBattle() {
    if (pendingSpawn) {
        const { teams, spawnUnits, initTeams } = pendingSpawn;
        
        spawnUnits(teams);
        
        if (checkRoundInterval) {
            clearInterval(checkRoundInterval);
        }
        
        checkRoundInterval = setInterval(() => {
            const teamIds = new Set();
            gameState.gameObjects.forEach(obj => {
                if (obj.teamId) {
                    teamIds.add(obj.teamId);
                }
            });

            if (teamIds.size <= 1) {
                clearInterval(checkRoundInterval);
                checkRoundInterval = null;
                handleRoundEnd(gameState, initTeams, spawnUnits);
            }
        }, 1000);
        
        pendingSpawn = null;
    }
}

window.addEventListener('startBattleNow', startBattle);

async function updateMatchWithWinner(matchId, winningTeamId) {
    if (!matchId) {
        console.error('No matchId provided to updateMatchWithWinner');
        return false;
    }

    try {
        const teamsResponse = await fetch(`/api/stats/team/${winningTeamId}/ais`);
        if (!teamsResponse.ok) {
            throw new Error(`Failed to get team AIs: ${teamsResponse.status}`);
        }

        const teamsData = await teamsResponse.json();

        if (teamsData.ais && teamsData.ais.length > 0) {
            const winningAI = teamsData.ais[0];

            const completeMatchResponse = await fetch(`/api/matches/${matchId}/complete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    winnerId: winningAI.ai_id
                })
            });

            return completeMatchResponse.ok;
        }

        return false;
    } catch (error) {
        console.error('Error updating match with winner:', error);
        return false;
    }
}

async function clearAIUnits() {
    try {
        const config = await loadConfig();
        if (!config || !config.teams) return;

        for (const team of config.teams) {
            for (const ai of team.ais) {
                ai.purchasedUnits = [];

                ai.availableUnits = ai.availableUnits.filter(unitId =>
                    unitId === 'kewoBasico' || unitId === 'kewoArco'
                );
            }
        }

        await saveTeamsData(config.teams);

        console.log('Units cleared successfully');
        return true;
    } catch (error) {
        console.error('Error clearing AI units:', error);
        return false;
    }
}

async function handleRoundEnd(gameState, initTeams, spawnUnits) {
    try {
        const configResponse = await fetch('/api/config2');
        if (!configResponse.ok) {
            throw new Error('Error loading configuration');
        }

        const config = await configResponse.json();
        if (!config) return;

        const aliveTeams = getAliveTeams();
        if (aliveTeams.length === 1) {
            const winningTeamId = aliveTeams[0];

            if (!config.roundWins) {
                config.roundWins = {};
            }

            if (!config.roundWins[winningTeamId]) {
                config.roundWins[winningTeamId] = 0;
            }

            config.roundWins[winningTeamId]++;

            if (currentMatchId) {
                const winsResponse = await fetch('/api/round-wins');
                const winsData = await winsResponse.json();
                const wins = winsData.data || [];

                const existingWin = wins.find(win =>
                    win.match_id === currentMatchId && win.team_id === parseInt(winningTeamId)
                );

                if (existingWin) {
                    await fetch('/api/round-wins', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            id: existingWin.id,
                            match_id: currentMatchId,
                            team_id: parseInt(winningTeamId),
                            wins_count: existingWin.wins_count + 1
                        })
                    });
                } else {
                    await fetch('/api/round-wins', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            match_id: currentMatchId,
                            team_id: parseInt(winningTeamId),
                            wins_count: 1
                        })
                    });
                }

                await fetch('/api/round-history', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        match_id: currentMatchId,
                        round_number: config.currentRound,
                        winner_team_id: parseInt(winningTeamId)
                    })
                });
            }

            const roundResult = {
                round: config.currentRound,
                winner: winningTeamId,
                teams: Array.from(gameState.teamStats.keys()).map(teamId => ({
                    id: teamId,
                    name: gameState.teamStats.get(teamId).name,
                    alive: aliveTeams.includes(teamId)
                }))
            };

            if (!config.roundHistory) {
                config.roundHistory = [];
            }

            config.roundHistory.push(roundResult);

            const winningTeam = config.teams.find(t => t.id === winningTeamId);
            
            matchProcessPopup.show(currentMatchId);
            window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                detail: {
                    type: 'roundWin',
                    winner: winningTeam.name,
                    round: config.currentRound,
                    totalRounds: config.gameSettings.numRounds,
                    matchId: currentMatchId
                }
            }));

            cleanupRound();

            await saveRoundData({
                currentRound: config.currentRound,
                roundHistory: config.roundHistory,
                roundWins: config.roundWins
            });

            if (config.currentRound >= config.gameSettings.numRounds) {
                handleGameEnd(config);
            } else {
                config.currentRound++;
                await saveRoundData({
                    currentRound: config.currentRound,
                    roundHistory: config.roundHistory,
                    roundWins: config.roundWins
                });
                window.dispatchEvent(new CustomEvent('roundEnded', {
                    detail: {
                        winner: winningTeamId,
                        nextRound: config.currentRound
                    }
                }));

                setTimeout(() => {
                    executeFullRound(gameState, initTeams, spawnUnits, false, currentMatchId);
                }, 3000);
            }
        }
    } catch (error) {
        console.error('Error handling round end:', error);
    }
}

async function handleGameEnd(config) {
    cleanupRound();

    try {
        const winners = Object.entries(config.roundWins)
            .sort(([, a], [, b]) => b - a);

        if (winners.length === 0) {
            window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                detail: {
                    type: 'gameDraw',
                    matchId: currentMatchId
                }
            }));
        } else {
            const maxWins = winners[0][1];
            const topWinners = winners.filter(([, wins]) => wins === maxWins);

            if (topWinners.length > 1) {
                window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                    detail: {
                        type: 'gameDraw',
                        matchId: currentMatchId
                    }
                }));
            } else {
                const winningTeamId = parseInt(topWinners[0][0]);
                const winningTeam = config.teams.find(t => t.id === winningTeamId);
                
                window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                    detail: {
                        type: 'gameWin',
                        winner: winningTeam.name,
                        wins: maxWins,
                        matchId: currentMatchId
                    }
                }));

                if (currentMatchId) {
                    await updateMatchWithWinner(currentMatchId, winningTeamId);
                }
            }
        }

        setTimeout(() => {
            matchProcessPopup.hide();
        }, 5000);

        await clearAIUnits();

        config.currentRound = 1;
        config.roundHistory = [];
        config.roundWins = {};

        await saveRoundData({
            currentRound: config.currentRound,
            roundHistory: config.roundHistory,
            roundWins: config.roundWins
        });

        await clearRoundHistory();
        await clearRoundWins();

        clearValidationCache();
        currentMatchId = null;
        window.currentMatchId = null;

        window.dispatchEvent(new CustomEvent('roundEnded', {
            detail: {
                winner: null,
                nextRound: config.currentRound
            }
        }));

        if (autoPlayTimeout) {
            clearTimeout(autoPlayTimeout);
            autoPlayTimeout = null;
        }
    } catch (error) {
        console.error('Error handling game end:', error);
    }
}

async function startNextRound() {
    try {
        const configResponse = await fetch('/api/config2');
        if (!configResponse.ok) {
            throw new Error('Error loading configuration');
        }

        const config = await configResponse.json();
        if (!config) return;

        cleanupRound();

        await saveRoundData({
            currentRound: config.currentRound,
            roundHistory: config.roundHistory,
            roundWins: config.roundWins
        });

        window.dispatchEvent(new CustomEvent('roundStarted', {
            detail: {
                roundNumber: config.currentRound
            }
        }));
    } catch (error) {
        console.error('Error starting next round:', error);
    }
}

async function initializeNewGame() {
    try {
        const configResponse = await fetch('/api/config2');
        if (!configResponse.ok) {
            throw new Error('Error loading configuration');
        }

        const config = await configResponse.json();
        if (!config) return;

        cleanupRound();

        await clearAIUnits();

        gameState.clearGameErrors();

        config.currentRound = 1;
        config.roundHistory = [];
        config.roundWins = {};
        
        clearValidationCache();
        currentMatchId = null;
        window.currentMatchId = null;

        await saveRoundData({
            currentRound: config.currentRound,
            roundHistory: config.roundHistory,
            roundWins: config.roundWins
        });

        await clearRoundHistory();
        await clearRoundWins();

        window.dispatchEvent(new CustomEvent('gameInitialized'));
    } catch (error) {
        console.error('Error initializing new game:', error);
    }
}

export {
    handleRoundEnd,
    startNextRound,
    initializeNewGame,
    checkTeamAlive,
    executeFullRound,
    autoPlayTimeout,
    currentMatchId
}
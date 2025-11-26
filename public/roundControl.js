import { clearAllCharacters } from './characters.js';
import { initializeCanvas, render } from './render.js';
import { updateUI, clearUI } from './ui.js';
import * as gameState from './gameState.js';
import { matchProcessPopup } from './matchProcessPopup.js';
import { finalSummaryPopup } from './finalSummaryPopup.js';
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
let eliminationOrder = [];
let lastAliveTeams = new Set();

window.currentMatchId = null;

async function loadConfig(matchId = null) {
    try {
        const query = matchId ? `?matchId=${matchId}` : '';
        const response = await fetch(`/api/config2${query}`);
        return await response.json();
    } catch (error) {
        console.error('Error loading config:', error);
        return null;
    }
}

async function saveRoundData(data, matchId = null) {
    try {
        const payload = matchId ? { ...data, matchId } : data;
        const response = await fetch('/api/config2/round', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
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
    clearUI();
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
        const newConfig = await loadConfig(currentMatchId);
        if (newConfig?.teams) {
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

        const config = await loadConfig(currentMatchId);
        if (!config) {
            throw new Error('Error loading configuration');
        }
        if (!config || config.currentRound > config.gameSettings.numRounds) {
            autoPlayTimeout = null;
            return;
        }

        if (currentMatchId && config.teams) {
            const availableTeams = config.teams.filter(team => team.isAvailable === true);
            const participantsResult = await addParticipantsToMatch(currentMatchId, availableTeams);
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
        
        eliminationOrder = [];
        lastAliveTeams = new Set();
        gameState.gameObjects.forEach(obj => {
            if (obj.teamId) {
                lastAliveTeams.add(obj.teamId);
            }
        });
        
        if (checkRoundInterval) {
            clearInterval(checkRoundInterval);
        }
        
        checkRoundInterval = setInterval(() => {
            const currentAliveTeams = new Set();
            gameState.gameObjects.forEach(obj => {
                if (obj.teamId) {
                    currentAliveTeams.add(obj.teamId);
                }
            });

            lastAliveTeams.forEach(teamId => {
                if (!currentAliveTeams.has(teamId)) {
                    eliminationOrder.push({
                        teamId: teamId,
                        timestamp: Date.now()
                    });
                }
            });

            lastAliveTeams = currentAliveTeams;

            if (currentAliveTeams.size <= 1) {
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

async function deleteMatchFiles(matchId) {
    try {
        const response = await fetch(`/api/stats/match/${matchId}/delete-only-files`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to delete match files: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Match files deleted successfully:', result);
        return true;
    } catch (error) {
        console.error('Error deleting match files:', error);
        return false;
    }
}

async function handleRoundEnd(gameState, initTeams, spawnUnits) {
    try {
        const config = await loadConfig(currentMatchId);
        if (!config) return;
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

            if (!config.teamPositions) {
                config.teamPositions = {};
            }

            const availableTeams = config.teams.filter(team => team.isAvailable !== false);
            availableTeams.forEach(team => {
                if (!config.teamPositions[team.id]) {
                    config.teamPositions[team.id] = [];
                }
            });

            const roundPositions = {};
            roundPositions[winningTeamId] = 1;

            let position = 2;
            for (let i = eliminationOrder.length - 1; i >= 0; i--) {
                const teamId = eliminationOrder[i].teamId;
                roundPositions[teamId] = position;
                position++;
            }

            availableTeams.forEach(team => {
                const pos = roundPositions[team.id] || position;
                config.teamPositions[team.id].push(pos);
            });

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
                roundWins: config.roundWins,
                teamPositions: config.teamPositions
            }, currentMatchId);

            if (config.currentRound >= config.gameSettings.numRounds) {
                await handleGameEnd(config);
            } else {
                config.currentRound++;
                await saveRoundData({
                    currentRound: config.currentRound,
                    roundHistory: config.roundHistory,
                    roundWins: config.roundWins,
                    teamPositions: config.teamPositions
                }, currentMatchId);
                window.dispatchEvent(new CustomEvent('roundEnded', {
                    detail: {
                        winner: winningTeamId,
                        nextRound: config.currentRound
                    }
                }));

                const autoMode = matchProcessPopup.autoMode;
                const delay = autoMode ? 1000 : 3000;

                setTimeout(() => {
                    executeFullRound(gameState, initTeams, spawnUnits, false, currentMatchId);
                }, delay);
            }
        }
    } catch (error) {
        console.error('Error handling round end:', error);
    }
}

async function handleGameEnd(config) {
    cleanupRound();

    try {
        const isCleanMode = matchProcessPopup.getCleanMode();

        if (isCleanMode && currentMatchId) {
            await deleteMatchFiles(currentMatchId);
        }

        const matchIssues = {};
        if (currentMatchId) {
            try {
                const matchStatsResponse = await fetch(`/api/stats/match/${currentMatchId}`);
                if (matchStatsResponse.ok) {
                    const matchData = await matchStatsResponse.json();

                    if (Array.isArray(matchData.participants)) {
                        matchData.participants.forEach(participant => {
                            const aiId = participant.ai_id;
                            const issues = (participant.has_errors || 0) * 4 + (participant.has_warnings || 0);
                            if (!matchIssues[aiId]) {
                                matchIssues[aiId] = 0;
                            }
                            matchIssues[aiId] += issues;
                        });
                    } else if (Array.isArray(matchData.responses)) { // Fallback legacy
                        matchData.responses.forEach(response => {
                            const aiId = response.ai_id;
                            const issues = (response.has_errors || 0) * 4 + (response.has_warnings || 0);
                            if (!matchIssues[aiId]) {
                                matchIssues[aiId] = 0;
                            }
                            matchIssues[aiId] += issues;
                        });
                    }
                }
            } catch (error) {
                console.error('Error fetching match issues:', error);
            }
        }

        const availableTeams = config.teams.filter(team => team.isAvailable !== false);
        const ranking = [];

        for (const team of availableTeams) {
            const positionSum = (config.teamPositions && config.teamPositions[team.id]) 
                ? config.teamPositions[team.id].reduce((a, b) => a + b, 0) 
                : 0;

            let teamIssues = 0;
            team.ais.forEach(ai => {
                if (matchIssues[ai.id]) {
                    teamIssues += matchIssues[ai.id];
                }
            });

            ranking.push({
                teamId: team.id,
                teamName: team.name,
                teamColor: team.color,
                positionSum: positionSum,
                issues: teamIssues,
                wins: (config.roundWins && config.roundWins[team.id]) ? config.roundWins[team.id] : 0
            });
        }

        ranking.sort((a, b) => {
            if (a.wins !== b.wins) {
                return b.wins - a.wins;
            }
            if (a.positionSum !== b.positionSum) {
                return a.positionSum - b.positionSum;
            }
            return a.issues - b.issues;
        });

        ranking.forEach((item, index) => {
            item.rank = index + 1;
        });

        const winners = Object.entries(config.roundWins)
            .sort(([, a], [, b]) => b - a);

        let winnerTeamName = null;
        let winnerTeamId = null;
        let isDraw = false;

        if (winners.length === 0) {
            isDraw = true;
        } else {
            const maxWins = winners[0][1];
            const topWinners = winners.filter(([, wins]) => wins === maxWins);

            if (topWinners.length > 1) {
                isDraw = true;
            } else {
                winnerTeamId = parseInt(topWinners[0][0]);
                const winningTeam = config.teams.find(t => t.id === winnerTeamId);
                if (winningTeam) {
                    winnerTeamName = winningTeam.name;
                }
            }
        }

        let summaryData = {
            winner: winnerTeamName,
            winnerTeam: winnerTeamName,
            totalRounds: config.gameSettings.numRounds,
            isDraw: isDraw,
            isCleanMode: isCleanMode,
            ranking: ranking
        };

        if (!isDraw && currentMatchId && winnerTeamId) {
            await updateMatchWithWinner(currentMatchId, winnerTeamId);
        }

        matchProcessPopup.hide();
        await new Promise(resolve => setTimeout(resolve, 500));
        finalSummaryPopup.show(summaryData);

        await clearAIUnits();

        config.currentRound = 1;
        config.roundHistory = [];
        config.roundWins = {};
        config.teamPositions = {};

        await saveRoundData({
            currentRound: config.currentRound,
            roundHistory: config.roundHistory,
            roundWins: config.roundWins,
            teamPositions: config.teamPositions
        }, currentMatchId);

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
        const config = await loadConfig(currentMatchId);
        if (!config) return;

        cleanupRound();

        await saveRoundData({
            currentRound: config.currentRound,
            roundHistory: config.roundHistory,
            roundWins: config.roundWins,
            teamPositions: config.teamPositions || {}
        }, currentMatchId);

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
        const config = await loadConfig(currentMatchId);
        if (!config) return;

        cleanupRound();

        await clearAIUnits();

        gameState.clearGameErrors();

        config.currentRound = 1;
        config.roundHistory = [];
        config.roundWins = {};
        config.teamPositions = {};
        
        clearValidationCache();
        currentMatchId = null;
        window.currentMatchId = null;

        await saveRoundData({
            currentRound: config.currentRound,
            roundHistory: config.roundHistory,
            roundWins: config.roundWins,
            teamPositions: config.teamPositions
        }, currentMatchId);

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

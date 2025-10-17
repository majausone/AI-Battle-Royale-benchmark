import tabManager from './tabs-manager.js';
import { spawnUnit } from './characters.js';
import { drawPixelArt } from './render.js';
import * as gameState from './gameState.js';
import { getUnitData, initializeUnits } from './unitLoader.js';
import { restartGame, togglePause } from './gameManager.js';
import { setVolume } from './audio.js';
import { UnitsPopup } from './units-popup.js';
import { SkillsPopup } from './skills-popup.js';
import { unitTooltip } from './tooltip-code.js';
import { requestUnitsForTeams, requestUnitsForSpecificAI } from './aiRequestUnits.js';
import { adaptUnitPrices, setSimplePriceMode } from './aiPrices.js';
import { buyUnitsForTeams, setSimpleBuyMode } from './aiBuy.js';
import { handleRoundEnd, startNextRound, initializeNewGame, executeFullRound } from './roundControl.js';
import { onRequestStatus, initSocket } from './socketManager.js';
import { matchProcessPopup } from './matchProcessPopup.js';
import { testerPopup } from './tester-popup.js';

export let testMode = false;

export class RoundTab {
    constructor() {
        this.title = 'Game';
        this.element = document.getElementById('round-tab');
        this.config = null;
        this.unitsPopup = new UnitsPopup();
        this.skillsPopup = new SkillsPopup();
        this.currentMatchId = null;
        this.serviceCache = null;
        this.popupButton = null;

        window.addEventListener('gameSettingsUpdated', (e) => {
            this.config = e.detail;
            this.serviceCache = null;
            this.renderTeams();
            this.updateRoundInfo();
        });
        
        window.addEventListener('roundEnded', async () => {
            await this.loadConfig();
            this.updateRoundInfo();
        });
        
        window.addEventListener('roundStarted', async () => {
            await this.loadConfig();
            this.updateRoundInfo();
        });
        
        window.addEventListener('gameInitialized', async () => {
            await this.loadConfig();
            this.updateRoundInfo();
        });
        
        window.addEventListener('unitsUpdated', async () => {
            await this.loadConfig();
            this.renderTeams();
        });

        window.addEventListener('matchCreated', (e) => {
            this.currentMatchId = e.detail.matchId;
            this.updateRoundInfo();
        });

        window.addEventListener('matchPopupVisibilityChange', (e) => {
            if (this.popupButton) {
                this.popupButton.disabled = !e.detail.canReopen;
            }
        });
    }

    updateRoundInfo() {
        if (!this.config) return;

        const roundInfo = this.element.querySelector('.round-info');
        if (!roundInfo) return;

        let infoHtml = '<div class="round-info-header">';
        
        if (this.currentMatchId) {
            infoHtml += `<div class="match-id">Match #${this.currentMatchId}</div>`;
        }
        
        infoHtml += `<h3>Round ${this.config.currentRound}/${this.config.gameSettings.numRounds}</h3>`;
        infoHtml += '</div>';
        infoHtml += '<div class="team-victories">';
        
        const availableTeams = this.config.teams.filter(team => team.isAvailable !== false);
        
        availableTeams.forEach(team => {
            const wins = this.config.roundWins?.[team.id] || 0;
            infoHtml += `
                <div class="team-victory-info">
                    <div class="team-color" style="background-color: ${team.color}"></div>
                    <span class="team-name">${team.name}</span>
                    <span class="victory-count">Victories: ${wins}</span>
                </div>
            `;
        });
        
        infoHtml += '</div>';
        roundInfo.innerHTML = infoHtml;
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/config2');
            this.config = await response.json();
            this.serviceCache = null;
            
            if (this.config) {
                if (this.config.display) {
                    setVolume(this.config.display.volume / 100);
                }
                this.renderTeams();
                this.updateRoundInfo();
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }
    }

    async loadServicesCache() {
        if (this.serviceCache !== null) return;
        
        try {
            const response = await fetch('/api/config2');
            const config = await response.json();
            if (config && config.aiServices) {
                this.serviceCache = {};
                config.aiServices.forEach(service => {
                    this.serviceCache[service.service_id] = service.name || service.type;
                });
            }
        } catch (error) {
            console.error('Error loading services cache:', error);
            this.serviceCache = {};
        }
    }

    async init() {
        this.element.innerHTML = `
            <div class="test-mode-checkbox">
                <input type="checkbox" id="test-mode-checkbox">
                <label for="test-mode-checkbox">Test Mode</label>
                <button id="db-test-button" class="db-test-button">Tester</button>
                <button id="popup-button" class="popup-button" disabled>Popup</button>
            </div>
            <div class="control-buttons">
                <button id="requestAllUnits"><i class="fas fa-sync"></i>Request Units</button>
                <button id="adaptPrices"><i class="fas fa-dollar-sign"></i>Adapt Prices</button>
                <button id="buyUnits"><i class="fas fa-shopping-cart"></i>Buy Units</button>
                <button id="testRound"><i class="fas fa-vial"></i>Test Round</button>
                <button id="startMatch"><i class="fas fa-forward"></i>Start Match</button>
                <button id="reMatch"><i class="fas fa-redo-alt"></i>Re Match</button>
                <button id="pauseButton"><i class="fas fa-pause"></i>Pause</button>
                <button id="restartButton"><i class="fas fa-redo"></i>Restart</button>
                <button id="skillsButton"><i class="fas fa-star"></i>Skills</button>
            </div>
            <div class="round-info">
                <div class="round-info-header">
                    <h3>Round 1/3</h3>
                </div>
                <div class="team-victories"></div>
            </div>
            <div class="teams-container" id="game-teams-container">
            </div>
        `;

        await this.setupEventListeners();
        await this.loadConfig();
        await this.loadServicesCache();
    }

    spawnUnits(teams) {
        teams.forEach(team => {
            if (team.isAvailable === false) return;
            team.ais.forEach(ai => {
                this.spawnAiUnits(ai, team.id);
            });
        });
    }

    spawnAiUnits(ai, teamId) {
        if (ai.purchasedUnits) {
            ai.purchasedUnits.forEach(purchasedUnit => {
                for (let i = 0; i < purchasedUnit.quantity; i++) {
                    spawnUnit(purchasedUnit.id, teamId, ai.id);
                }
            });
        }
    }

    initializeTeams() {
        if (this.config && this.config.teams) {
            const availableTeams = this.config.teams.filter(team => team.isAvailable !== false);
            availableTeams.forEach(team => {
                gameState.initTeam(team.id, team);
            });
        }
    }

    async getServiceName(serviceId) {
        if (!serviceId) return 'Not Selected';
        
        await this.loadServicesCache();
        
        if (this.serviceCache && this.serviceCache[serviceId]) {
            return this.serviceCache[serviceId];
        }
        
        if (this.config && this.config.aiServices) {
            const service = this.config.aiServices.find(s => s.service_id === serviceId);
            if (service) {
                if (!this.serviceCache) this.serviceCache = {};
                this.serviceCache[serviceId] = service.name || service.type;
                return this.serviceCache[serviceId];
            }
        }
        
        try {
            const response = await fetch('/api/config2');
            const config = await response.json();
            if (config && config.aiServices) {
                const service = config.aiServices.find(s => s.service_id === serviceId);
                if (service) {
                    if (!this.serviceCache) this.serviceCache = {};
                    this.serviceCache[serviceId] = service.name || service.type;
                    return this.serviceCache[serviceId];
                }
            }
        } catch (error) {
            console.error('Error finding service name:', error);
        }
        
        return 'Unknown Service';
    }

    async renderTeams() {
        const container = this.element.querySelector('#game-teams-container');
        if (!container || !this.config || !this.config.teams) return;

        await this.loadServicesCache();
        container.innerHTML = '';

        const availableTeams = this.config.teams.filter(team => team.isAvailable !== false);
        
        for (const team of availableTeams) {
            const teamSection = document.createElement('div');
            teamSection.className = 'team-section';
            teamSection.innerHTML = `
                <div class="team-header-game">
                    <h3>${team.name}</h3>
                    <div class="team-color" style="background-color: ${team.color || '#4CAF50'}"></div>
                </div>
            `;

            for (const ai of team.ais) {
                const aiSection = document.createElement('div');
                aiSection.className = 'ai-section';
                
                const serviceName = this.serviceCache && this.serviceCache[ai.service_id] 
                    ? this.serviceCache[ai.service_id] 
                    : await this.getServiceName(ai.service_id);

                let unitsHtml = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h4>AI Service: ${serviceName}</h4>
                        <button class="manage-units-btn">Units</button>
                    </div>
                    <div class="units-grid">`;

                if (ai.purchasedUnits && ai.purchasedUnits.length > 0) {
                    ai.purchasedUnits.forEach(purchasedUnit => {
                        const unitData = getUnitData(purchasedUnit.id);
                        if (unitData) {
                            unitsHtml += `
                                <div class="unit-button game" data-unit="${purchasedUnit.id}">
                                    <div class="unit-preview"></div>
                                    <div class="unit-info-left">
                                        <span class="unit-name">${unitData.name}</span>
                                    </div>
                                    <div class="unit-info-right">
                                        <span class="price">$${unitData.cost}</span>
                                        <button class="info-button">?</button>
                                    </div>
                                    <span class="unit-quantity">x${purchasedUnit.quantity}</span>
                                </div>`;
                        }
                    });
                }

                unitsHtml += `</div>
                    <div class="ai-buttons">
                        <button class="request-units">Request Units</button>
                        <button class="test-units">Test Units</button>
                    </div>`;

                aiSection.innerHTML = unitsHtml;

                const manageUnitsBtn = aiSection.querySelector('.manage-units-btn');
                manageUnitsBtn.addEventListener('click', () => {
                    this.unitsPopup.show(ai, this.config, async (result) => {
                        ai.purchasedUnits = result.purchasedUnits;
                        ai.availableUnits = result.availableUnits;

                        try {
                            await fetch('/api/config2/teams', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(this.config.teams)
                            });
                            this.renderTeams();
                        } catch (error) {
                            console.error('Error updating AI units:', error);
                        }
                    });
                });

                const requestUnitsBtn = aiSection.querySelector('.request-units');
                requestUnitsBtn.addEventListener('click', () => {
                    requestUnitsForSpecificAI(this.currentMatchId, team.id, ai.id);
                });

                const testUnitsBtn = aiSection.querySelector('.test-units');
                testUnitsBtn.addEventListener('click', () => {
                    if (!gameState.isInitialized) {
                        gameState.initGame();
                        this.initializeTeams();
                    }
                    if (!gameState.isPaused) {
                        this.spawnAiUnits(ai, team.id);
                    }
                });

                teamSection.appendChild(aiSection);
            }

            container.appendChild(teamSection);
        }

        this.setupUnitButtons();
        this.renderUnitPreviews();
    }

    async setupEventListeners() {
        const testRound = this.element.querySelector('#testRound');
        const pauseButton = this.element.querySelector('#pauseButton');
        const restartButton = this.element.querySelector('#restartButton');
        const skillsButton = this.element.querySelector('#skillsButton');
        const requestAllUnits = this.element.querySelector('#requestAllUnits');
        const adaptPrices = this.element.querySelector('#adaptPrices');
        const buyUnits = this.element.querySelector('#buyUnits');
        const startMatch = this.element.querySelector('#startMatch');
        const reMatch = this.element.querySelector('#reMatch');
        const testModeCheckbox = this.element.querySelector('#test-mode-checkbox');
        const dbTestButton = this.element.querySelector('#db-test-button');
        this.popupButton = this.element.querySelector('#popup-button');

        testModeCheckbox.addEventListener('change', (e) => {
            testMode = e.target.checked;
        });

        if (dbTestButton) {
            dbTestButton.addEventListener('click', () => {
                testerPopup.show();
            });
        }

        if (this.popupButton) {
            this.popupButton.addEventListener('click', () => {
                matchProcessPopup.reopen();
            });
        }

        testRound.addEventListener('click', () => {
            restartGame();
            gameState.initGame();
            this.initializeTeams();
            if (!gameState.isPaused && this.config && this.config.teams) {
                const availableTeams = this.config.teams.filter(team => team.isAvailable !== false);
                this.spawnUnits(availableTeams);
            }
        });

        restartButton.addEventListener('click', () => {
            restartGame();
            initializeNewGame();
        });

        pauseButton.addEventListener('click', togglePause);

        skillsButton.addEventListener('click', () => {
            this.skillsPopup.show();
        });

        requestAllUnits.addEventListener('click', () => requestUnitsForTeams(this.currentMatchId));
        
        adaptPrices.addEventListener('click', async () => {
            setSimplePriceMode(true);
            await adaptUnitPrices();
            setSimplePriceMode(false);
        });
        
        buyUnits.addEventListener('click', async () => {
            setSimpleBuyMode(true);
            await buyUnitsForTeams();
            setSimpleBuyMode(false);
        });

        startMatch.addEventListener('click', async () => {
            matchProcessPopup.show(null, null, null);
            
            initSocket();
            
            try {
                const response = await fetch('/api/matches/create', {
                    method: 'POST'
                });

                if (!response.ok) {
                    throw new Error(`Error creating match: ${response.status}`);
                }

                const data = await response.json();
                if (!data.success || !data.matchId) {
                    throw new Error('Invalid response from server when creating match');
                }
                
                this.currentMatchId = data.matchId;
                window.dispatchEvent(new CustomEvent('matchCreated', {
                    detail: { matchId: data.matchId }
                }));
                
                await this.loadConfig();
                
                if (this.config && this.config.teams && this.config.teams.length > 0) {
                    const availableTeams = this.config.teams.filter(team => team.isAvailable !== false);
                    const teamIds = availableTeams.map(team => team.id);
                    try {
                        await fetch('/api/round-wins/ensure', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                match_id: this.currentMatchId,
                                team_ids: teamIds
                            })
                        });
                    } catch (error) {
                        console.error('Error ensuring round wins:', error);
                    }
                }

                window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                    detail: { type: 'start', process: 'requestUnits' }
                }));

                await new Promise((resolve) => {
                    const unsubscribe = onRequestStatus((data) => {
                        if (data.status === 'completed') {
                            unsubscribe();
                            resolve();
                        }
                    });
                    requestUnitsForTeams(this.currentMatchId);
                });

                window.dispatchEvent(new CustomEvent('matchProcessUpdate', {
                    detail: { type: 'complete', process: 'requestUnits', success: true }
                }));

                await initializeUnits();
                await this.loadConfig();
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
                await this.loadConfig();
                await new Promise(resolve => setTimeout(resolve, 500));
                
                executeFullRound(gameState, () => this.initializeTeams(), (teams) => this.spawnUnits(teams), false, this.currentMatchId);
                
            } catch (error) {
                console.error('Error in startMatch:', error);
                matchProcessPopup.hide();
            }
        });
        
        reMatch.addEventListener('click', async () => {
            matchProcessPopup.show(null, null, null);
            
            initSocket();
            
            try {
                const response = await fetch('/api/matches/create', {
                    method: 'POST'
                });

                if (!response.ok) {
                    throw new Error(`Error creating match: ${response.status}`);
                }

                const data = await response.json();
                if (!data.success || !data.matchId) {
                    throw new Error('Invalid response from server when creating match');
                }
                
                this.currentMatchId = data.matchId;
                window.dispatchEvent(new CustomEvent('matchCreated', {
                    detail: { matchId: data.matchId }
                }));
                
                await this.loadConfig();
                
                if (this.config && this.config.teams && this.config.teams.length > 0) {
                    const availableTeams = this.config.teams.filter(team => team.isAvailable !== false);
                    const teamIds = availableTeams.map(team => team.id);
                    try {
                        await fetch('/api/round-wins/ensure', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                match_id: this.currentMatchId,
                                team_ids: teamIds
                            })
                        });
                    } catch (error) {
                        console.error('Error ensuring round wins:', error);
                    }
                }
                
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
                await this.loadConfig();
                await new Promise(resolve => setTimeout(resolve, 500));
                
                executeFullRound(gameState, () => this.initializeTeams(), (teams) => this.spawnUnits(teams), false, this.currentMatchId);
                
            } catch (error) {
                console.error('Error in reMatch:', error);
                matchProcessPopup.hide();
            }
        });
    }

    async renderUnitPreviews() {
        const unitButtons = this.element.querySelectorAll('.unit-button');
        for (const button of unitButtons) {
            const unitId = button.dataset.unit;
            const unitData = getUnitData(unitId);
            if (!unitData || !unitData.graphics) {
                continue;
            }

            const preview = button.querySelector('.unit-preview');
            preview.innerHTML = '';

            const canvas = document.createElement('canvas');
            const scale = 3;
            canvas.width = unitData.graphics[0].length * scale;
            canvas.height = unitData.graphics.length * scale;

            const ctx = canvas.getContext('2d');
            unitData.graphics.forEach((row, y) => {
                row.forEach((color, x) => {
                    if (color) {
                        ctx.fillStyle = color;
                        ctx.fillRect(x * scale, y * scale, scale, scale);
                    }
                });
            });

            preview.appendChild(canvas);
        }
    }

    setupUnitButtons() {
        const unitButtons = this.element.querySelectorAll('.unit-button');
        unitButtons.forEach(button => {
            const unitId = button.dataset.unit;
            const teamSection = button.closest('.team-section');
            const aiSection = button.closest('.ai-section');
            const availableTeams = this.config.teams.filter(team => team.isAvailable !== false);
            const teamIndex = Array.from(availableTeams).findIndex(t => t.name === teamSection.querySelector('h3').textContent);
            const team = availableTeams[teamIndex];
            const ai = team.ais[Array.from(teamSection.querySelectorAll('.ai-section')).indexOf(aiSection)];

            button.addEventListener('click', () => {
                if (!gameState.isInitialized) {
                    gameState.initGame();
                    this.initializeTeams();
                }
                if (!gameState.isPaused) {
                    spawnUnit(unitId, team.id, ai.id);
                }
            });

            const infoButton = button.querySelector('.info-button');
            infoButton.addEventListener('mouseenter', (e) => {
                e.stopPropagation();
                const unitData = getUnitData(unitId);
                if (unitData) {
                    unitTooltip.show(e, unitData);
                }
            });

            infoButton.addEventListener('mouseleave', (e) => {
                e.stopPropagation();
                unitTooltip.hide();
            });
        });
    }

    async onShow() {
        await this.loadConfig();
        await this.loadServicesCache();
        await this.renderTeams();
    }

    onHide() {
        unitTooltip.hide();
    }
}

const roundTab = new RoundTab();
tabManager.registerTab('round-tab', roundTab);

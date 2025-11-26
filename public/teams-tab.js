import tabManager from './tabs-manager.js';
import { popupManager } from './popup-manager.js';

export class TeamsTab {
    constructor() {
        this.title = 'Teams';
        this.element = document.getElementById('teams-tab');
        this.aiServices = [];
        this.init();
    }

    init() {
        this.element.innerHTML = `
            <div class="teams-config">
                <div class="game-settings">
                    <h3>Game Settings</h3>
                    <div class="setting-groups">
                        <div class="setting-group">
                            <label>Initial Gold</label>
                            <input type="number" id="initial-gold" value="1000" min="0" step="100">
                        </div>
                        <div class="setting-group">
                            <label>Number of Rounds</label>
                            <input type="number" id="num-rounds" value="3" min="1">
                        </div>
                        <div class="setting-group">
                            <label>Units Number</label>
                            <input type="number" id="units-number" value="3" min="1">
                        </div>
                        <div class="setting-group">
                            <label>Prompt</label>
                            <select id="prompt-mode">
                                <option value="normal" selected>Normal</option>
                                <option value="crazy">Loco</option>
                                <option value="boss">Boss</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="teams-list" id="teams-list">
                    <h3>Teams Configuration</h3>
                    <div id="teams-container"></div>
                    <button id="add-team-btn">Add Team</button>
                </div>
            </div>
        `;

        this.setupEventListeners();
    }

    setupEventListeners() {
        const addTeamBtn = this.element.querySelector('#add-team-btn');
        addTeamBtn.addEventListener('click', () => this.handleAddTeam());

        const inputs = this.element.querySelectorAll('.game-settings input, .game-settings select');
        inputs.forEach(input => {
            input.addEventListener('change', () => this.updateGameSettings());
        });

        window.addEventListener('gameSettingsUpdated', async () => {
            await this.loadAIServices();
            await this.renderTeams();
        });
    }

    async loadAIServices() {
        try {
            const config = await this.loadConfig();
            if (config.aiServices) {
                this.aiServices = config.aiServices.filter(service => service.isActive);
            }
        } catch (error) {
            this.aiServices = [];
        }
    }

    async handleAddTeam() {
        try {
            const config = await this.loadConfig();
            const maxId = config.teams.reduce((max, team) => Math.max(max, team.id || 0), 0);
            
            const newTeam = {
                name: `Team ${maxId + 1}`,
                color: '#4CAF50',
                isAvailable: true,
                ais: []
            };
            
            const response = await fetch('/api/config2/teams/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTeam)
            });
            
            const result = await response.json();
            
            if (result.success) {
                config.teams.push({
                    id: result.team.id,
                    name: result.team.name,
                    color: result.team.color,
                    isAvailable: true,
                    ais: []
                });
                
                window.dispatchEvent(new CustomEvent('gameSettingsUpdated', { detail: config }));
            } else if (result.error) {
                await popupManager.showError(result.error);
            }
        } catch (error) {
            console.error("Error al añadir equipo:", error);
            await popupManager.showError("Error al añadir el equipo.");
        }
    }

    async handleRemoveTeam(teamId) {
        try {
            const response = await fetch(`/api/config2/teams/${teamId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                const config = await this.loadConfig();
                config.teams = config.teams.filter(team => team.id !== teamId);
                window.dispatchEvent(new CustomEvent('gameSettingsUpdated', { detail: config }));
            } else if (result.error) {
                await popupManager.showError(result.error);
            }
        } catch (error) {
            console.error("Error al eliminar el equipo:", error);
            await popupManager.showError("No se pudo eliminar el equipo. Asegúrate de que no tenga unidades compradas.");
        }
    }

    async handleAddAI(teamId) {
        const config = await this.loadConfig();
        const team = config.teams.find(t => t.id === teamId);
        if (team) {
            const maxAiId = config.teams.reduce((max, t) => {
                const aiMax = t.ais.reduce((aiMax, ai) => Math.max(aiMax, ai.id || 0), 0);
                return Math.max(max, aiMax);
            }, 0);

            if (!this.aiServices || this.aiServices.length === 0) {
                await this.loadAIServices();
            }

            let defaultServiceId = '';
            
            if (this.aiServices && this.aiServices.length > 0) {
                const activeService = this.aiServices.find(s => s.isActive);
                defaultServiceId = activeService ? activeService.service_id : this.aiServices[0].service_id;
            } 
            else if (config.aiServices && config.aiServices.length > 0) {
                const activeService = config.aiServices.find(s => s.isActive);
                defaultServiceId = activeService ? activeService.service_id : config.aiServices[0].service_id;
            }
            
            if (!defaultServiceId) {
                const defaultService = config.aiServices.find(s => s.type === 'claude');
                defaultServiceId = defaultService ? defaultService.service_id : config.aiServices[0].service_id;
            }

            const newAiId = maxAiId + 1;
            
            team.ais.push({
                id: newAiId,
                service_id: defaultServiceId,
                purchasedUnits: [],
                availableUnits: ['kewoBasico', 'kewoArco'],
                originalAiId: Date.now()
            });

            try {
                await this.updateTeam(team);
                await this.renderTeams();
            } catch (error) {
                console.error('Error adding AI:', error);
                team.ais.pop();
                await popupManager.showError("Error al añadir IA: Verifica que existan servicios configurados.");
            }
        }
    }

    async handleRemoveAI(teamId, aiId) {
        const config = await this.loadConfig();
        const team = config.teams.find(t => t.id === teamId);
        if (team) {
            team.ais = team.ais.filter(ai => ai.id !== aiId);
            await this.updateTeam(team);
            await this.renderTeams();
        }
    }

    async handleUpdateAIService(teamId, aiId, newServiceId) {
        const config = await this.loadConfig();
        const team = config.teams.find(t => t.id === teamId);
        if (team) {
            const ai = team.ais.find(ai => ai.id === aiId);
            if (ai) {
                ai.service_id = newServiceId;
                await this.updateTeam(team);
                await this.renderTeams();
            }
        }
    }

    async handleUpdateTeamName(teamId, newName) {
        try {
            const config = await this.loadConfig();
            const team = config.teams.find(t => t.id === teamId);
            if (team) {
                const updatedTeam = { ...team, name: newName };
                const response = await fetch(`/api/config2/teams/${teamId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedTeam)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    team.name = newName;
                    window.dispatchEvent(new CustomEvent('gameSettingsUpdated', { detail: config }));
                } else if (result.error) {
                    await popupManager.showWarning(result.error);
                    await this.renderTeams();
                }
            }
        } catch (error) {
            console.error('Error updating team name:', error);
            await popupManager.showError(`Error al actualizar el nombre del equipo: ${error.message}`);
        }
    }

    async handleUpdateTeamColor(teamId, newColor) {
        try {
            const config = await this.loadConfig();
            const team = config.teams.find(t => t.id === teamId);
            if (team) {
                const updatedTeam = { ...team, color: newColor };
                const response = await fetch(`/api/config2/teams/${teamId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedTeam)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    team.color = newColor;
                    window.dispatchEvent(new CustomEvent('gameSettingsUpdated', { detail: config }));
                } else if (result.error) {
                    await popupManager.showWarning(result.error);
                    await this.renderTeams();
                }
            }
        } catch (error) {
            console.error('Error updating team color:', error);
            await popupManager.showError(`Error al actualizar el color del equipo: ${error.message}`);
        }
    }
    
    async handleUpdateTeamAvailability(teamId, isAvailable) {
        try {
            const config = await this.loadConfig();
            const team = config.teams.find(t => t.id === teamId);
            if (team) {
                team.isAvailable = isAvailable;
                const response = await fetch(`/api/config2/teams/${teamId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        isAvailable: isAvailable,
                        ais: team.ais
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    window.dispatchEvent(new CustomEvent('gameSettingsUpdated', { detail: config }));
                } else if (result.error) {
                    await popupManager.showWarning(result.error);
                    await this.renderTeams();
                }
            }
        } catch (error) {
            console.error('Error updating team availability:', error);
            await popupManager.showError(`Error al actualizar disponibilidad: ${error.message}`);
        }
    }

    async updateTeam(team) {
        try {
            const response = await fetch(`/api/config2/teams/${team.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(team)
            });
            
            const result = await response.json();
            
            if (result.success) {
                const config = await this.loadConfig();
                const index = config.teams.findIndex(t => t.id === team.id);
                if (index !== -1) {
                    config.teams[index] = team;
                }
                window.dispatchEvent(new CustomEvent('gameSettingsUpdated', { detail: config }));
                return true;
            } else if (result.error) {
                await popupManager.showWarning(result.error);
                return false;
            }
        } catch (error) {
            console.error('Error updating team:', error);
            await popupManager.showError(`Error al actualizar el equipo: ${error.message}`);
            return false;
        }
    }

    generateServiceOptions(selectedServiceId) {
        let options = '<option value="">Select AI Service</option>';

        if (this.aiServices && this.aiServices.length > 0) {
            this.aiServices.forEach(service => {
                options += `<option value="${service.service_id}" ${selectedServiceId === service.service_id ? 'selected' : ''}>${service.name}</option>`;
            });
        } else {
            options += `
                <option value="claude" ${selectedServiceId === 'claude' ? 'selected' : ''}>Claude</option>
                <option value="chatgpt" ${selectedServiceId === 'chatgpt' ? 'selected' : ''}>GPT-4</option>
                <option value="deepseek" ${selectedServiceId === 'deepseek' ? 'selected' : ''}>DeepSeek</option>
                <option value="custom" ${selectedServiceId === 'custom' ? 'selected' : ''}>Custom</option>
            `;
        }

        return options;
    }

    async renderTeams() {
        const config = await this.loadConfig();
        const container = this.element.querySelector('#teams-container');
        container.innerHTML = '';

        config.teams.forEach(team => {
            const teamElement = document.createElement('div');
            teamElement.className = 'team-config';
            teamElement.dataset.teamId = team.id;

            teamElement.innerHTML = `
                <div class="team-header">
                    <div class="team-name-container">
                        <input type="text" class="team-name-input" value="${team.name}" data-team-id="${team.id}">
                        <input type="color" class="team-color-input" value="${team.color || '#4CAF50'}" data-team-id="${team.id}">
                    </div>
                    <div class="team-available-container">
                        <input type="checkbox" class="team-available-checkbox" 
                               data-team-id="${team.id}" 
                               ${team.isAvailable !== false ? 'checked' : ''}>
                        <label>Available</label>
                    </div>
                    <button class="remove-team" data-team-id="${team.id}">×</button>
                </div>
                <div class="ai-list">
                    <div class="ai-container">
                        ${team.ais.map(ai => `
                            <div class="ai-config" data-ai-id="${ai.id}" data-team-id="${team.id}">
                                <select class="ai-service" data-ai-id="${ai.id}" data-team-id="${team.id}">
                                    ${this.generateServiceOptions(ai.service_id)}
                                </select>
                                <button class="remove-ai" data-ai-id="${ai.id}" data-team-id="${team.id}">×</button>
                            </div>
                        `).join('')}
                    </div>
                    <button class="add-ai" data-team-id="${team.id}">Add AI</button>
                </div>
            `;

            container.appendChild(teamElement);
        });

        this.attachEventListeners();
    }

    attachEventListeners() {
        const container = this.element.querySelector('#teams-container');
        
        const teamNameInputs = container.querySelectorAll('.team-name-input');
        teamNameInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const teamId = parseInt(e.target.dataset.teamId);
                this.handleUpdateTeamName(teamId, e.target.value);
            });
        });
        
        const teamColorInputs = container.querySelectorAll('.team-color-input');
        teamColorInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const teamId = parseInt(e.target.dataset.teamId);
                this.handleUpdateTeamColor(teamId, e.target.value);
            });
        });
        
        const availableCheckboxes = container.querySelectorAll('.team-available-checkbox');
        availableCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const teamId = parseInt(e.target.dataset.teamId);
                this.handleUpdateTeamAvailability(teamId, e.target.checked);
            });
        });
        
        const removeTeamButtons = container.querySelectorAll('.remove-team');
        removeTeamButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const teamId = parseInt(e.target.dataset.teamId);
                this.handleRemoveTeam(teamId);
            });
        });
        
        const addAiButtons = container.querySelectorAll('.add-ai');
        addAiButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const teamId = parseInt(e.target.dataset.teamId);
                this.handleAddAI(teamId);
            });
        });
        
        const removeAiButtons = container.querySelectorAll('.remove-ai');
        removeAiButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const teamId = parseInt(e.target.dataset.teamId);
                const aiId = parseInt(e.target.dataset.aiId);
                this.handleRemoveAI(teamId, aiId);
            });
        });
        
        const aiServiceSelects = container.querySelectorAll('.ai-service');
        aiServiceSelects.forEach(select => {
            select.addEventListener('change', (e) => {
                const teamId = parseInt(e.target.dataset.teamId);
                const aiId = parseInt(e.target.dataset.aiId);
                this.handleUpdateAIService(teamId, aiId, e.target.value);
            });
        });
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/config2');
            const config = await response.json();

            if (!config.gameSettings) {
                config.gameSettings = {};
            }

            if (config.gameSettings.unitsNumber === undefined) {
                config.gameSettings.unitsNumber = 3;
            }

            const validPromptModes = ['normal', 'crazy', 'boss'];
            const storedPromptMode = (config.gameSettings.promptMode || '').toLowerCase();
            if (!validPromptModes.includes(storedPromptMode)) {
                config.gameSettings.promptMode = 'normal';
            } else {
                config.gameSettings.promptMode = storedPromptMode;
            }

            if (!config.teams) config.teams = [];
            config.teams.forEach(team => {
                if (!team.ais) team.ais = [];
                if (!team.color) team.color = '#4CAF50';
                team.ais.forEach(ai => {
                    if (!ai.purchasedUnits) ai.purchasedUnits = [];
                    if (!ai.availableUnits) ai.availableUnits = ['kewoBasico', 'kewoArco'];
                    if (!ai.originalAiId) ai.originalAiId = Date.now();
                });
            });

            return config;
        } catch (error) {
            return { teams: [], gameSettings: {} };
        }
    }

    async updateGameSettings() {
        const config = await this.loadConfig();

        const unitsNumberValue = parseInt(this.element.querySelector('#units-number').value);
        const promptMode = this.element.querySelector('#prompt-mode').value || config.gameSettings.promptMode || 'normal';

        config.gameSettings = {
            initialGold: parseInt(this.element.querySelector('#initial-gold').value),
            numRounds: parseInt(this.element.querySelector('#num-rounds').value),
            unitsNumber: Number.isNaN(unitsNumberValue) ? config.gameSettings.unitsNumber : unitsNumberValue,
            promptMode
        };

        await this.saveConfig(config);
    }

    async saveConfig(config) {
        try {
            await fetch('/api/config2/game-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config.gameSettings)
            });
            
            window.dispatchEvent(new CustomEvent('gameSettingsUpdated', { detail: config }));
            return true;
        } catch (error) {
            console.error('Error saving config:', error);
            return false;
        }
    }

    async onShow() {
        const config = await this.loadConfig();

        if (config.gameSettings) {
            this.element.querySelector('#initial-gold').value = config.gameSettings.initialGold;
            this.element.querySelector('#num-rounds').value = config.gameSettings.numRounds;
            this.element.querySelector('#units-number').value = config.gameSettings.unitsNumber;
            this.element.querySelector('#prompt-mode').value = config.gameSettings.promptMode || 'normal';
        }

        await this.loadAIServices();
        await this.renderTeams();
    }

    onHide() { }
}

const teamsTab = new TeamsTab();
tabManager.registerTab('teams-tab', teamsTab);

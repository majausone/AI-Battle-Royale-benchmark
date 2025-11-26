import tabManager from './tabs-manager.js';
import { activeErrors } from './gameState.js';

export class ErrorsTab {
    constructor() {
        this.title = 'Errors';
        this.element = document.getElementById('errors-tab');
        this.errors = [];
        this.warnings = [];
        this.selectedAI = 'all';
        this.isActive = false;
        this.ais = [];
    }

    init() {
        this.element.innerHTML = `
            <div class="errors-tab-sidebar">
                <div class="errors-filters">
                    <h4>Filters</h4>
                    <div class="filter-group">
                        <label>AI Service:</label>
                        <select id="ai-service-filter">
                            <option value="all">All AIs</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
        
        this.setupEventListeners();
    }

    async loadAIServices() {
        try {
            const response = await fetch('/api/stats/ais');
            
            if (!response.ok) {
                throw new Error('Error loading AI services');
            }
            
            const aisData = await response.json();
            this.ais = this.processAisData(aisData.ais || []);
            
            const serviceFilter = document.getElementById('ai-service-filter');
            if (serviceFilter) {
                serviceFilter.innerHTML = '<option value="all">All AIs</option>';
                this.ais.forEach(ai => {
                    const option = document.createElement('option');
                    option.value = ai.service_type;
                    option.textContent = `${ai.name} (${ai.service_type})`;
                    serviceFilter.appendChild(option);
                });
            }
            
        } catch (error) {
            console.error('Error loading AI services:', error);
        }
    }

    processAisData(ais) {
        const aisMap = new Map();
        
        ais.forEach(ai => {
            const key = ai.service_type;
            
            if (aisMap.has(key)) {
                const existingAi = aisMap.get(key);
                existingAi.total_matches += ai.total_matches || 0;
                existingAi.wins += ai.wins || 0;
                existingAi.errors += ai.errors || 0;
            } else {
                aisMap.set(key, {
                    name: ai.name,
                    service_type: ai.service_type,
                    total_matches: ai.total_matches || 0,
                    wins: ai.wins || 0,
                    errors: ai.errors || 0
                });
            }
        });
        
        return Array.from(aisMap.values());
    }

    setupEventListeners() {
        const serviceFilter = document.getElementById('ai-service-filter');
        if (serviceFilter) {
            serviceFilter.addEventListener('change', (e) => {
                this.selectedAI = e.target.value;
                this.renderErrors();
            });
        }

        window.addEventListener('errorAdded', (e) => {
            this.renderErrors();
        });

        window.addEventListener('errorsCleared', () => {
            this.renderErrors();
        });
    }

    getFilteredErrors() {
        if (this.selectedAI === 'all') {
            return activeErrors;
        }
        return activeErrors.filter(error => 
            error.ai.toLowerCase().includes(this.selectedAI.toLowerCase())
        );
    }

    renderGameAreaErrors() {
        const gameArea = document.getElementById('game-area');
        if (!gameArea) return;
        
        const mainCanvas = gameArea.querySelector('canvas');
        const teamsContainer = document.getElementById('game-teams-container');
        
        if (mainCanvas) mainCanvas.style.display = 'none';
        if (teamsContainer) teamsContainer.style.display = 'none';
        
        let errorsContainer = gameArea.querySelector('#errors-container');
        if (!errorsContainer) {
            errorsContainer = document.createElement('div');
            errorsContainer.id = 'errors-container';
            errorsContainer.className = 'errors-overlay';
            gameArea.appendChild(errorsContainer);
        }
        
        errorsContainer.style.display = 'block';
        
        errorsContainer.innerHTML = `
            <div class="errors-tab-container">
                <div class="errors-header">
                    <h3>Match Errors & Warnings</h3>
                    <div class="error-stats">
                        <div class="error-count">Errors: <span id="error-count">0</span></div>
                        <div class="warning-count">Warnings: <span id="warning-count">0</span></div>
                    </div>
                </div>
                <div class="errors-table-container">
                    <table class="errors-table">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Time</th>
                                <th>File</th>
                                <th>AI</th>
                                <th>Team</th>
                                <th>Message</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody id="errors-table-body">
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderErrors() {
        const errors = this.getFilteredErrors();
        const tbody = document.getElementById('errors-table-body');
        
        if (!tbody) return;
        
        tbody.innerHTML = errors.map(error => {
            const sent = error.sentToData;
            const reason = error.sendReason;
            const statusCell = sent
                ? '<span class="status-badge status-ok">&#10003;</span>'
                : `<span class="status-badge status-fail">${reason || 'Not sent'}</span>`;

            return `
                <tr class="${error.type}-row">
                    <td><span class="${error.type}-badge">${error.type.toUpperCase()}</span></td>
                    <td>${error.time}</td>
                    <td>${error.file}</td>
                    <td>${error.ai}</td>
                    <td>${error.team}</td>
                    <td>${error.message}</td>
                    <td class="status-cell">${statusCell}</td>
                </tr>
            `;
        }).join('');

        const errorCount = errors.filter(e => e.type === 'error').length;
        const warningCount = errors.filter(e => e.type === 'warning').length;
        
        const errorCountElement = document.getElementById('error-count');
        const warningCountElement = document.getElementById('warning-count');
        
        if (errorCountElement) errorCountElement.textContent = errorCount;
        if (warningCountElement) warningCountElement.textContent = warningCount;
    }

    hideGameAreaErrors() {
        const gameArea = document.getElementById('game-area');
        const mainCanvas = gameArea.querySelector('canvas');
        const teamsContainer = document.getElementById('game-teams-container');
        const errorsContainer = gameArea.querySelector('#errors-container');
        
        if (errorsContainer) errorsContainer.style.display = 'none';
        if (mainCanvas) mainCanvas.style.display = 'block';
        if (teamsContainer) teamsContainer.style.display = 'block';
    }

    async onShow() {
        this.isActive = true;
        this.renderGameAreaErrors();
        this.renderErrors();
        await this.loadAIServices();
    }

    onHide() {
        this.isActive = false;
        this.hideGameAreaErrors();
    }
}

const errorsTab = new ErrorsTab();
tabManager.registerTab('errors-tab', errorsTab, true);

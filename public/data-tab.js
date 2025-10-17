import tabManager from './tabs-manager.js';
import { popupManager } from './popup-manager.js';

export class DataTab {
    constructor() {
        this.title = 'Data';
        this.element = document.getElementById('data-tab');
        this.matches = [];
        this.currentPage = 1;
        this.pageSize = 10;
        this.totalMatches = 0;
        this.ais = [];
        this.teams = [];
        this.filtersLoaded = false;
        this.contentRendered = false;
    }

    init() {
        this.element.innerHTML = `
            <div class="data-tab-container">
                <div class="data-header">
                    <h3>Match Data</h3>
                </div>
                <div class="data-filters">
                    <div class="filter-group">
                        <label>Date From:</label>
                        <input type="date" id="date-from-filter">
                    </div>
                    <div class="filter-group">
                        <label>Date To:</label>
                        <input type="date" id="date-to-filter">
                    </div>
                    <div class="filter-group">
                        <label>AI:</label>
                        <select id="ai-filter">
                            <option value="all">All</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Team:</label>
                        <select id="team-filter">
                            <option value="all">All</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <button id="apply-filters-btn">Apply Filters</button>
                        <button id="refresh-data-btn">Refresh Data</button>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        const refreshBtn = document.getElementById('refresh-data-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadMatches(this.getCurrentFilters());
            });
        }

        const applyFiltersBtn = document.getElementById('apply-filters-btn');
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => {
                this.currentPage = 1;
                this.loadMatches(this.getCurrentFilters());
            });
        }
    }

    getCurrentFilters() {
        const dateFrom = document.getElementById('date-from-filter');
        const dateTo = document.getElementById('date-to-filter');
        const aiFilter = document.getElementById('ai-filter');
        const teamFilter = document.getElementById('team-filter');

        return {
            dateFrom: dateFrom ? dateFrom.value : '',
            dateTo: dateTo ? dateTo.value : '',
            aiId: aiFilter ? aiFilter.value : 'all',
            teamId: teamFilter ? teamFilter.value : 'all'
        };
    }

    async loadFilterOptions() {
        try {
            const [aisResponse, teamsResponse] = await Promise.all([
                fetch('/api/stats/ais'),
                fetch('/api/stats/teams')
            ]);

            if (!aisResponse.ok || !teamsResponse.ok) {
                throw new Error('Error loading filter options');
            }

            const aisData = await aisResponse.json();
            const teamsData = await teamsResponse.json();

            this.ais = this.processAisData(aisData.ais || []);
            this.teams = teamsData.teams || [];
            
            const aiSelect = document.getElementById('ai-filter');
            const teamSelect = document.getElementById('team-filter');

            if (aiSelect) {
                aiSelect.innerHTML = '<option value="all">All</option>';
                this.ais.forEach(ai => {
                    const option = document.createElement('option');
                    option.value = ai.service_type;
                    option.textContent = `${ai.name} (${ai.service_type})`;
                    aiSelect.appendChild(option);
                });
            }

            if (teamSelect) {
                teamSelect.innerHTML = '<option value="all">All</option>';
                this.teams.forEach(team => {
                    const option = document.createElement('option');
                    option.value = team.team_id;
                    option.textContent = team.name;
                    teamSelect.appendChild(option);
                });
            }

            this.filtersLoaded = true;
        } catch (error) {
            console.error('Error loading filter options:', error);
            this.filtersLoaded = false;
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

    async loadMatches(filters = {}) {
        try {
            const tableLoading = document.getElementById('matches-table-loading');
            if (tableLoading) {
                tableLoading.style.display = 'block';
            }
            
            const tableElement = document.getElementById('matches-table');
            if (tableElement) {
                tableElement.style.display = 'none';
            }
            
            let url = `/api/stats/matches?page=${this.currentPage}&pageSize=${this.pageSize}`;
            
            if (filters.dateFrom) url += `&dateFrom=${encodeURIComponent(filters.dateFrom)}`;
            if (filters.dateTo) url += `&dateTo=${encodeURIComponent(filters.dateTo)}`;
            if (filters.aiId && filters.aiId !== 'all') url += `&aiId=${encodeURIComponent(filters.aiId)}`;
            if (filters.teamId && filters.teamId !== 'all') url += `&teamId=${encodeURIComponent(filters.teamId)}`;

            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Server responded with error: ${response.status}`);
            }
            
            const data = await response.json();
            this.matches = data.matches || [];
            this.totalMatches = data.total || 0;
            
            this.renderMatchesTable();
            
            return {
                matches: this.matches,
                total: this.totalMatches,
                page: this.currentPage,
                pageSize: this.pageSize
            };
        } catch (error) {
            console.error('Error loading matches:', error);
            this.renderErrorState(error.message);
            throw error;
        }
    }

    async loadMatchDetails(matchId) {
        try {
            const response = await fetch(`/api/stats/match/${encodeURIComponent(matchId)}`);
            
            if (!response.ok) {
                throw new Error(`Error loading details: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error loading match details:', error);
            throw error;
        }
    }

    renderGameAreaData() {
        const gameArea = document.getElementById('game-area');
        if (!gameArea) return;
        
        const mainCanvas = gameArea.querySelector('canvas');
        const teamsContainer = document.getElementById('game-teams-container');
        
        if (mainCanvas) mainCanvas.style.display = 'none';
        if (teamsContainer) teamsContainer.style.display = 'none';
        
        let dataContainer = gameArea.querySelector('#data-container');
        if (!dataContainer) {
            dataContainer = document.createElement('div');
            dataContainer.id = 'data-container';
            dataContainer.className = 'data-overlay';
            gameArea.appendChild(dataContainer);
        }
        
        dataContainer.style.display = 'block';
        
        dataContainer.innerHTML = `
            <div class="matches-table-container">
                <h4>Match History</h4>
                <div id="matches-table-loading" class="table-loading">
                    <div class="loading-spinner"></div>
                    <p>Loading data...</p>
                </div>
                <table class="matches-table" id="matches-table" style="display: none;">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Participants</th>
                            <th>Winner</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="matches-table-body">
                    </tbody>
                </table>
                <div id="matches-table-error" class="table-error" style="display: none;">
                    <p class="error-message">Error loading data. Please try again.</p>
                </div>
                <div id="matches-table-empty" class="table-empty" style="display: none;">
                    <p class="empty-message">No matches available.</p>
                </div>
                <div class="pagination">
                    <button id="prev-page-btn" disabled>Previous</button>
                    <span class="current-page">Page 1</span>
                    <button id="next-page-btn">Next</button>
                </div>
            </div>
            <div id="match-details-container" class="match-details-container" style="display: none;">
                <div class="match-details-header">
                    <h4>Match Details</h4>
                    <button id="close-details-btn">Close</button>
                </div>
                <div id="match-details-content" class="match-details-content"></div>
            </div>
        `;
        
        this.contentRendered = true;
        this.setupPaginationListeners();
        
        setTimeout(() => {
            this.loadMatches(this.getCurrentFilters());
        }, 100);
    }

    setupPaginationListeners() {
        const prevBtn = document.getElementById('prev-page-btn');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.loadMatches(this.getCurrentFilters());
                }
            });
        }

        const nextBtn = document.getElementById('next-page-btn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (this.currentPage * this.pageSize < this.totalMatches) {
                    this.currentPage++;
                    this.loadMatches(this.getCurrentFilters());
                }
            });
        }

        const closeBtn = document.getElementById('close-details-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideMatchDetails();
            });
        }
    }

    renderMatchesTable() {
        const loadingElement = document.getElementById('matches-table-loading');
        const tableElement = document.getElementById('matches-table');
        const errorElement = document.getElementById('matches-table-error');
        const emptyElement = document.getElementById('matches-table-empty');
        const tableBody = document.getElementById('matches-table-body');
        
        if (!tableBody) return;
        
        if (loadingElement) loadingElement.style.display = 'none';
        if (errorElement) errorElement.style.display = 'none';
        
        if (this.matches.length === 0) {
            if (tableElement) tableElement.style.display = 'none';
            if (emptyElement) emptyElement.style.display = 'block';
            return;
        }
        
        if (tableElement) tableElement.style.display = 'table';
        if (emptyElement) emptyElement.style.display = 'none';
        
        tableBody.innerHTML = this.matches.map(match => {
            const statusIndicatorClass = match.status === 'completed' ? 'completed' : 'in-progress';
            const date = new Date(match.start_time);
            const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
            const participantsCount = match.participant_count || match.participants?.length || 0;
            
            return `
                <tr>
                    <td>${match.match_id}</td>
                    <td>${formattedDate}</td>
                    <td>
                        <span class="status-indicator ${statusIndicatorClass}"></span>
                        ${match.status === 'completed' ? 'Completed' : 'In progress'}
                    </td>
                    <td>${participantsCount}</td>
                    <td>${match.winner_name || '-'}</td>
                    <td>
                        <button class="view-details-btn" data-match-id="${match.match_id}">View Details</button>
                        <button class="delete-match-btn" data-match-id="${match.match_id}" title="Delete Match">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        document.querySelectorAll('.view-details-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const matchId = e.target.dataset.matchId;
                await this.showMatchDetails(matchId);
            });
        });
        
        document.querySelectorAll('.delete-match-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const matchId = e.target.dataset.matchId;
                await this.showDeleteConfirmation(matchId);
            });
        });
        
        this.updatePagination();
    }

    async showDeleteConfirmation(matchId) {
        const result = await popupManager.show({
            title: 'Delete Match',
            message: `Are you sure you want to delete match #${matchId}? This action cannot be undone.`,
            type: 'warning',
            buttons: [
                {
                    text: 'Delete All',
                    type: 'danger',
                    action: () => {
                        popupManager.hide();
                        this.deleteMatch(matchId, true);
                    }
                },
                {
                    text: 'Delete Keeping Files',
                    type: 'warning',
                    action: () => {
                        popupManager.hide();
                        this.deleteMatch(matchId, false);
                    }
                },
                {
                    text: 'Cancel',
                    type: 'primary',
                    action: () => popupManager.hide()
                }
            ]
        });
    }

    async deleteMatch(matchId, deleteFiles) {
        try {
            const url = deleteFiles 
                ? `/api/stats/match/${matchId}/delete` 
                : `/api/stats/match/${matchId}/delete-keep-files`;
            
            const response = await fetch(url, { method: 'DELETE' });
            
            if (!response.ok) {
                throw new Error(`Failed to delete match: ${response.status}`);
            }
            
            await popupManager.show({
                title: 'Success',
                message: `Match #${matchId} has been successfully deleted.`,
                type: 'info',
                buttons: [
                    {
                        text: 'OK',
                        type: 'primary',
                        action: () => popupManager.hide()
                    }
                ]
            });
            
            this.loadMatches(this.getCurrentFilters());
            
        } catch (error) {
            console.error('Error deleting match:', error);
            await popupManager.showError(
                `Error deleting match: ${error.message}`,
                'Error'
            );
        }
    }

    renderErrorState(message) {
        const loadingElement = document.getElementById('matches-table-loading');
        const tableElement = document.getElementById('matches-table');
        const errorElement = document.getElementById('matches-table-error');
        const emptyElement = document.getElementById('matches-table-empty');
        
        if (loadingElement) loadingElement.style.display = 'none';
        if (tableElement) tableElement.style.display = 'none';
        if (emptyElement) emptyElement.style.display = 'none';
        
        if (errorElement) {
            errorElement.style.display = 'block';
            errorElement.querySelector('.error-message').textContent = 
                message || 'Error loading data. Please try again.';
        }
    }

    updatePagination() {
        const prevButton = document.getElementById('prev-page-btn');
        const nextButton = document.getElementById('next-page-btn');
        const currentPageSpan = document.querySelector('.current-page');
        
        if (!prevButton || !nextButton || !currentPageSpan) return;
        
        prevButton.disabled = this.currentPage <= 1;
        nextButton.disabled = this.currentPage * this.pageSize >= this.totalMatches;
        
        currentPageSpan.textContent = `Page ${this.currentPage} of ${Math.ceil(this.totalMatches / this.pageSize) || 1}`;
    }

    async showMatchDetails(matchId) {
        const detailsContainer = document.getElementById('match-details-container');
        const detailsContent = document.getElementById('match-details-content');
        
        if (!detailsContainer || !detailsContent) return;
        
        detailsContainer.style.display = 'block';
        detailsContent.innerHTML = `
            <div class="loading-spinner"></div>
            <p>Loading details...</p>
        `;
        
        try {
            const data = await this.loadMatchDetails(matchId);
            
            let aiNames = {};
            try {
                const configResponse = await fetch('/api/config2');
                const config = await configResponse.json();
                if (config && config.aiServices) {
                    config.aiServices.forEach(service => {
                        aiNames[service.type] = service.name;
                    });
                }
            } catch (error) {
                console.error('Error loading config:', error);
            }
            
            let html = `
                <div class="match-info">
                    <h4>General Information</h4>
                    <p><strong>ID:</strong> ${data.match.match_id}</p>
                    <p><strong>Start:</strong> ${new Date(data.match.start_time).toLocaleString()}</p>
                    <p><strong>End:</strong> ${data.match.end_time ? new Date(data.match.end_time).toLocaleString() : 'In progress'}</p>
                    <p><strong>Status:</strong> ${data.match.status}</p>
                </div>
                
                <div class="participants-section">
                    <h4>Participants</h4>
                    <table class="details-table">
                        <thead>
                            <tr>
                                <th>AI</th>
                                <th>Winner</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.participants.map(p => `
                                <tr>
                                    <td>${aiNames[p.service_type] || p.service_type || `AI #${p.ai_id}`}</td>
                                    <td>${p.is_winner ? '✓' : '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="errors-section" style="grid-column: 1 / -1;">
                    <h4>Files</h4>
                    ${data.files && data.files.length > 0 ? `
                    <table class="details-table">
                        <thead>
                            <tr>
                                <th>AI</th>
                                <th>File</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.files.map(f => {
                                const participant = data.participants.find(p => p.ai_id === f.ai_id);
                                const aiName = participant ? (aiNames[participant.service_type] || participant.service_type || `AI #${f.ai_id}`) : `AI #${f.ai_id}`;
                                
                                return `
                                    <tr>
                                        <td>${aiName}</td>
                                        <td>${f.filename}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                    <div class="errors-summary-container">
                        <h4>Summary by AI</h4>
                        <table class="errors-summary-table">
                            <thead>
                                <tr>
                                    <th>AI Service</th>
                                    <th>Total Errors</th>
                                    <th>Total Warnings</th>
                                    <th>Total Issues</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(() => {
                                    const totals = {};
                                    data.participants.forEach(participant => {
                                        const aiName = aiNames[participant.service_type] || participant.service_type || `AI #${participant.ai_id}`;
                                        const responseData = (data.responses || []).find(r => r.ai_id === participant.ai_id);
                                        if (responseData) {
                                            totals[aiName] = {
                                                errors: responseData.has_errors || 0,
                                                warnings: responseData.has_warnings || 0
                                            };
                                        } else {
                                            totals[aiName] = { errors: 0, warnings: 0 };
                                        }
                                    });
                                    
                                    return Object.entries(totals).map(([aiName, counts]) => {
                                        const totalIssues = counts.errors + counts.warnings;
                                        return `
                                            <tr>
                                                <td>${aiName}</td>
                                                <td class="error-number">${counts.errors}</td>
                                                <td class="warning-number">${counts.warnings}</td>
                                                <td><strong>${totalIssues}</strong></td>
                                            </tr>
                                        `;
                                    }).join('');
                                })()}
                            </tbody>
                        </table>
                    </div>
                    ` : '<p>No files available</p>'}
                </div>
            `;
            
            detailsContent.innerHTML = html;
            
            detailsContainer.scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            console.error('Error showing match details:', error);
            detailsContent.innerHTML = `
                <div class="error-message">Error loading details: ${error.message}</div>
            `;
        }
    }

    hideMatchDetails() {
        const detailsContainer = document.getElementById('match-details-container');
        if (detailsContainer) {
            detailsContainer.style.display = 'none';
        }
    }

    hideGameAreaData() {
        const gameArea = document.getElementById('game-area');
        const mainCanvas = gameArea.querySelector('canvas');
        const teamsContainer = document.getElementById('game-teams-container');
        const dataContainer = gameArea.querySelector('#data-container');
        
        if (dataContainer) dataContainer.style.display = 'none';
        if (mainCanvas) mainCanvas.style.display = 'block';
        if (teamsContainer) teamsContainer.style.display = 'block';
    }

    async onShow() {
        try {
            this.init();
            await this.loadFilterOptions();
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            this.renderGameAreaData();
            this.setupEventListeners();
        } catch (error) {
            console.error('Error in Data tab onShow:', error);
        }
    }

    onHide() {
        this.hideGameAreaData();
        this.hideMatchDetails();
        this.contentRendered = false;
    }
}

const dataTab = new DataTab();
tabManager.registerTab('data-tab', dataTab, true);
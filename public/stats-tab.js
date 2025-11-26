import tabManager from './tabs-manager.js';

export class StatsTab {
    constructor() {
        this.title = 'Stats';
        this.element = document.getElementById('stats-tab');
        this.ais = [];
        this.teams = [];
        this.promptDurations = [];
        this.aiSort = {
            column: 'wins',
            direction: 'desc'
        };
        this.stats = {
            totalMatches: 0,
            totalRounds: 0
        };
        this.filters = {
            dateFrom: '',
            dateTo: ''
        };
        this.aiMetric = 'issueRatio';
        this.aiMetricData = [];
    }

    init() {
        this.element.innerHTML = `
            <div class="stats-tab-panel">
                <div class="stats-panel-header">
                    <h3>Stats</h3>
                </div>
                <form id="stats-sidebar-form" class="stats-sidebar-form">
                    <div class="stats-filter-field">
                        <label for="stats-date-from">From</label>
                        <input type="date" id="stats-date-from" value="${this.filters.dateFrom || ''}">
                    </div>
                    <div class="stats-filter-field">
                        <label for="stats-date-to">To</label>
                        <input type="date" id="stats-date-to" value="${this.filters.dateTo || ''}">
                    </div>
                    <div class="stats-filter-actions">
                        <button type="submit" class="apply-btn">Apply</button>
                        <button type="button" id="stats-clear-filters" class="secondary-btn">Clear</button>
                    </div>
                    <p class="filter-hint">Leave "To" empty for open ended results.</p>
                </form>
            </div>
        `;
        this.setupSidebarFilters();
    }

    async loadData() {
        try {
            await Promise.all([
                this.loadTeamsData(),
                this.loadAIsData(),
                this.loadStatsData(),
                this.loadPromptDurations()
            ]);
            
            this.renderGameAreaStats();
        } catch (error) {
            console.error('Error loading stats data:', error);
            this.renderErrorState();
        }
    }

    renderErrorState() {
        const gameArea = document.getElementById('game-area');
        const mainCanvas = gameArea.querySelector('canvas');
        const teamsContainer = document.getElementById('game-teams-container');
        
        if (mainCanvas) mainCanvas.style.display = 'none';
        if (teamsContainer) teamsContainer.style.display = 'none';
        
        let statsContainer = gameArea.querySelector('#stats-container');
        if (!statsContainer) {
            statsContainer = document.createElement('div');
            statsContainer.id = 'stats-container';
            statsContainer.className = 'stats-overlay';
            gameArea.appendChild(statsContainer);
        }
        
        statsContainer.style.display = 'block';
        statsContainer.innerHTML = `
            <div style="text-align: center; padding: 30px; color: #ff5555;">
                <h2>Error loading statistics</h2>
                <p>Could not load data. Please try again later.</p>
            </div>
        `;
    }

    getFilterQueryString() {
        const params = [];
        if (this.filters.dateFrom) {
            params.push(`dateFrom=${encodeURIComponent(this.filters.dateFrom)}`);
        }
        if (this.filters.dateTo) {
            params.push(`dateTo=${encodeURIComponent(this.filters.dateTo)}`);
        }
        return params.length ? `?${params.join('&')}` : '';
    }

    async loadTeamsData() {
        try {
            const response = await fetch(`/api/stats/teams${this.getFilterQueryString()}`);
            if (!response.ok) {
                throw new Error(`Error loading teams: ${response.status}`);
            }
            
            const data = await response.json();
            this.teams = data.teams || [];
            
            return this.teams;
        } catch (error) {
            console.error('Error loading teams data:', error);
            this.teams = [];
            return [];
        }
    }

    async loadAIsData() {
        try {
            const response = await fetch(`/api/stats/ais${this.getFilterQueryString()}`);
            if (!response.ok) {
                throw new Error(`Error loading AIs: ${response.status}`);
            }
            
            const data = await response.json();
            this.ais = this.processAisData(data.ais || []);
            this.sortAIs();
            
            return this.ais;
        } catch (error) {
            console.error('Error loading AIs data:', error);
            this.ais = [];
            return [];
        }
    }

    processAisData(ais) {
        const aisMap = new Map();
        
        ais.forEach(ai => {
            const key = ai.service_type;
            const totalErrors = typeof ai.total_errors === 'number' ? ai.total_errors : 0;
            const totalWarnings = typeof ai.total_warnings === 'number' ? ai.total_warnings : 0;
            const weightedIssues = typeof ai.weighted_issues === 'number'
                ? ai.weighted_issues
                : (totalWarnings + totalErrors * 4);
            
            if (aisMap.has(key)) {
                const existingAi = aisMap.get(key);
                existingAi.total_matches += ai.total_matches || 0;
                existingAi.wins += ai.wins || 0;
                existingAi.weighted_issues += weightedIssues || 0;
                existingAi.total_units_created += ai.total_units_created || 0;
                existingAi.total_errors += totalErrors;
                existingAi.total_warnings += totalWarnings;
            } else {
                aisMap.set(key, {
                    name: ai.name,
                    service_type: ai.service_type,
                    total_matches: ai.total_matches || 0,
                    wins: ai.wins || 0,
                    weighted_issues: weightedIssues || 0,
                    total_units_created: ai.total_units_created || 0,
                    total_errors: totalErrors,
                    total_warnings: totalWarnings
                });
            }
        });

        return Array.from(aisMap.values());
    }

    async loadStatsData() {
        try {
            const response = await fetch(`/api/stats/summary${this.getFilterQueryString()}`);
            if (!response.ok) {
                throw new Error(`Error loading statistics: ${response.status}`);
            }
            
            const data = await response.json();
            this.stats = data || { totalMatches: 0, totalRounds: 0 };
            
            return this.stats;
        } catch (error) {
            console.error('Error loading stats data:', error);
            this.stats = { totalMatches: 0, totalRounds: 0 };
            return this.stats;
        }
    }

    async loadPromptDurations() {
        try {
            const response = await fetch(`/api/stats/prompt-metrics${this.getFilterQueryString()}`);
            if (!response.ok) {
                throw new Error(`Error loading prompt metrics: ${response.status}`);
            }
            const data = await response.json();
            this.promptDurations = data.promptDurations || [];
            return this.promptDurations;
        } catch (error) {
            console.error('Error loading prompt metrics summary:', error);
            this.promptDurations = [];
            return [];
        }
    }

    renderGameAreaStats() {
        const gameArea = document.getElementById('game-area');
        const mainCanvas = gameArea.querySelector('canvas');
        const teamsContainer = document.getElementById('game-teams-container');
        
        if (mainCanvas) mainCanvas.style.display = 'none';
        if (teamsContainer) teamsContainer.style.display = 'none';
        
        let statsContainer = gameArea.querySelector('#stats-container');
        if (!statsContainer) {
            statsContainer = document.createElement('div');
            statsContainer.id = 'stats-container';
            statsContainer.className = 'stats-overlay';
            gameArea.appendChild(statsContainer);
        }
        
        statsContainer.style.display = 'block';

        const aiMetricData = this.getAIMetricData(this.aiMetric);
        this.aiMetricData = aiMetricData;
        
        statsContainer.innerHTML = `
            <div class="stats-main">
                        <div class="chart-card wide">
                            <div class="chart-header">
                                <div class="chart-metric-selector">
                                    <label for="ai-metric-select">Metric</label>
                                    <select id="ai-metric-select">
                                        <option value="issueRatio"${this.aiMetric === 'issueRatio' ? ' selected' : ''}>Issue Ratio (less is better)</option>
                                        <option value="winRate"${this.aiMetric === 'winRate' ? ' selected' : ''}>Win Rate</option>
                                        <option value="promptTime"${this.aiMetric === 'promptTime' ? ' selected' : ''}>Average Prompt Time</option>
                                    </select>
                                </div>
                                <div class="chart-legend-inline">
                                    ${this.renderAiLegendTable()}
                                </div>
                            </div>
                            <div class="chart-container">
                                <canvas id="ai-wins-canvas"></canvas>
                            </div>
                        </div>

                <div class="stats-table-container">
                    <h4>AI Performance</h4>
                    <table class="stats-table ai-performance-table">
                        <thead>
                            <tr>
                                <th class="sortable" data-sort="name">AI</th>
                                <th class="sortable" data-sort="units">Units</th>
                                <th class="sortable" data-sort="matches">Matches</th>
                                <th class="sortable" data-sort="wins">Wins</th>
                                <th class="sortable" data-sort="winRate">Win Rate</th>
                                <th class="sortable" data-sort="issues">Issues (4xE + W)</th>
                                <th class="sortable" data-sort="issueRatio">Issue Ratio (per unit)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.renderAITableRows()}
                        </tbody>
                    </table>
                </div>

                <div class="stats-table-container">
                    <h4>Prompt Durations (Filtered Matches)</h4>
                    <table class="stats-table prompt-duration-table">
                        <thead>
                            <tr>
                                <th>AI</th>
                                <th>Team</th>
                                <th>Average Time</th>
                                <th>Total Prompts</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.renderPromptDurationRows()}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        setTimeout(() => {
            this.drawAIMetricChart();
            this.setupAIPerformanceSorting();
            this.setupMetricSelector();
        }, 100);
    }

    getWeightedIssueCount(ai) {
        if (!ai) return 0;
        if (typeof ai.weighted_issues === 'number') {
            return ai.weighted_issues;
        }
        const totalErrors = typeof ai.total_errors === 'number' ? ai.total_errors : 0;
        const totalWarnings = typeof ai.total_warnings === 'number' ? ai.total_warnings : 0;
        if (totalErrors || totalWarnings) {
            return totalWarnings + (totalErrors * 4);
        }
        return ai.errors || 0;
    }

    renderAITableRows() {
        if (!this.ais || this.ais.length === 0) {
            return '<tr><td colspan="7" class="empty-table">No data available</td></tr>';
        }

        this.sortAIs();

        const aisWithIssues = this.ais.filter(ai => this.getWeightedIssueCount(ai) > 0);
        if (!aisWithIssues.length) {
            return '<tr><td colspan="7" class="empty-table">No AI with issues found</td></tr>';
        }

        return aisWithIssues.map(ai => {
            const totalMatches = ai.total_matches || 0;
            const wins = ai.wins || 0;
            const totalUnits = ai.total_units_created || 0;
            const totalErrors = ai.total_errors || 0;
            const totalWarnings = ai.total_warnings || 0;
            const weightedIssues = this.getWeightedIssueCount(ai);
            const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) + '%' : '0%';
            const issueRatio = (totalUnits > 0 && weightedIssues > 0) ? (weightedIssues / totalUnits).toFixed(4) : '-';
            
            return `
                <tr>
                    <td>${ai.name || 'Unnamed'}</td>
                    <td>${totalUnits}</td>
                    <td>${totalMatches}</td>
                    <td>${wins}</td>
                    <td>${winRate}</td>
                    <td>${weightedIssues} <span class="issue-breakdown">(E:${totalErrors} / W:${totalWarnings})</span></td>
                    <td>${issueRatio}</td>
                </tr>
            `;
        }).join('');
    }

    getAIMetricData(metric) {
        if (!this.ais || this.ais.length === 0) {
            return [];
        }

        if (metric === 'issueRatio') {
            return this.ais
                .map((ai, index) => {
                    const issues = this.getWeightedIssueCount(ai);
                    const totalUnits = ai.total_units_created || 0;
                    if (issues <= 0 || totalUnits <= 0) {
                        return null;
                    }
                    const ratio = issues / totalUnits;
                    const invertedValue = ratio > 0 ? 1 / ratio : 0;
                    return {
                        name: ai.name || `AI ${ai.service_type || index}`,
                        value: invertedValue,
                        displayValue: ratio.toFixed(4),
                        color: this.getRandomColor(index),
                        sortValue: ratio
                    };
                })
                .filter(Boolean)
                .sort((a, b) => a.sortValue - b.sortValue)
                .map(item => ({
                    name: item.name,
                    value: item.value,
                    displayValue: item.displayValue,
                    color: item.color
                }));
        }

        if (metric === 'promptTime') {
            if (!this.promptDurations || this.promptDurations.length === 0) {
                return [];
            }

            return this.promptDurations
                .map((item, index) => {
                    const avgDuration = item.average_duration || 0;
                    if (avgDuration <= 0) {
                        return null;
                    }

                    const aiParts = [];
                    if (item.service_name) {
                        aiParts.push(item.service_name);
                    } else if (item.service_type) {
                        aiParts.push(item.service_type);
                    } else {
                        aiParts.push('Unknown AI');
                    }
                    if (item.ai_id) {
                        aiParts.push(`#${item.ai_id}`);
                    }
                    const aiLabel = aiParts.join(' ');

                    return {
                        name: aiLabel,
                        value: 1 / avgDuration,
                        displayValue: this.formatDuration(avgDuration),
                        color: this.getRandomColor(index),
                        sortValue: avgDuration
                    };
                })
                .filter(Boolean)
                .sort((a, b) => a.sortValue - b.sortValue)
                .map(item => ({
                    name: item.name,
                    value: item.value,
                    displayValue: item.displayValue,
                    color: item.color
                }));
        }

        return this.ais
            .map((ai, index) => {
                const matches = ai.total_matches || 0;
                const issues = this.getWeightedIssueCount(ai);
                const totalUnits = ai.total_units_created || 0;
                if (matches <= 0 || issues <= 0 || totalUnits <= 0) {
                    return null;
                }
                const wins = ai.wins || 0;
                const winRate = wins / matches;
                return {
                    name: ai.name || `AI ${ai.service_type || index}`,
                    value: winRate,
                    displayValue: `${(winRate * 100).toFixed(1)}%`,
                    color: this.getRandomColor(index)
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.value - a.value);
    }

    renderAiLegendTable() {
        if (!this.aiMetricData || this.aiMetricData.length === 0) {
            return '<p class="empty-table legend-empty">No data available</p>';
        }

        return `
            <table class="ai-legend-table">
                <tbody>
                    ${this.aiMetricData.map(item => `
                        <tr>
                            <td><span class="color-dot" style="background-color: ${item.color};"></span></td>
                            <td>${item.name}</td>
                            <td class="legend-value">${item.displayValue ?? item.value}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    setupMetricSelector() {
        const statsContainer = document.getElementById('stats-container');
        if (!statsContainer) return;

        const metricSelect = statsContainer.querySelector('#ai-metric-select');
        if (!metricSelect) return;

        metricSelect.value = this.aiMetric;
        metricSelect.addEventListener('change', () => {
            this.aiMetric = metricSelect.value;
            this.updateAIMetricVisualization();
        });
    }

    updateAIMetricVisualization() {
        this.aiMetricData = this.getAIMetricData(this.aiMetric);

        const statsContainer = document.getElementById('stats-container');
        if (!statsContainer) return;

        const legendContainer = statsContainer.querySelector('.chart-legend-inline');
        if (legendContainer) {
            legendContainer.innerHTML = this.renderAiLegendTable();
        }

        this.drawAIMetricChart();
    }

    drawAIMetricChart() {
        const canvas = document.getElementById('ai-wins-canvas');
        if (!canvas) return;
        
        const container = canvas.parentElement;
        if (container) {
            const width = container.clientWidth || 0;
            const height = container.clientHeight || width;
            const size = Math.min(width, height);
            const finalSize = size > 0 ? size : 320;
            canvas.width = finalSize;
            canvas.height = finalSize;
            canvas.style.width = `${finalSize}px`;
            canvas.style.height = `${finalSize}px`;
        } else {
            canvas.width = 320;
            canvas.height = 320;
        }
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const aiMetricData = this.aiMetricData || [];
        
        if (aiMetricData.length === 0) {
            ctx.fillStyle = '#888';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
            return;
        }
        
        this.drawPieChart(ctx, aiMetricData, canvas.width / 2, canvas.height / 2);
    }

    drawPieChart(ctx, data, centerX, centerY) {
        try {
            const total = data.reduce((sum, item) => sum + item.value, 0);
            if (total <= 0) {
                ctx.fillStyle = '#888';
                ctx.font = '14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('No data available', centerX, centerY);
                return;
            }
            const radius = Math.min(centerX, centerY) * 0.8;
            let startAngle = -Math.PI / 2;
            
            data.forEach(item => {
                const sliceAngle = (item.value / total) * 2 * Math.PI;
                
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
                ctx.closePath();
                
                ctx.fillStyle = item.color;
                ctx.fill();
                
                const midAngle = startAngle + sliceAngle / 2;
                const labelRadius = radius * 0.7;
                const labelX = centerX + Math.cos(midAngle) * labelRadius;
                const labelY = centerY + Math.sin(midAngle) * labelRadius;
                
                const percentage = ((item.value / total) * 100).toFixed(0) + '%';
                ctx.font = 'bold 12px Arial';
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(percentage, labelX, labelY);
                
                startAngle += sliceAngle;
            });
            
        } catch (error) {
            console.error('Error drawing pie chart:', error);
        }
    }

    getRandomColor(index) {
        const colors = [
            '#4CAF50', '#2196F3', '#9C27B0', '#FF5722', '#FFEB3B', 
            '#795548', '#607D8B', '#E91E63', '#00BCD4', '#8BC34A'
        ];
        
        if (index !== undefined) {
            return colors[index % colors.length];
        }
        
        return colors[Math.floor(Math.random() * colors.length)];
    }

    setupAIPerformanceSorting() {
        const statsContainer = document.getElementById('stats-container');
        if (!statsContainer) return;

        const headers = statsContainer.querySelectorAll('.ai-performance-table th[data-sort]');
        headers.forEach(header => {
            header.addEventListener('click', () => {
                const sortKey = header.dataset.sort;
                if (!sortKey) return;

                if (this.aiSort.column === sortKey) {
                    this.aiSort.direction = this.aiSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    this.aiSort.column = sortKey;
                    this.aiSort.direction = sortKey === 'name' ? 'asc' : 'desc';
                }

                this.sortAIs();
                this.updateAITableRows();
                this.updateSortIndicators();
            });
        });

        this.updateSortIndicators();
    }

    getAISortValue(ai, column) {
        const totalMatches = ai.total_matches || 0;
        const wins = ai.wins || 0;
        const totalUnits = ai.total_units_created || 0;
        const weightedIssues = this.getWeightedIssueCount(ai);

        switch (column) {
            case 'name':
                return (ai.name || '').toLowerCase();
            case 'units':
                return totalUnits;
            case 'matches':
                return totalMatches;
            case 'wins':
                return wins;
            case 'winRate':
                return totalMatches > 0 ? wins / totalMatches : 0;
            case 'issues':
                return weightedIssues;
            case 'issueRatio':
                return totalUnits > 0 ? weightedIssues / totalUnits : 0;
            default:
                return 0;
        }
    }

    sortAIs() {
        if (!this.ais || this.ais.length === 0) {
            return;
        }

        const { column, direction } = this.aiSort;
        const multiplier = direction === 'asc' ? 1 : -1;

        this.ais.sort((a, b) => {
            const valueA = this.getAISortValue(a, column);
            const valueB = this.getAISortValue(b, column);

            if (typeof valueA === 'string' || typeof valueB === 'string') {
                const strA = (valueA ?? '').toString();
                const strB = (valueB ?? '').toString();
                return strA.localeCompare(strB) * multiplier;
            }

            if (valueA === valueB) return 0;
            return valueA > valueB ? 1 * multiplier : -1 * multiplier;
        });
    }

    updateAITableRows() {
        const tableBody = document.querySelector('.ai-performance-table tbody');
        if (!tableBody) return;
        tableBody.innerHTML = this.renderAITableRows();
    }

    updateSortIndicators() {
        const headers = document.querySelectorAll('.ai-performance-table th[data-sort]');
        headers.forEach(header => {
            header.classList.remove('sorted-asc', 'sorted-desc');
            if (header.dataset.sort === this.aiSort.column) {
                header.classList.add(this.aiSort.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
            }
        });
    }

    formatDuration(seconds) {
        if (typeof seconds !== 'number' || Number.isNaN(seconds)) {
            return '-';
        }
        if (seconds < 60) {
            return `${Math.round(seconds)}s`;
        }
        const wholeSeconds = Math.round(seconds);
        const minutes = Math.floor(wholeSeconds / 60);
        const remainingSeconds = wholeSeconds % 60;
        if (remainingSeconds === 0) {
            return `${minutes}m`;
        }
        return `${minutes}m ${remainingSeconds}s`;
    }

    renderPromptDurationRows() {
        if (!this.promptDurations.length) {
            return '<tr><td colspan="4" class="empty-table">No data available</td></tr>';
        }

        return this.promptDurations.map(item => {
            const aiParts = [];
            if (item.service_name) {
                aiParts.push(item.service_name);
            } else if (item.service_type) {
                aiParts.push(item.service_type);
            } else {
                aiParts.push('Unknown AI');
            }
            if (item.ai_id) {
                aiParts.push(`#${item.ai_id}`);
            }
            const aiLabel = aiParts.join(' ');
            const teamLabel = item.team_name || '-';
            return `
                <tr>
                    <td>${aiLabel}</td>
                    <td>${teamLabel}</td>
                    <td>${this.formatDuration(item.average_duration || 0)}</td>
                    <td>${item.total_prompts || 0}</td>
                </tr>
            `;
        }).join('');
    }

    setupSidebarFilters() {
        const form = this.element.querySelector('#stats-sidebar-form');
        if (!form) return;

        const dateFromInput = form.querySelector('#stats-date-from');
        const dateToInput = form.querySelector('#stats-date-to');

        if (dateFromInput) {
            dateFromInput.value = this.filters.dateFrom || '';
        }
        if (dateToInput) {
            dateToInput.value = this.filters.dateTo || '';
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const dateFrom = dateFromInput ? dateFromInput.value : '';
            const dateTo = dateToInput ? dateToInput.value : '';
            await this.handleFilterSubmit(dateFrom, dateTo);
        });

        const clearButton = form.querySelector('#stats-clear-filters');
        if (clearButton) {
            clearButton.addEventListener('click', async () => {
                if (dateFromInput) dateFromInput.value = '';
                if (dateToInput) dateToInput.value = '';
                await this.handleFilterClear();
            });
        }
    }

    async handleFilterSubmit(dateFrom, dateTo) {
        const normalizedFrom = dateFrom || '';
        const normalizedTo = dateTo || '';

        if (this.filters.dateFrom === normalizedFrom && this.filters.dateTo === normalizedTo) {
            return;
        }

        this.filters = {
            dateFrom: normalizedFrom,
            dateTo: normalizedTo
        };
        await this.loadData();
    }

    async handleFilterClear() {
        if (!this.filters.dateFrom && !this.filters.dateTo) {
            return;
        }
        this.filters = { dateFrom: '', dateTo: '' };
        await this.loadData();
    }

    hideGameAreaStats() {
        const gameArea = document.getElementById('game-area');
        const mainCanvas = gameArea.querySelector('canvas');
        const teamsContainer = document.getElementById('game-teams-container');
        const statsContainer = gameArea.querySelector('#stats-container');
        
        if (statsContainer) statsContainer.style.display = 'none';
        if (mainCanvas) mainCanvas.style.display = 'block';
        if (teamsContainer) teamsContainer.style.display = 'block';
    }

    async onShow() {
        await this.loadData();
    }

    onHide() {
        this.hideGameAreaStats();
    }
}

const statsTab = new StatsTab();
tabManager.registerTab('stats-tab', statsTab, true);

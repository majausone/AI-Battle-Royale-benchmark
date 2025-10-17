import tabManager from './tabs-manager.js';

export class StatsTab {
    constructor() {
        this.title = 'Stats';
        this.element = document.getElementById('stats-tab');
        this.ais = [];
        this.teams = [];
        this.stats = {
            totalMatches: 0,
            totalRounds: 0
        };
    }

    init() {
        this.element.innerHTML = `
            <div class="stats-tab-placeholder"></div>
        `;
    }

    async loadData() {
        try {
            await Promise.all([
                this.loadTeamsData(),
                this.loadAIsData(),
                this.loadStatsData()
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
                <h2>Error al cargar estadísticas</h2>
                <p>No se pudieron cargar los datos. Por favor, intenta nuevamente más tarde.</p>
            </div>
        `;
    }

    async loadTeamsData() {
        try {
            const response = await fetch('/api/stats/teams');
            if (!response.ok) {
                throw new Error(`Error al cargar equipos: ${response.status}`);
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
            const response = await fetch('/api/stats/ais');
            if (!response.ok) {
                throw new Error(`Error al cargar IAs: ${response.status}`);
            }
            
            const data = await response.json();
            this.ais = this.processAisData(data.ais || []);
            
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

    async loadStatsData() {
        try {
            const response = await fetch('/api/stats/summary');
            if (!response.ok) {
                throw new Error(`Error al cargar estadísticas: ${response.status}`);
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
        
        let html = `
            <div class="stats-dashboard">
                <div class="stat-card">
                    <h4>Total Partidas</h4>
                    <div class="stat-value">${this.stats.totalMatches || 0}</div>
                </div>
                <div class="stat-card">
                    <h4>Total Rondas</h4>
                    <div class="stat-value">${this.stats.totalRounds || 0}</div>
                </div>
                <div class="stat-card">
                    <h4>Equipos Participantes</h4>
                    <div class="stat-value">${this.teams.length || 0}</div>
                </div>
            </div>

            <div class="charts-container">
                <div class="chart-card">
                    <h4>Victorias por Equipo</h4>
                    <div class="chart-container">
                        <canvas id="team-wins-canvas" width="400" height="250"></canvas>
                    </div>
                </div>
                <div class="chart-card">
                    <h4>Victorias por IA</h4>
                    <div class="chart-container">
                        <canvas id="ai-wins-canvas" width="400" height="250"></canvas>
                    </div>
                </div>
            </div>

            <div class="stats-tables">
                <div class="stats-table-container">
                    <h4>Rendimiento de IAs</h4>
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th>IA</th>
                                <th>Servicio</th>
                                <th>Partidas</th>
                                <th>Victorias</th>
                                <th>% Victoria</th>
                                <th>Errores</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.renderAITableRows()}
                        </tbody>
                    </table>
                </div>
                
                <div class="stats-table-container">
                    <h4>Rendimiento de Equipos</h4>
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th>Equipo</th>
                                <th>Partidas</th>
                                <th>Victorias</th>
                                <th>% Victoria</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.renderTeamTableRows()}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        statsContainer.innerHTML = html;
        
        setTimeout(() => {
            this.drawTeamWinsChart();
            this.drawAIWinsChart();
        }, 100);
    }

    renderAITableRows() {
        if (!this.ais || this.ais.length === 0) {
            return '<tr><td colspan="6" class="empty-table">No hay datos disponibles</td></tr>';
        }
        
        return this.ais.map(ai => {
            const totalMatches = ai.total_matches || 0;
            const wins = ai.wins || 0;
            const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) + '%' : '0%';
            
            return `
                <tr>
                    <td>${ai.name || 'Sin nombre'}</td>
                    <td>${ai.service_type || '-'}</td>
                    <td>${totalMatches}</td>
                    <td>${wins}</td>
                    <td>${winRate}</td>
                    <td>${ai.errors || 0}</td>
                </tr>
            `;
        }).join('');
    }

    renderTeamTableRows() {
        if (!this.teams || this.teams.length === 0) {
            return '<tr><td colspan="4" class="empty-table">No hay datos disponibles</td></tr>';
        }
        
        return this.teams.map(team => {
            const totalMatches = team.total_matches || 0;
            const wins = team.wins || 0;
            const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) + '%' : '0%';
            
            return `
                <tr>
                    <td>
                        <div class="team-name-with-color">
                            <div class="team-color-indicator" style="background-color: ${team.color || '#4CAF50'}"></div>
                            ${team.name || 'Sin nombre'}
                        </div>
                    </td>
                    <td>${totalMatches}</td>
                    <td>${wins}</td>
                    <td>${winRate}</td>
                </tr>
            `;
        }).join('');
    }

    drawTeamWinsChart() {
        const canvas = document.getElementById('team-wins-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const teamWinsData = (this.teams || [])
            .filter(team => team.wins && team.wins > 0)
            .map(team => ({
                name: team.name || 'Sin nombre',
                value: team.wins || 0,
                color: team.color || this.getRandomColor()
            }));
        
        if (teamWinsData.length === 0) {
            ctx.fillStyle = '#888';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No hay datos disponibles', canvas.width / 2, canvas.height / 2);
            return;
        }
        
        this.drawPieChart(ctx, teamWinsData, canvas.width / 2, canvas.height / 2);
    }

    drawAIWinsChart() {
        const canvas = document.getElementById('ai-wins-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const aiWinsData = (this.ais || [])
            .filter(ai => ai.wins && ai.wins > 0)
            .map((ai, index) => ({
                name: ai.name || `IA ${ai.service_type || index}`,
                value: ai.wins || 0,
                color: this.getRandomColor(index)
            }));
        
        if (aiWinsData.length === 0) {
            ctx.fillStyle = '#888';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No hay datos disponibles', canvas.width / 2, canvas.height / 2);
            return;
        }
        
        this.drawPieChart(ctx, aiWinsData, canvas.width / 2, canvas.height / 2);
    }

    drawPieChart(ctx, data, centerX, centerY) {
        try {
            const total = data.reduce((sum, item) => sum + item.value, 0);
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
            
            const legendX = centerX - radius;
            const legendY = centerY + radius * 1.2;
            const lineHeight = 20;
            
            data.forEach((item, index) => {
                const legendItemX = legendX;
                const legendItemY = legendY + index * lineHeight;
                
                ctx.fillStyle = item.color;
                ctx.fillRect(legendItemX, legendItemY - 8, 16, 16);
                
                ctx.font = '12px Arial';
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${item.name}: ${item.value} victorias`, legendItemX + 24, legendItemY);
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
        
        if (index !== undefined && index < colors.length) {
            return colors[index];
        }
        
        return colors[Math.floor(Math.random() * colors.length)];
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
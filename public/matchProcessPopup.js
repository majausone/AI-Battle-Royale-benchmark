export class MatchProcessPopup {
    constructor() {
        this.popup = null;
        this.processes = {
            requestUnits: {
                name: 'Request Units',
                status: 'pending',
                startTime: null,
                endTime: null,
                logs: [],
                expanded: false,
                details: {},
                aiStats: new Map(),
                element: null,
                logsContainer: null,
                lastLogCount: 0,
                currentStatusMessage: null
            },
            adaptPrices: {
                name: 'Adapt Prices',
                status: 'pending',
                startTime: null,
                endTime: null,
                logs: [],
                expanded: false,
                details: {},
                aiStats: new Map(),
                element: null,
                logsContainer: null,
                lastLogCount: 0,
                currentStatusMessage: null
            },
            buyUnits: {
                name: 'Buy Units',
                status: 'pending',
                startTime: null,
                endTime: null,
                logs: [],
                expanded: false,
                details: {},
                aiStats: new Map(),
                element: null,
                logsContainer: null,
                lastLogCount: 0,
                currentStatusMessage: null
            }
        };
        this.totalStartTime = null;
        this.currentMatchId = null;
        this.acceptCallback = null;
        this.cancelCallback = null;
        this.updateInterval = null;
        this.roundWinner = null;
        this.gameWinner = null;
        this.isDraw = false;
        this.roundNumber = null;
        this.totalRounds = null;
        this.processContainer = null;
        this.timerElement = null;
        this.statusText = null;
        this.acceptButton = null;
        this.battleReady = false;
        this.isActiveButHidden = false;
        this.autoMode = false;
        this.cleanMode = false;
        this.processStarted = false;
        this.startButton = null;
        this.startProcessCallback = null;
        this.resultElements = {
            roundWin: null,
            gameWin: null,
            gameDraw: null
        };
        this.init();
    }

    formatDuration(seconds) {
        if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
            return '...';
        }
        const totalSeconds = Math.max(0, Number(seconds));
        if (totalSeconds < 60) {
            return `${totalSeconds.toFixed(1)}s`;
        }
        const minutes = Math.floor(totalSeconds / 60);
        const remaining = (totalSeconds - minutes * 60).toFixed(1);
        return `${minutes}m ${remaining}s`;
    }

    init() {
        this.popup = document.createElement('div');
        this.popup.className = 'match-process-popup';
        this.popup.style.display = 'none';
        
        const content = document.createElement('div');
        content.className = 'match-process-content';
        
        const controls = document.createElement('div');
        controls.className = 'match-process-controls';
        
        const autoCheckbox = document.createElement('div');
        autoCheckbox.className = 'match-process-checkbox';
        const autoInput = document.createElement('input');
        autoInput.type = 'checkbox';
        autoInput.id = 'auto-mode-checkbox';
        autoInput.addEventListener('change', (e) => {
            this.autoMode = e.target.checked;
        });
        const autoLabel = document.createElement('label');
        autoLabel.htmlFor = 'auto-mode-checkbox';
        autoLabel.textContent = 'Auto';
        autoCheckbox.appendChild(autoInput);
        autoCheckbox.appendChild(autoLabel);
        
        const cleanCheckbox = document.createElement('div');
        cleanCheckbox.className = 'match-process-checkbox';
        const cleanInput = document.createElement('input');
        cleanInput.type = 'checkbox';
        cleanInput.id = 'clean-mode-checkbox';
        cleanInput.addEventListener('change', (e) => {
            this.cleanMode = e.target.checked;
        });
        const cleanLabel = document.createElement('label');
        cleanLabel.htmlFor = 'clean-mode-checkbox';
        cleanLabel.textContent = 'Clean';
        cleanCheckbox.appendChild(cleanInput);
        cleanCheckbox.appendChild(cleanLabel);
        
        this.startButton = document.createElement('button');
        this.startButton.className = 'match-process-start-btn';
        this.startButton.textContent = 'Start';
        this.startButton.addEventListener('click', () => {
            this.startProcess();
        });
        
        controls.appendChild(autoCheckbox);
        controls.appendChild(cleanCheckbox);
        controls.appendChild(this.startButton);
        
        const header = document.createElement('div');
        header.className = 'match-process-header';
        
        const h2 = document.createElement('h2');
        h2.textContent = 'Match Process';
        header.appendChild(h2);
        
        const timerDiv = document.createElement('div');
        timerDiv.className = 'match-process-timer';
        timerDiv.textContent = 'Total Time: ';
        this.timerElement = document.createElement('span');
        this.timerElement.id = 'total-timer';
        this.timerElement.textContent = '00:00';
        timerDiv.appendChild(this.timerElement);
        header.appendChild(timerDiv);
        
        this.processContainer = document.createElement('div');
        this.processContainer.className = 'match-process-container';
        this.processContainer.id = 'process-sections';
        
        const statusContainer = document.createElement('div');
        statusContainer.className = 'match-process-status-container';
        this.statusText = document.createElement('div');
        this.statusText.className = 'match-process-status-text';
        this.statusText.textContent = 'Waiting to start...';
        statusContainer.appendChild(this.statusText);
        
        const buttons = document.createElement('div');
        buttons.className = 'match-process-buttons';
        
        const closeButton = document.createElement('button');
        closeButton.id = 'match-process-close';
        closeButton.className = 'match-process-btn close';
        closeButton.textContent = 'Close';
        closeButton.addEventListener('click', () => {
            this.hideWithoutReset();
        });
        
        this.acceptButton = document.createElement('button');
        this.acceptButton.id = 'match-process-accept';
        this.acceptButton.className = 'match-process-btn accept';
        this.acceptButton.textContent = 'Accept';
        this.acceptButton.disabled = true;
        this.acceptButton.addEventListener('click', () => {
            if (this.battleReady) {
                window.dispatchEvent(new Event('startBattleNow'));
                this.hide();
            } else {
                if (this.acceptCallback) this.acceptCallback();
                this.hide();
            }
        });
        
        buttons.appendChild(closeButton);
        buttons.appendChild(this.acceptButton);
        
        content.appendChild(controls);
        content.appendChild(header);
        content.appendChild(this.processContainer);
        content.appendChild(statusContainer);
        content.appendChild(buttons);
        
        this.popup.appendChild(content);
        document.body.appendChild(this.popup);
        
        this.createProcessElements();
        this.setupEventListeners();
    }

    createProcessElements() {
        for (const [key, process] of Object.entries(this.processes)) {
            const section = document.createElement('div');
            section.className = 'process-section pending';
            
            const header = document.createElement('div');
            header.className = 'process-header';
            header.dataset.process = key;
            
            const info = document.createElement('div');
            info.className = 'process-info';
            
            const icon = document.createElement('span');
            icon.className = 'process-icon';
            icon.textContent = '⏳';
            
            const name = document.createElement('span');
            name.className = 'process-name';
            name.textContent = process.name;
            
            const time = document.createElement('span');
            time.className = 'process-time';
            time.textContent = '[00:00]';
            
            info.appendChild(icon);
            info.appendChild(name);
            info.appendChild(time);
            
            const expandBtn = document.createElement('button');
            expandBtn.className = 'expand-btn';
            expandBtn.textContent = '▶';
            
            header.appendChild(info);
            header.appendChild(expandBtn);
            
            header.addEventListener('click', () => this.toggleExpand(key));
            
            const details = document.createElement('div');
            details.className = 'process-details';
            details.style.display = 'none';
            
            const logsContainer = document.createElement('div');
            logsContainer.className = 'process-logs';
            logsContainer.style.display = 'none';
            
            section.appendChild(header);
            section.appendChild(details);
            section.appendChild(logsContainer);
            
            process.element = {
                section,
                icon,
                time,
                expandBtn,
                details,
                logsContainer
            };
            process.logsContainer = logsContainer;
        }
    }

    createResultElement(type, iconText, message) {
        const section = document.createElement('div');
        section.className = `match-result-section ${type}`;
        
        const icon = document.createElement('div');
        icon.className = 'result-icon';
        icon.textContent = iconText;
        
        const text = document.createElement('div');
        text.className = 'result-text';
        text.innerHTML = message;
        
        section.appendChild(icon);
        section.appendChild(text);
        
        return section;
    }

    setupEventListeners() {
        window.addEventListener('matchProcessUpdate', (e) => {
            this.handleProcessUpdate(e.detail);
        });

        window.addEventListener('battleReady', (e) => {
            this.battleReady = true;
            if (this.autoMode) {
                setTimeout(() => {
                    window.dispatchEvent(new Event('startBattleNow'));
                    this.hide();
                }, 500);
            } else {
                this.acceptButton.disabled = false;
                this.acceptButton.textContent = 'Start Battle';
                this.statusText.textContent = 'Ready to start battle!';
            }
        });
    }

    handleProcessUpdate(data) {
        const { type, process, ...details } = data;
        
        switch (type) {
            case 'start':
                this.startProcessInternal(process);
                break;
            case 'progress':
                this.updateProcess(process, details);
                break;
            case 'log':
                this.addLog(process, details.message, details.level);
                break;
            case 'complete':
                this.completeProcess(process, details.success);
                break;
            case 'roundWin':
                this.showRoundWin(details);
                break;
            case 'gameWin':
                this.showGameWin(details);
                break;
            case 'gameDraw':
                this.showGameDraw(details);
                break;
        }
        
        this.updateStatusText();
    }

    startProcess() {
        if (this.processStarted) return;
        
        this.processStarted = true;
        this.startButton.style.display = 'none';
        
        if (this.startProcessCallback) {
            this.startProcessCallback();
        }
    }

    startProcessInternal(processKey) {
        if (this.processes[processKey]) {
            const process = this.processes[processKey];
            process.status = 'processing';
            process.startTime = Date.now();
            process.details = {};
            if (process.aiStats) {
                process.aiStats.clear();
            }
            process.currentStatusMessage = null;
            
            if (process.element) {
                process.element.section.className = 'process-section processing';
                process.element.icon.textContent = '🔄';
                if (process.element.details) {
                    process.element.details.innerHTML = '';
                }
            }
        }
    }

    updateProcess(processKey, details) {
        if (this.processes[processKey]) {
            const process = this.processes[processKey];
            Object.assign(process.details, details);

            if (details.aiId) {
                if (!process.aiStats) {
                    process.aiStats = new Map();
                }
                const key = `${details.teamId || ''}-${details.aiId}`;
                const prev = process.aiStats.get(key) || {};
                process.aiStats.set(key, {
                    aiId: details.aiId,
                    teamId: details.teamId,
                    teamName: details.teamName || prev.teamName || '',
                    status: details.status || prev.status || 'processing',
                    durationSeconds: details.durationSeconds !== undefined ? details.durationSeconds : prev.durationSeconds,
                    expectedUnits: details.expectedUnits !== undefined ? details.expectedUnits : prev.expectedUnits,
                    receivedUnits: details.receivedUnits !== undefined ? details.receivedUnits : prev.receivedUnits,
                    budget: details.budget !== undefined ? details.budget : prev.budget,
                    spend: details.spend !== undefined ? details.spend : prev.spend
                });
            }
            
            if (details.statusMessage) {
                process.currentStatusMessage = details.statusMessage;
            }
            
            if (details.message) {
                this.addLog(processKey, details.message, 'info');
            }
            
            if (process.element && process.element.details) {
                process.element.details.innerHTML = '';

                if (process.aiStats && process.aiStats.size > 0) {
                    const table = document.createElement('div');
                    table.className = 'ai-stats-table';

                    const headerRow = document.createElement('div');
                    headerRow.className = 'ai-stats-row header';
                    ['Name', 'Status', 'Time', 'Units'].forEach(text => {
                        const cell = document.createElement('div');
                        cell.className = 'ai-stats-cell';
                        cell.textContent = text;
                        headerRow.appendChild(cell);
                    });
                    table.appendChild(headerRow);

                    process.aiStats.forEach(stat => {
                        const row = document.createElement('div');
                        row.className = `ai-stats-row ai-${stat.status || 'processing'}`;
                        const name = stat.teamName || `${stat.aiId}`;
                        const time = this.formatDuration(stat.durationSeconds);
                        let unitsText = '-';
                        if (stat.budget != null) {
                            unitsText = `${stat.spend || 0}/${stat.budget}`;
                        } else if (stat.expectedUnits != null) {
                            unitsText = `${stat.receivedUnits || 0}/${stat.expectedUnits}`;
                        } else if (stat.receivedUnits != null) {
                            unitsText = `${stat.receivedUnits}`;
                        }

                        [name, stat.status || 'processing', time, unitsText].forEach(value => {
                            const cell = document.createElement('div');
                            cell.className = 'ai-stats-cell';
                            cell.textContent = value;
                            row.appendChild(cell);
                        });

                        table.appendChild(row);
                    });

                    process.element.details.appendChild(table);
                    process.element.details.style.display = 'block';
                } else {
                    for (const [detailKey, detailValue] of Object.entries(process.details)) {
                        if (detailKey !== 'message' && detailKey !== 'statusMessage') {
                            const item = document.createElement('div');
                            item.className = 'detail-item';
                            item.textContent = `${detailKey}: ${detailValue}`;
                            process.element.details.appendChild(item);
                        }
                    }
                    if (Object.keys(process.details).length > 0) {
                        process.element.details.style.display = 'block';
                    }
                }
            }
        }
    }

    addLog(processKey, message, level = 'info') {
        if (this.processes[processKey]) {
            const process = this.processes[processKey];
            process.logs.push({
                time: new Date().toLocaleTimeString(),
                message,
                level
            });
            
            if (process.logs.length > 100) {
                process.logs.shift();
                if (process.logsContainer && process.logsContainer.firstChild) {
                    process.logsContainer.removeChild(process.logsContainer.firstChild);
                }
            }
            
            if (process.logsContainer && process.logs.length > process.lastLogCount) {
                const newLogs = process.logs.slice(process.lastLogCount);
                newLogs.forEach(log => {
                    const logEntry = document.createElement('div');
                    logEntry.className = `log-entry ${log.level}`;
                    
                    const timeSpan = document.createElement('span');
                    timeSpan.className = 'log-time';
                    timeSpan.textContent = log.time;
                    
                    const messageSpan = document.createElement('span');
                    messageSpan.className = 'log-message';
                    messageSpan.textContent = log.message;
                    
                    logEntry.appendChild(timeSpan);
                    logEntry.appendChild(messageSpan);
                    
                    process.logsContainer.appendChild(logEntry);
                });
                
                process.lastLogCount = process.logs.length;
            }
        }
    }

    completeProcess(processKey, success = true) {
        if (this.processes[processKey]) {
            const process = this.processes[processKey];
            process.status = success ? 'completed' : 'error';
            process.endTime = Date.now();
            process.currentStatusMessage = null;
            
            if (process.element) {
                process.element.section.className = `process-section ${process.status}`;
                process.element.icon.textContent = success ? '✅' : '❌';
            }
        }
        
        const allCompleted = Object.values(this.processes).every(p => 
            p.status === 'completed' || p.status === 'error'
        );
        
        if (allCompleted && this.acceptButton && !this.battleReady) {
            this.acceptButton.disabled = false;
        }
    }

    showRoundWin(details) {
        this.roundWinner = details.winner;
        this.roundNumber = details.round;
        this.totalRounds = details.totalRounds;
        this.currentMatchId = details.matchId;
        
        if (!this.resultElements.roundWin) {
            this.resultElements.roundWin = this.createResultElement(
                'round-win',
                '🏆',
                `<strong>${this.roundWinner}</strong> wins Round ${this.roundNumber}!`
            );
            this.processContainer.insertBefore(this.resultElements.roundWin, this.processContainer.firstChild);
        } else {
            this.resultElements.roundWin.querySelector('.result-text').innerHTML = 
                `<strong>${this.roundWinner}</strong> wins Round ${this.roundNumber}!`;
        }
    }

    showGameWin(details) {
        this.gameWinner = details.winner;
        this.currentMatchId = details.matchId;
        
        if (!this.resultElements.gameWin) {
            this.resultElements.gameWin = this.createResultElement(
                'game-win',
                '👑',
                `<strong>${this.gameWinner}</strong> WINS THE GAME!`
            );
            this.processContainer.insertBefore(this.resultElements.gameWin, this.processContainer.firstChild);
        } else {
            this.resultElements.gameWin.querySelector('.result-text').innerHTML = 
                `<strong>${this.gameWinner}</strong> WINS THE GAME!`;
        }
    }

    showGameDraw(details) {
        this.isDraw = true;
        this.currentMatchId = details.matchId;
        
        if (!this.resultElements.gameDraw) {
            this.resultElements.gameDraw = this.createResultElement(
                'game-draw',
                '🤝',
                `<strong>DRAW!</strong> No winner this game.`
            );
            this.processContainer.insertBefore(this.resultElements.gameDraw, this.processContainer.firstChild);
        }
    }

    toggleExpand(processKey) {
        if (this.processes[processKey]) {
            const process = this.processes[processKey];
            process.expanded = !process.expanded;
            
            if (process.element) {
                process.element.expandBtn.textContent = process.expanded ? '▼' : '▶';
                if (process.logsContainer) {
                    process.logsContainer.style.display = process.expanded && process.logs.length > 0 ? 'block' : 'none';
                }
            }
        }
    }

    getElapsedTime(process) {
        if (!process.startTime) return '00:00';
        
        const endTime = process.endTime || Date.now();
        const elapsed = Math.floor((endTime - process.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    updateStatusText() {
        if (!this.statusText) return;
        
        const processingProcess = Object.entries(this.processes).find(([key, p]) => p.status === 'processing');
        
        if (processingProcess) {
            const [key, process] = processingProcess;
            if (process.currentStatusMessage) {
                this.statusText.textContent = process.currentStatusMessage;
            } else {
                this.statusText.textContent = `Processing ${process.name}...`;
            }
        } else {
            const allCompleted = Object.values(this.processes).every(p => 
                p.status === 'completed' || p.status === 'error'
            );
            
            if (allCompleted) {
                if (this.battleReady) {
                    this.statusText.textContent = 'Ready to start battle!';
                } else {
                    this.statusText.textContent = 'All processes completed';
                }
            } else {
                this.statusText.textContent = 'Waiting to start...';
            }
        }
    }

    startTimer() {
        if (this.updateInterval) clearInterval(this.updateInterval);
        
        this.updateInterval = setInterval(() => {
            if (!this.totalStartTime) return;
            
            const elapsed = Math.floor((Date.now() - this.totalStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            
            if (this.timerElement) {
                this.timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
            
            for (const [key, process] of Object.entries(this.processes)) {
                if (process.element && process.element.time && process.startTime) {
                    process.element.time.textContent = `[${this.getElapsedTime(process)}]`;
                }
            }
        }, 1000);
    }

    show(matchId = null, acceptCallback = null, cancelCallback = null, startProcessCallback = null) {
        const isVisible = this.popup.style.display === 'flex';
        
        this.currentMatchId = matchId;
        this.acceptCallback = acceptCallback;
        this.cancelCallback = cancelCallback;
        this.startProcessCallback = startProcessCallback;
        
        if (!isVisible) {
            if (!this.totalStartTime) {
                this.totalStartTime = Date.now();
            }
            
            this.battleReady = false;
            this.roundWinner = null;
            this.gameWinner = null;
            this.isDraw = false;
            this.processStarted = false;
            
            if (this.startButton) {
                this.startButton.style.display = 'block';
            }
            
            if (this.resultElements.roundWin && this.resultElements.roundWin.parentNode) {
                this.resultElements.roundWin.parentNode.removeChild(this.resultElements.roundWin);
                this.resultElements.roundWin = null;
            }
            if (this.resultElements.gameWin && this.resultElements.gameWin.parentNode) {
                this.resultElements.gameWin.parentNode.removeChild(this.resultElements.gameWin);
                this.resultElements.gameWin = null;
            }
            if (this.resultElements.gameDraw && this.resultElements.gameDraw.parentNode) {
                this.resultElements.gameDraw.parentNode.removeChild(this.resultElements.gameDraw);
                this.resultElements.gameDraw = null;
            }
            
            Object.keys(this.processes).forEach(key => {
                const process = this.processes[key];
                if (process.status !== 'processing' && process.status !== 'completed') {
                    process.status = 'pending';
                    process.startTime = null;
                    process.endTime = null;
                }
                process.expanded = false;
                process.details = {};
                process.currentStatusMessage = null;
                
                if (process.element) {
                    if (process.status === 'pending') {
                        process.element.section.className = 'process-section pending';
                        process.element.icon.textContent = '⏳';
                        process.element.time.textContent = '[00:00]';
                    }
                    process.element.expandBtn.textContent = '▶';
                    if (process.element.details) {
                        process.element.details.innerHTML = '';
                        process.element.details.style.display = 'none';
                    }
                    
                    if (!process.element.section.parentNode) {
                        this.processContainer.appendChild(process.element.section);
                    }
                }
            });
            
            if (this.acceptButton) {
                this.acceptButton.disabled = true;
                this.acceptButton.textContent = 'Accept';
            }
            
            this.popup.style.display = 'flex';
            this.isActiveButHidden = false;
            this.startTimer();
            this.updateStatusText();
            
            window.dispatchEvent(new CustomEvent('matchPopupVisibilityChange', {
                detail: { visible: true, canReopen: false }
            }));
        }
    }

    hideWithoutReset() {
        this.popup.style.display = 'none';
        this.isActiveButHidden = true;
        
        window.dispatchEvent(new CustomEvent('matchPopupVisibilityChange', {
            detail: { visible: false, canReopen: true }
        }));
    }

    hide() {
        this.popup.style.display = 'none';
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.totalStartTime = null;
        this.battleReady = false;
        this.isActiveButHidden = false;
        this.processStarted = false;
        
        Object.keys(this.processes).forEach(key => {
            const process = this.processes[key];
            process.status = 'pending';
            process.startTime = null;
            process.endTime = null;
            process.logs = [];
            process.lastLogCount = 0;
            process.currentStatusMessage = null;
            process.details = {};
            process.expanded = false;
            
            if (process.logsContainer) {
                process.logsContainer.innerHTML = '';
                process.logsContainer.style.display = 'none';
            }
            if (process.element) {
                process.element.section.className = 'process-section pending';
                process.element.icon.textContent = '⏳';
                process.element.time.textContent = '[00:00]';
                process.element.expandBtn.textContent = '▶';
                if (process.element.details) {
                    process.element.details.innerHTML = '';
                    process.element.details.style.display = 'none';
                }
            }
        });
        
        if (this.resultElements.roundWin && this.resultElements.roundWin.parentNode) {
            this.resultElements.roundWin.parentNode.removeChild(this.resultElements.roundWin);
        }
        if (this.resultElements.gameWin && this.resultElements.gameWin.parentNode) {
            this.resultElements.gameWin.parentNode.removeChild(this.resultElements.gameWin);
        }
        if (this.resultElements.gameDraw && this.resultElements.gameDraw.parentNode) {
            this.resultElements.gameDraw.parentNode.removeChild(this.resultElements.gameDraw);
        }
        
        this.resultElements = {
            roundWin: null,
            gameWin: null,
            gameDraw: null
        };
        
        this.roundWinner = null;
        this.gameWinner = null;
        this.isDraw = false;
        this.roundNumber = null;
        this.totalRounds = null;
        
        if (this.startButton) {
            this.startButton.style.display = 'block';
        }
        
        if (this.acceptButton) {
            this.acceptButton.disabled = true;
            this.acceptButton.textContent = 'Accept';
        }
        
        if (this.statusText) {
            this.statusText.textContent = 'Waiting to start...';
        }
        
        window.dispatchEvent(new CustomEvent('matchPopupVisibilityChange', {
            detail: { visible: false, canReopen: false }
        }));
    }

    reopen() {
        if (this.isActiveButHidden) {
            this.popup.style.display = 'flex';
            this.isActiveButHidden = false;
            
            window.dispatchEvent(new CustomEvent('matchPopupVisibilityChange', {
                detail: { visible: true, canReopen: false }
            }));
        }
    }

    getCleanMode() {
        return this.cleanMode;
    }
}

export const matchProcessPopup = new MatchProcessPopup();
window.matchProcessPopup = matchProcessPopup;

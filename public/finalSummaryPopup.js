const CSS = `.final-summary-popup {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.9);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10001;
}

.final-summary-content {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 16px;
    width: 90%;
    max-width: 900px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.8);
    border: 2px solid #4CAF50;
    position: relative;
    overflow: hidden;
    animation: popupAppear 0.4s ease-out;
}

@keyframes popupAppear {
    from {
        opacity: 0;
        transform: scale(0.8);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}

.final-summary-close {
    position: absolute;
    top: 15px;
    right: 15px;
    background: none;
    border: none;
    color: #888;
    font-size: 24px;
    cursor: pointer;
    z-index: 100;
    transition: color 0.2s;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.final-summary-close:hover {
    color: #4CAF50;
}

.final-summary-container {
    flex: 1;
    overflow-y: auto;
    padding: 0;
}

.summary-inner {
    display: flex;
    flex-direction: column;
    padding: 30px 25px;
    min-height: 100%;
}

.summary-header {
    text-align: center;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 2px solid rgba(76, 175, 80, 0.3);
    animation: slideDown 0.6s ease-out;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
}

.summary-header.draw {
    border-bottom: 2px solid rgba(128, 128, 128, 0.3);
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.summary-icon {
    font-size: 48px;
    animation: bounce 0.8s ease-out;
}

@keyframes bounce {
    0%, 100% {
        transform: translateY(0);
    }
    50% {
        transform: translateY(-15px);
    }
}

.summary-header-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}

.summary-header h1 {
    margin: 0;
    font-size: 36px;
    color: #4CAF50;
    text-shadow: 0 2px 10px rgba(76, 175, 80, 0.3);
}

.summary-header.draw h1 {
    color: #888;
    text-shadow: 0 2px 10px rgba(136, 136, 136, 0.3);
}

.summary-header p {
    margin: 5px 0 0 0;
    color: #aaa;
    font-size: 16px;
}

.ranking-container {
    animation: fadeIn 0.8s ease-out 0.2s both;
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

.ranking-title {
    text-align: center;
    font-size: 20px;
    color: #4CAF50;
    margin-bottom: 15px;
    text-transform: uppercase;
    letter-spacing: 2px;
}

.ranking-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.ranking-item {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 15px 18px;
    display: flex;
    align-items: center;
    gap: 18px;
    transition: all 0.3s ease;
    animation: slideIn 0.5s ease-out;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateX(-20px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

.ranking-item:nth-child(1) {
    animation-delay: 0.1s;
    background: rgba(255, 215, 0, 0.1);
    border-color: rgba(255, 215, 0, 0.3);
}

.ranking-item:nth-child(2) {
    animation-delay: 0.2s;
    background: rgba(192, 192, 192, 0.1);
    border-color: rgba(192, 192, 192, 0.3);
}

.ranking-item:nth-child(3) {
    animation-delay: 0.3s;
    background: rgba(205, 127, 50, 0.1);
    border-color: rgba(205, 127, 50, 0.3);
}

.ranking-item:nth-child(n+4) {
    animation-delay: 0.4s;
}

.ranking-item:hover {
    border-color: rgba(76, 175, 80, 0.4);
    background: rgba(76, 175, 80, 0.05);
    transform: translateX(5px);
}

.ranking-position {
    font-size: 28px;
    font-weight: bold;
    min-width: 50px;
    text-align: center;
    color: #4CAF50;
}

.ranking-item:nth-child(1) .ranking-position {
    color: #FFD700;
    text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.ranking-item:nth-child(2) .ranking-position {
    color: #C0C0C0;
    text-shadow: 0 0 10px rgba(192, 192, 192, 0.5);
}

.ranking-item:nth-child(3) .ranking-position {
    color: #CD7F32;
    text-shadow: 0 0 10px rgba(205, 127, 50, 0.5);
}

.ranking-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.ranking-team-name {
    font-size: 18px;
    font-weight: bold;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 8px;
}

.team-color-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-block;
}

.ranking-stats {
    display: flex;
    gap: 25px;
    align-items: center;
}

.ranking-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
}

.ranking-stat-label {
    font-size: 10px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.ranking-stat-value {
    font-size: 20px;
    font-weight: bold;
    color: #4CAF50;
}

.ranking-stat-value.issues {
    color: #ff9800;
}

.final-summary-container::-webkit-scrollbar {
    width: 8px;
}

.final-summary-container::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
}

.final-summary-container::-webkit-scrollbar-thumb {
    background: rgba(76, 175, 80, 0.4);
    border-radius: 4px;
}

.final-summary-container::-webkit-scrollbar-thumb:hover {
    background: rgba(76, 175, 80, 0.6);
}

@media (max-width: 768px) {
    .final-summary-content {
        width: 95%;
        max-height: 95vh;
    }
    
    .summary-inner {
        padding: 25px 18px;
    }
    
    .summary-header {
        flex-direction: column;
        gap: 10px;
    }
    
    .summary-header-text {
        align-items: center;
    }
    
    .summary-header h1 {
        font-size: 28px;
    }
    
    .summary-icon {
        font-size: 40px;
    }
    
    .ranking-item {
        flex-direction: column;
        text-align: center;
        gap: 12px;
    }
    
    .ranking-stats {
        flex-direction: column;
        gap: 12px;
    }
    
    .ranking-position {
        font-size: 24px;
    }
    
    .ranking-team-name {
        font-size: 16px;
        justify-content: center;
    }
}`;

export class FinalSummaryPopup {
    constructor() {
        this.popup = null;
        this.init();
    }

    init() {
        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        this.popup = document.createElement('div');
        this.popup.className = 'final-summary-popup';
        this.popup.style.display = 'none';
        
        const content = document.createElement('div');
        content.className = 'final-summary-content';
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'final-summary-close';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', () => this.hide());
        
        const container = document.createElement('div');
        container.className = 'final-summary-container';
        container.id = 'final-summary-container';
        
        content.appendChild(closeBtn);
        content.appendChild(container);
        
        this.popup.appendChild(content);
        document.body.appendChild(this.popup);
    }

    createSummaryContent(data) {
        const container = document.createElement('div');
        container.className = 'summary-inner';
        
        let summaryHtml = '';
        
        if (data.isDraw) {
            summaryHtml += `
                <div class="summary-header draw">
                    <div class="summary-icon">🤝</div>
                    <div class="summary-header-text">
                        <h1>DRAW!</h1>
                        <p>Multiple teams tied for first place</p>
                    </div>
                </div>
            `;
        } else {
            summaryHtml += `
                <div class="summary-header">
                    <div class="summary-icon">👑</div>
                    <div class="summary-header-text">
                        <h1>${data.winner} WINS!</h1>
                        <p>Winner Team</p>
                    </div>
                </div>
            `;
        }
        
        summaryHtml += `
            <div class="ranking-container">
                <div class="ranking-title">Final Ranking</div>
                <div class="ranking-list">
        `;
        
        if (data.ranking && Array.isArray(data.ranking)) {
            data.ranking.forEach(item => {
                summaryHtml += `
                    <div class="ranking-item">
                        <div class="ranking-position">#${item.rank}</div>
                        <div class="ranking-info">
                            <div class="ranking-team-name">
                                <span class="team-color-indicator" style="background-color: ${item.teamColor};"></span>
                                ${item.teamName}
                            </div>
                        </div>
                        <div class="ranking-stats">
                            <div class="ranking-stat">
                                <div class="ranking-stat-label">Position</div>
                                <div class="ranking-stat-value">${item.positionSum}</div>
                            </div>
                            <div class="ranking-stat">
                                <div class="ranking-stat-label">Issues</div>
                                <div class="ranking-stat-value issues">${item.issues}</div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
        
        summaryHtml += `
                </div>
            </div>
        `;
        
        container.innerHTML = summaryHtml;
        return container;
    }

    playVictorySound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const now = audioContext.currentTime;
            const notes = [523.25, 659.25, 783.99, 1046.5];
            const duration = 0.3;
            
            notes.forEach((freq, index) => {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                
                osc.connect(gain);
                gain.connect(audioContext.destination);
                
                osc.frequency.value = freq;
                osc.type = 'sine';
                
                const startTime = now + index * 0.15;
                gain.gain.setValueAtTime(0.3, startTime);
                gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
                
                osc.start(startTime);
                osc.stop(startTime + duration);
            });
        } catch (e) {
            console.log('Victory sound not available');
        }
    }

    show(data) {
        const container = this.popup.querySelector('#final-summary-container');
        container.innerHTML = '';
        container.appendChild(this.createSummaryContent(data));
        
        this.popup.style.display = 'flex';
        this.playVictorySound();
    }

    hide() {
        this.popup.style.display = 'none';
    }
}

export const finalSummaryPopup = new FinalSummaryPopup();
window.finalSummaryPopup = finalSummaryPopup;

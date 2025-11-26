import { teamStats } from './gameState.js';

let uiContainer = null;

function calculateFontSize(text, containerWidth) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const horizontalPadding = 80;
    const colorSquareWidth = 30;
    const maxWidth = containerWidth - horizontalPadding - colorSquareWidth;
    const baseSize = 28;
    let size = baseSize;

    ctx.font = `${size}px Arial`;
    let width = ctx.measureText(text).width;

    while (width > maxWidth && size > 10) {
        size -= 2;
        ctx.font = `${size}px Arial`;
        width = ctx.measureText(text).width;
    }

    return size;
}

export function initUI() {
    if (!uiContainer) {
        uiContainer = document.createElement('div');
        uiContainer.id = 'game-ui';
        document.getElementById('game-area').appendChild(uiContainer);
        
        const style = document.createElement('style');
        style.textContent = `
            #game-ui {
                position: absolute;
                top: 10px;
                left: 10px;
                right: 10px;
                z-index: 1000;
                pointer-events: none;
                display: flex;
                gap: 5px;
                padding: 0 10px;
                height: 55px;
            }

            .team-healthbar {
                flex: 1;
                height: 45px;
                background: #FF0000;
                border-radius: 4px;
                position: relative;
                overflow: hidden;
            }

            .team-healthbar-fill {
                height: 100%;
                background: #008800;
                transition: width 0.3s ease;
            }

            .team-healthbar-content {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 10px;
            }

            .team-info {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 3px;
            }

            .team-name {
                color: white;
                font-family: Arial;
                text-shadow: 2px 2px 2px rgba(0,0,0,0.5),
                            -2px -2px 2px rgba(0,0,0,0.5),
                            2px -2px 2px rgba(0,0,0,0.5),
                            -2px 2px 2px rgba(0,0,0,0.5);
            }

            .team-bottom {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .team-color {
                width: 20px;
                height: 20px;
                flex-shrink: 0;
            }

            .team-health {
                color: white;
                font-size: 14px;
                font-family: Arial;
                font-weight: bold;
                white-space: nowrap;
                text-shadow: 2px 2px 2px rgba(0,0,0,0.5),
                            -2px -2px 2px rgba(0,0,0,0.5),
                            2px -2px 2px rgba(0,0,0,0.5),
                            -2px 2px 2px rgba(0,0,0,0.5);
            }

            .vs-separator {
                font-size: 34px;
                color: white;
                font-family: Arial;
                font-weight: bold;
                flex-shrink: 0;
                padding: 0 5px;
                text-shadow: 2px 2px 2px rgba(0,0,0,0.5),
                            -2px -2px 2px rgba(0,0,0,0.5),
                            2px -2px 2px rgba(0,0,0,0.5),
                            -2px 2px 2px rgba(0,0,0,0.5);
                line-height: 45px;
            }
        `;
        document.head.appendChild(style);
    }
}

export function updateUI() {
    if (!uiContainer) return;

    const teamArray = Array.from(teamStats.entries());
    const containerWidth = (uiContainer.offsetWidth - (teamArray.length - 1) * 50) / teamArray.length;
    
    uiContainer.innerHTML = teamArray.map(([teamId, team], index) => {
        const truncatedName = team.name.length > 12 ? team.name.substring(0, 12) : team.name;
        const fontSize = calculateFontSize(truncatedName, containerWidth);
        return `
            <div class="team-healthbar">
                <div class="team-healthbar-fill" style="width: ${(team.currentHealth / team.totalHealth) * 100}%"></div>
                <div class="team-healthbar-content">
                    <div class="team-info">
                        <span class="team-name" style="font-size: ${fontSize}px">${truncatedName}</span>
                        <div class="team-bottom">
                            <div class="team-color" style="background-color: ${team.color}"></div>
                            <span class="team-health">${Math.floor(team.currentHealth)}/${team.totalHealth}</span>
                        </div>
                    </div>
                </div>
            </div>
            ${index < teamArray.length - 1 ? '<div class="vs-separator">VS</div>' : ''}
        `;
    }).join('');
}

export function clearUI() {
    if (uiContainer) {
        uiContainer.innerHTML = '';
    }
}

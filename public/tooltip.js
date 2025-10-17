export const tooltipStyles = `
    .unit-tooltip {
        position: fixed;
        z-index: 10000;
        background: rgba(15, 23, 42, 0.95);
        border-radius: 8px;
        padding: 16px;
        font-size: 14px;
        color: #fff;
        width: 300px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 
                    0 2px 4px -1px rgba(0, 0, 0, 0.06);
        pointer-events: none;
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        left: 10px;
        bottom: 10px;
    }

    .unit-tooltip h3 {
        color: #4CAF50;
        margin: 0 0 12px 0;
        font-size: 18px;
        font-weight: bold;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding-bottom: 8px;
    }

    .unit-health-bar {
        width: 100%;
        height: 20px;
        background: rgba(255, 0, 0, 0.3);
        border-radius: 4px;
        margin-bottom: 12px;
        position: relative;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .unit-health-fill {
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        background: rgba(0, 255, 0, 0.5);
        transition: width 0.3s ease;
        z-index: 1;
    }

    .unit-health-text {
        color: white;
        font-size: 12px;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
        z-index: 2;
        mix-blend-mode: difference;
    }

    .unit-tooltip p {
        color: #94a3b8;
        margin: 0 0 12px 0;
        line-height: 1.5;
    }

    .unit-tooltip-section {
        margin: 16px 0;
    }

    .unit-tooltip-section h4 {
        color: #4CAF50;
        margin: 0 0 8px 0;
        font-size: 14px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .unit-tooltip-stats {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
    }

    .unit-tooltip-stat {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        position: relative;
    }

    .unit-tooltip-stat i {
        color: #4CAF50;
        width: 16px;
        text-align: center;
    }

    .unit-tooltip-stat span {
        color: #e2e8f0;
    }

    .stat-increased {
        color: #4CAF50;
        margin-left: 4px;
    }

    .stat-decreased {
        color: #f44336;
        margin-left: 4px;
    }

    .unit-tooltip-stat .stat-main-info {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .unit-tooltip-list {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .unit-tooltip-list li {
        background: rgba(76, 175, 80, 0.1);
        color: #4CAF50;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .unit-tooltip-list li i {
        font-size: 10px;
    }

    .unit-tooltip-attack {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        padding: 8px;
        margin-top: 8px;
    }

    .unit-tooltip-attack-stats {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 6px;
        margin-top: 6px;
    }

    .unit-tooltip-attack-stat {
        font-size: 12px;
        color: #94a3b8;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .unit-tooltip-attack-stat i {
        color: #4CAF50;
    }

    .active-effects {
        margin-top: 16px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        padding: 12px;
    }

    .active-effects h4 {
        color: #4CAF50;
        margin: 0 0 12px 0;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
    }

    .active-effects-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .active-effect {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        background: rgba(255, 255, 255, 0.03);
        padding: 6px;
        border-radius: 4px;
    }

    .active-effect i {
        color: #4CAF50;
        font-size: 12px;
        margin-top: 2px;
    }

    .effect-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .effect-name {
        color: #e2e8f0;
        font-size: 12px;
    }

    .effect-duration {
        color: #94a3b8;
        font-size: 10px;
    }

    .effect-value {
        color: #4CAF50;
        font-size: 11px;
    }

    .active-skills {
        margin-top: 16px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        padding: 12px;
    }

    .active-skills h4 {
        color: #4CAF50;
        margin: 0 0 12px 0;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
    }

    .active-skills-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .active-skill {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        background: rgba(255, 255, 255, 0.03);
        padding: 6px;
        border-radius: 4px;
    }

    .active-skill i {
        color: #4CAF50;
        font-size: 12px;
        margin-top: 2px;
    }

    .skill-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .skill-name {
        color: #e2e8f0;
        font-size: 12px;
    }

    .skill-duration {
        color: #94a3b8;
        font-size: 10px;
    }

    .skill-effect {
        color: #4CAF50;
        font-size: 11px;
    }
`;

export const tooltipTemplates = {
    statsSection: (stats) => `
        <div class="unit-tooltip-section">
            <h4><i class="fas fa-chart-bar"></i>Stats</h4>
            <div class="unit-tooltip-stats">
                ${stats}
            </div>
        </div>
    `,

    healthBar: (health, maxHealth) => `
        <div class="unit-health-bar">
            <div class="unit-health-fill" style="width: ${(health / maxHealth) * 100}%"></div>
            <div class="unit-health-text">${Math.floor(health)}/${maxHealth}</div>
        </div>
    `,

    meleeAttack: (range, rangeModified, speed, speedModified) => `
        <div class="unit-tooltip-attack">
            <h4><i class="fas fa-sword"></i>Melee Attack</h4>
            <div class="unit-tooltip-attack-stats">
                <div class="unit-tooltip-attack-stat">
                    <i class="fas fa-ruler"></i>
                    Range: ${range}${rangeModified || ''}
                </div>
                <div class="unit-tooltip-attack-stat">
                    <i class="fas fa-clock"></i>
                    Speed: ${speed}${speedModified || ''}ms
                </div>
            </div>
        </div>
    `,

    rangedAttack: (range, speed, minInterval, maxInterval) => `
        <div class="unit-tooltip-attack">
            <h4><i class="fas fa-bow-arrow"></i>Ranged Attack</h4>
            <div class="unit-tooltip-attack-stats">
                <div class="unit-tooltip-attack-stat">
                    <i class="fas fa-crosshairs"></i>
                    Range: ${range}
                </div>
                <div class="unit-tooltip-attack-stat">
                    <i class="fas fa-tachometer-alt"></i>
                    Projectile Speed: ${speed}
                </div>
                <div class="unit-tooltip-attack-stat">
                    <i class="fas fa-clock"></i>
                    Interval: ${minInterval}-${maxInterval}ms
                </div>
            </div>
        </div>
    `,

    activeEffects: (effects) => `
        <div class="active-effects">
            <h4><i class="fas fa-magic"></i>Active Effects</h4>
            <div class="active-effects-list">
                ${effects}
            </div>
        </div>
    `,

    activeSkills: (skills) => `
        <div class="active-skills">
            <h4><i class="fas fa-star"></i>Active Skill Effects</h4>
            <div class="active-skills-list">
                ${skills}
            </div>
        </div>
    `,

    skillsSection: (skills) => `
        <div class="unit-tooltip-section">
            <h4><i class="fas fa-star"></i>Skills</h4>
            <ul class="unit-tooltip-list">
                ${skills}
            </ul>
        </div>
    `,

    effectsSection: (effects) => `
        <div class="unit-tooltip-section">
            <h4><i class="fas fa-magic"></i>Effects</h4>
            <ul class="unit-tooltip-list">
                ${effects}
            </ul>
        </div>
    `,

    soundsSection: (sounds) => `
        <div class="unit-tooltip-section">
            <h4><i class="fas fa-volume-up"></i>Custom Sounds</h4>
            <ul class="unit-tooltip-list">
                ${sounds}
            </ul>
        </div>
    `
};
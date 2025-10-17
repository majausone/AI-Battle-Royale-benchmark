import { tooltipStyles, tooltipTemplates } from './tooltip.js';
import { getModifiedStat } from './gameState.js';

class UnitTooltip {
    constructor() {
        if (UnitTooltip.instance) {
            return UnitTooltip.instance;
        }
        UnitTooltip.instance = this;
        this.createTooltip();
        this.setupEventListeners();
        this.updateInterval = null;
    }

    setupEventListeners() {
        window.addEventListener('showUnitTooltip', (e) => {
            const { unit, unitData } = e.detail;
            this.currentUnit = unit;
            this.currentUnitData = unitData;
            this.showUnit(unit, unitData);
            
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
            }
            this.updateInterval = setInterval(() => {
                if (this.currentUnit && this.currentUnitData) {
                    this.showUnit(this.currentUnit, this.currentUnitData);
                }
            }, 100);
        });

        window.addEventListener('hideUnitTooltip', () => {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }
            this.currentUnit = null;
            this.currentUnitData = null;
            this.hide();
        });
    }

    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'unit-tooltip';
        this.tooltip.style.display = 'none';
        document.body.appendChild(this.tooltip);

        const style = document.createElement('style');
        style.textContent = tooltipStyles;
        document.head.appendChild(style);
    }

    showUnit(unit, unitData) {
        const healthBar = unit ? tooltipTemplates.healthBar(unit.health, unit.maxHealth) : '';
        
        this.tooltip.innerHTML = `
            <h3>${unitData.name}</h3>
            ${healthBar}
            <p>${unitData.description}</p>
            ${this.createStatsSection(unit, unitData)}
            ${this.createActiveEffectsSection(unit)}
            ${this.createActiveSkillsSection(unit)}
            ${this.createAttackInfo(unit, unitData)}
            ${this.createSkillsSection(unitData)}
            ${this.createEffectsSection(unitData)}
            ${this.createSoundsSection(unitData)}
        `;

        this.tooltip.style.display = 'block';
    }

    show(event, unitData) {
        this.tooltip.innerHTML = `
            <h3>${unitData.name}</h3>
            <p>${unitData.description}</p>
            ${this.createStatsSection(null, unitData)}
            ${this.createAttackInfo(null, unitData)}
            ${this.createSkillsSection(unitData)}
            ${this.createEffectsSection(unitData)}
            ${this.createSoundsSection(unitData)}
        `;

        this.tooltip.style.display = 'block';
    }

    getActiveEffectsForStat(unit, stat) {
        if (!unit?.activeEffects) return [];
        return Array.from(unit.activeEffects.entries())
            .filter(([_, effect]) => effect.stat === stat && !effect.fromSkill)
            .map(([id, effect]) => ({
                id,
                effect
            }));
    }

    getActiveSkillEffectsForStat(unit, stat) {
        if (!unit?.activeEffects) return [];
        return Array.from(unit.activeEffects.entries())
            .filter(([_, effect]) => effect.stat === stat && effect.fromSkill)
            .map(([id, effect]) => ({
                id,
                effect
            }));
    }

    createStatsSection(unit, unitData) {
        const stats = [
            { icon: 'heart', name: 'Health', stat: 'health', value: unit ? unit.health : unitData.life },
            { icon: 'bolt', name: 'Speed', stat: 'speed', value: unitData.speed },
            { icon: 'fist-raised', name: 'Damage', stat: 'damage', value: unitData.damage },
            { icon: 'coins', name: 'Cost', value: unitData.cost }
        ];

        const statsHtml = stats.map(stat => {
            let modifiedInfo = '';
            if (unit && stat.stat && stat.stat !== 'health') {
                try {
                    const currentValue = getModifiedStat(unit, stat.stat);
                    if (currentValue !== stat.value) {
                        const colorClass = currentValue > stat.value ? 'stat-increased' : 'stat-decreased';
                        modifiedInfo = `<span class="${colorClass}">(${currentValue})</span>`;
                    }
                } catch (error) {
                    console.error(`Error getting modified stat ${stat.stat}:`, error);
                }
            }
            return `
                <div class="unit-tooltip-stat">
                    <div class="stat-main-info">
                        <i class="fas fa-${stat.icon}"></i>
                        <span>${stat.name}: ${stat.value}${modifiedInfo}</span>
                    </div>
                </div>
            `;
        }).join('');

        return tooltipTemplates.statsSection(statsHtml);
    }

    createActiveEffectsSection(unit) {
        if (!unit || !unit.activeEffects) return '';

        const effects = Array.from(unit.activeEffects.entries())
            .filter(([_, effect]) => !effect.fromSkill)
            .map(([id, effect]) => {
                const duration = effect.duration === -1 ? 'Permanent' : 
                               `${Math.max(0, Math.ceil((effect.startTime + effect.duration - Date.now()) / 1000))}s`;
                
                let effectInfo = `${this.formatName(id)}`;
                if (effect.stat && effect.stat !== 'health') {
                    const originalValue = effect.originalValue || 0;
                    if (effect.value) {
                        effectInfo += ` (${effect.value > 0 ? '+' : ''}${effect.value})`;
                    } else if (effect.apply && originalValue) {
                        const modifiedValue = effect.apply(originalValue);
                        const colorClass = modifiedValue > originalValue ? 'stat-increased' : 'stat-decreased';
                        effectInfo += ` <span class="${colorClass}">${modifiedValue}</span>`;
                    }
                }
                
                return `
                    <div class="active-effect">
                        <i class="fas fa-magic"></i>
                        <div class="effect-info">
                            <span class="effect-name">${effectInfo}</span>
                            <span class="effect-duration">${duration}</span>
                        </div>
                    </div>
                `;
            }).join('');

        return effects ? tooltipTemplates.activeEffects(effects) : '';
    }

    createActiveSkillsSection(unit) {
        if (!unit || !unit.activeEffects) return '';

        const skillEffects = Array.from(unit.activeEffects.entries())
            .filter(([_, effect]) => effect.fromSkill)
            .map(([id, effect]) => {
                const duration = effect.duration === -1 ? 'Permanent' : 
                               `${Math.max(0, Math.ceil((effect.startTime + effect.duration - Date.now()) / 1000))}s`;
                
                let effectInfo = `${this.formatName(id)}`;
                if (effect.stat && effect.stat !== 'health') {
                    const originalValue = effect.originalValue || 0;
                    if (effect.value) {
                        effectInfo += ` (${effect.value > 0 ? '+' : ''}${effect.value})`;
                    } else if (effect.apply && originalValue) {
                        const modifiedValue = effect.apply(originalValue);
                        const colorClass = modifiedValue > originalValue ? 'stat-increased' : 'stat-decreased';
                        effectInfo += ` <span class="${colorClass}">${modifiedValue}</span>`;
                    }
                }
                
                return `
                    <div class="active-skill">
                        <i class="fas fa-star"></i>
                        <div class="skill-info">
                            <span class="skill-name">${effectInfo}</span>
                            <span class="skill-duration">${duration}</span>
                        </div>
                    </div>
                `;
            }).join('');

        return skillEffects ? tooltipTemplates.activeSkills(skillEffects) : '';
    }

    createAttackInfo(unit, unitData) {
        if (unitData.attackType === 'melee') {
            let range = unitData.attackRange;
            let speed = unitData.attackSpeed;
            let rangeModified = '';
            let speedModified = '';

            if (unit) {
                try {
                    const currentRange = getModifiedStat(unit, 'attackRange');
                    const currentSpeed = getModifiedStat(unit, 'attackSpeed');
                    
                    if (!isNaN(currentRange) && currentRange !== range) {
                        const rangeClass = currentRange > range ? 'stat-increased' : 'stat-decreased';
                        rangeModified = `<span class="${rangeClass}">(${currentRange})</span>`;
                    }
                    
                    if (!isNaN(currentSpeed) && currentSpeed !== speed) {
                        const speedClass = currentSpeed > speed ? 'stat-increased' : 'stat-decreased';
                        speedModified = `<span class="${speedClass}">(${currentSpeed})</span>`;
                    }
                } catch (error) {
                    console.error('Error getting modified attack stats:', error);
                }
            }

            return tooltipTemplates.meleeAttack(range, rangeModified, speed, speedModified);
        } else if (unitData.attackType === 'ranged') {
            return tooltipTemplates.rangedAttack(
                unitData.optimalRange,
                unitData.projectileSpeed,
                unitData.attackInterval.min,
                unitData.attackInterval.max
            );
        }
        return '';
    }

    createSkillsSection(unitData) {
        if (!unitData.skills || unitData.skills.length === 0) return '';

        const skills = unitData.skills.map(skill => `
            <li><i class="fas fa-star"></i>${this.formatName(skill)}</li>
        `).join('');

        return tooltipTemplates.skillsSection(skills);
    }

    createEffectsSection(unitData) {
        if (!unitData.effects) return '';

        const effects = Object.keys(unitData.effects).map(effect => `
            <li><i class="fas fa-sparkles"></i>${this.formatName(effect)}</li>
        `).join('');

        return tooltipTemplates.effectsSection(effects);
    }

    createSoundsSection(unitData) {
        if (!unitData.sounds) return '';

        const sounds = Object.keys(unitData.sounds).map(sound => `
            <li><i class="fas fa-music"></i>${this.formatName(sound)}</li>
        `).join('');

        return tooltipTemplates.soundsSection(sounds);
    }

    hide() {
        this.tooltip.style.display = 'none';
    }

    formatName(str) {
        return str
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }
}

export const unitTooltip = new UnitTooltip();
import { tooltipStyles, tooltipTemplates } from './tooltip.js';
import { getModifiedStat } from './gameState.js';
import { loadedSkills, loadedSkillEffects, getEffect, getSkillEffect } from './unitLoader.js';

class UnitTooltip {
    constructor() {
        if (UnitTooltip.instance) {
            return UnitTooltip.instance;
        }
        UnitTooltip.instance = this;
        this.createTooltip();
        this.setupEventListeners();
        this.updateInterval = null;
        this.lastUnitId = null;
    }

    setupEventListeners() {
        window.addEventListener('showUnitTooltip', (e) => {
            const { unit, unitData } = e.detail;

            // Check if we need to re-render static content
            const unitId = unit ? unit.id : (unitData.name + unitData.description); // Fallback for previews
            if (this.lastUnitId !== unitId) {
                this.renderStatic(unitData);
                this.lastUnitId = unitId;
            }

            this.currentUnit = unit;
            this.currentUnitData = unitData;
            this.updateDynamic(unit, unitData);

            this.tooltip.style.display = 'block';

            if (this.updateInterval) {
                clearInterval(this.updateInterval);
            }
            this.updateInterval = setInterval(() => {
                if (this.currentUnit && this.currentUnitData) {
                    this.updateDynamic(this.currentUnit, this.currentUnitData);
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
            this.lastUnitId = null;
            this.hide();
            if (this.detailsBox) {
                this.detailsBox.style.display = 'none';
            }
        });
    }

    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'unit-tooltip';
        this.tooltip.style.display = 'none';

        // Create granular structure
        this.tooltip.innerHTML = `
            <div class="tooltip-close-btn"><i class="fas fa-times"></i></div>
            <div class="tooltip-header"></div>
            <div class="tooltip-health"></div>
            <div class="tooltip-desc"></div>
            <div class="tooltip-stats"></div>
            <div class="tooltip-active-effects"></div>
            <div class="tooltip-active-skills"></div>
            <div class="tooltip-attack"></div>
            <div class="tooltip-skills"></div>
            <!-- Effects section removed as per user request -->
            <div class="tooltip-sounds"></div>
        `;

        document.body.appendChild(this.tooltip);

        this.detailsBox = document.createElement('div');
        this.detailsBox.className = 'details-box';
        this.detailsBox.style.display = 'none';
        document.body.appendChild(this.detailsBox);

        const style = document.createElement('style');
        style.textContent = tooltipStyles + `
            .unit-tooltip {
                position: fixed;
                bottom: 20px;
                left: 20px;
                z-index: 10000;
                pointer-events: auto; 
            }
            .tooltip-close-btn {
                position: absolute;
                top: 5px;
                right: 10px;
                color: #aaa;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                z-index: 10002;
                transition: color 0.2s;
            }
            .tooltip-close-btn:hover {
                color: #fff;
            }
            .details-box {
                position: fixed;
                background: rgba(0, 0, 0, 0.95);
                border: 1px solid #4CAF50;
                border-radius: 4px;
                padding: 10px;
                color: white;
                z-index: 10001;
                max-width: 300px;
                font-family: Arial, sans-serif;
                box-shadow: 0 0 10px rgba(0,0,0,0.5);
            }
            .details-box h4 {
                margin: 0 0 5px 0;
                color: #4CAF50;
                border-bottom: 1px solid #333;
                padding-bottom: 5px;
            }
            .details-box pre {
                white-space: pre-wrap;
                word-wrap: break-word;
                font-family: monospace;
                font-size: 11px;
                color: #aaffaa;
                margin: 0;
                max-height: 200px;
                overflow-y: auto;
            }
            .clickable-detail {
                cursor: pointer;
                transition: color 0.2s;
                position: relative;
                text-decoration: underline;
                text-decoration-style: dotted;
                text-decoration-color: #666;
            }
            .clickable-detail:hover {
                color: #4CAF50;
                text-decoration-color: #4CAF50;
            }
        `;
        document.head.appendChild(style);

        // Attach permanent event listeners (Event Delegation)
        this.tooltip.addEventListener('click', (e) => {
            // Handle Close Button
            if (e.target.closest('.tooltip-close-btn')) {
                e.stopPropagation();
                window.dispatchEvent(new Event('deselectUnit'));
                return;
            }

            // Handle Clickable Details
            const clickable = e.target.closest('.clickable-detail');
            if (clickable) {
                e.stopPropagation();
                const type = clickable.dataset.type;
                const id = clickable.dataset.id;
                this.showDetails(type, id);
            }
        });

        // Close details box when clicking outside
        document.addEventListener('click', (e) => {
            if (this.detailsBox &&
                this.detailsBox.style.display === 'block' &&
                !this.detailsBox.contains(e.target) &&
                !e.target.closest('.clickable-detail')) {
                this.detailsBox.style.display = 'none';
            }
        });
    }

    renderStatic(unitData) {
        this.tooltip.querySelector('.tooltip-header').innerHTML = `<h3>${unitData.name}</h3>`;
        this.tooltip.querySelector('.tooltip-desc').innerHTML = `<p>${unitData.description}</p>`;
        this.tooltip.querySelector('.tooltip-skills').innerHTML = this.createSkillsSection(unitData);
        // Effects section removed
        this.tooltip.querySelector('.tooltip-sounds').innerHTML = this.createSoundsSection(unitData);
    }

    updateDynamic(unit, unitData) {
        // Health
        const healthBar = unit ? tooltipTemplates.healthBar(unit.health, unit.maxHealth) : '';
        this.tooltip.querySelector('.tooltip-health').innerHTML = healthBar;

        // Stats
        this.tooltip.querySelector('.tooltip-stats').innerHTML = this.createStatsSection(unit, unitData);

        // Active Effects (Smart Update)
        const activeEffects = unit && unit.activeEffects ? Array.from(unit.activeEffects.entries()).filter(([_, effect]) => !effect.fromSkill) : [];
        this.updateActiveSection('active-effects', activeEffects, false);

        // Active Skills (Smart Update)
        const activeSkills = unit && unit.activeEffects ? Array.from(unit.activeEffects.entries()).filter(([_, effect]) => effect.fromSkill) : [];
        this.updateActiveSection('active-skills', activeSkills, true);

        // Attack Info (depends on unit stats)
        this.tooltip.querySelector('.tooltip-attack').innerHTML = this.createAttackInfo(unit, unitData);
    }

    updateActiveSection(containerClass, items, isSkill) {
        const placeholderEl = this.tooltip.querySelector(`.tooltip-${containerClass}`);
        if (!placeholderEl) return;

        if (!items || items.length === 0) {
            placeholderEl.innerHTML = '';
            return;
        }

        // Check if the inner wrapper exists
        let innerWrapper = placeholderEl.querySelector(`.${containerClass}`);
        if (!innerWrapper) {
            // Create the wrapper using template
            const template = isSkill ? tooltipTemplates.activeSkills('') : tooltipTemplates.activeEffects('');
            placeholderEl.innerHTML = template;
            innerWrapper = placeholderEl.querySelector(`.${containerClass}`);
        }

        const listContainer = innerWrapper.querySelector(`.${containerClass}-list`);
        if (!listContainer) return;

        // Now sync items
        const currentElements = new Map();
        listContainer.querySelectorAll('.clickable-detail').forEach(el => {
            currentElements.set(el.dataset.id, el);
        });

        const newIds = new Set();

        items.forEach(([id, effect]) => {
            newIds.add(id);
            const duration = effect.duration === -1 ? 'Permanent' :
                `${Math.max(0, Math.ceil((effect.startTime + effect.duration - Date.now()) / 1000))}s`;

            let effectInfo = this.formatName(id);
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

            let el = currentElements.get(id);
            if (el) {
                // Update existing
                const durationEl = el.querySelector(isSkill ? '.skill-duration' : '.effect-duration');
                if (durationEl && durationEl.textContent !== duration) {
                    durationEl.textContent = duration;
                }

                const nameEl = el.querySelector(isSkill ? '.skill-name' : '.effect-name');
                if (nameEl && nameEl.innerHTML !== effectInfo) {
                    nameEl.innerHTML = effectInfo;
                }
            } else {
                // Create new
                const newEl = document.createElement('div');
                newEl.className = isSkill ? "active-skill clickable-detail" : "active-effect clickable-detail";
                newEl.dataset.type = isSkill ? "seffect" : "effect";
                newEl.dataset.id = id;
                newEl.innerHTML = `
                    <i class="fas fa-${isSkill ? 'star' : 'magic'}"></i>
                    <div class="${isSkill ? 'skill-info' : 'effect-info'}">
                        <span class="${isSkill ? 'skill-name' : 'effect-name'}">${effectInfo}</span>
                        <span class="${isSkill ? 'skill-duration' : 'effect-duration'}">${duration}</span>
                    </div>
                `;
                listContainer.appendChild(newEl);
            }
        });

        // Remove old
        currentElements.forEach((el, id) => {
            if (!newIds.has(id)) {
                el.remove();
            }
        });
    }

    // Kept for compatibility if called directly, though setupEventListeners handles the logic now
    showUnit(unit, unitData) {
        this.renderStatic(unitData);
        this.updateDynamic(unit, unitData);
        this.tooltip.style.display = 'block';
    }

    show(event, unitData) {
        this.renderStatic(unitData);
        this.updateDynamic(null, unitData);
        this.tooltip.style.display = 'block';
    }

    showDetails(type, id) {
        let content = '';
        let title = '';

        if (type === 'skill') {
            const skill = loadedSkills.get(id);
            if (skill) {
                title = skill.metadata?.name || id;
                content = `<p>${skill.metadata?.description || 'No description available.'}</p>`;
                if (skill.metadata?.seffects) {
                    content += `<div style="margin-top:5px; font-size:0.9em; color:#aaa;">Effect: ${skill.metadata.seffects}</div>`;
                }
            } else {
                title = id;
                content = '<p>Skill data not found.</p>';
            }
        } else if (type === 'effect' || type === 'seffect') {
            const effect = type === 'seffect' ? loadedSkillEffects.get(id) : getEffect(id);
            title = id;
            if (effect) {
                const data = effect.default || effect;
                content = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
            } else {
                content = '<p>Effect data not found.</p>';
            }
        }

        this.detailsBox.innerHTML = `<h4>${this.formatName(title)}</h4>${content}`;
        this.detailsBox.style.display = 'block';

        const tooltipRect = this.tooltip.getBoundingClientRect();
        this.detailsBox.style.left = tooltipRect.left + 'px';
        this.detailsBox.style.bottom = (window.innerHeight - tooltipRect.top + 10) + 'px';
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
            <li class="clickable-detail" data-type="skill" data-id="${skill}"><i class="fas fa-star"></i>${this.formatName(skill)}</li>
        `).join('');

        return tooltipTemplates.skillsSection(skills);
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
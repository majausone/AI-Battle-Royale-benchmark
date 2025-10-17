import { loadedSkills, loadedSkillEffects, getEffect } from './unitLoader.js';
import { playConfigSound } from './soundManagerCode.js';

export class SkillsPopup {
    constructor() {
        if (SkillsPopup.instance) {
            return SkillsPopup.instance;
        }
        SkillsPopup.instance = this;
        this.element = null;
        this.currentSkill = null;
        this.metadata = null;
        this.init();
    }

    init() {
        this.element = document.createElement('div');
        this.element.className = 'skills-popup';
        this.element.innerHTML = `
            <div class="skills-popup-overlay">
                <div class="skills-popup-content">
                    <div class="skills-popup-header">
                        <h2>Skills Manager</h2>
                        <button class="close-button"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="skills-popup-body">
                        <div class="skills-column">
                            <div class="skills-search">
                                <input type="text" placeholder="Search skills..." class="search-input">
                            </div>
                            <div class="skills-list"></div>
                        </div>
                        <div class="skill-code-column">
                            <h3>Code</h3>
                            <pre class="skill-code"></pre>
                        </div>
                        <div class="info-column">
                            <h3>Info</h3>
                            <div class="info-content">
                                <div class="info-section"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.element);
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.element.querySelector('.close-button').addEventListener('click', () => {
            this.hide();
        });

        const searchInput = this.element.querySelector('.search-input');
        searchInput.addEventListener('input', (e) => {
            this.filterSkills(e.target.value);
        });
    }

    filterSkills(searchTerm) {
        const skillsList = this.element.querySelector('.skills-list');
        const skills = Array.from(loadedSkills.entries());

        skillsList.innerHTML = '';

        skills.filter(([id, skill]) => 
            skill.metadata && skill.metadata.name && skill.metadata.name.toLowerCase().includes(searchTerm.toLowerCase())
        ).forEach(([id, skill]) => {
            const skillElement = document.createElement('div');
            skillElement.className = 'skill-item';
            if (this.currentSkill === id) {
                skillElement.classList.add('selected');
            }
            skillElement.textContent = skill.metadata.name;

            skillElement.addEventListener('click', async () => {
                this.currentSkill = id;
                await this.showSkillCode(id, skill);
                this.showGeneralInfo();
                this.element.querySelectorAll('.skill-item').forEach(item => {
                    item.classList.remove('selected');
                });
                skillElement.classList.add('selected');
            });

            skillsList.appendChild(skillElement);
        });
    }

    async showSkillCode(skillName, skillCode) {
        const skillCodePre = this.element.querySelector('.skill-code');
        try {
            const response = await fetch(`/skills/${skillName}.js`);
            const fullCode = await response.text();
            const classStartIndex = fullCode.indexOf('class');
            if (classStartIndex !== -1) {
                skillCodePre.textContent = fullCode.substring(classStartIndex);
            } else {
                skillCodePre.textContent = fullCode;
            }
        } catch (error) {
            skillCodePre.textContent = skillCode.toString();
        }
    }

    showGeneralInfo() {
        const content = this.element.querySelector('.info-content');
        const skill = loadedSkills.get(this.currentSkill);
        if (!skill || !skill.metadata) {
            content.innerHTML = '<div class="info-section"><p>No metadata available</p></div>';
            return;
        }

        let html = `
            <div class="info-section">
                <h4>${skill.metadata.name}</h4>
                <div class="info-grid">
                    <div class="info-item">
                        <i class="fas fa-align-left"></i>
                        <span>${skill.metadata.description}</span>
                    </div>
                </div>
            </div>`;

        if (skill.metadata.seffects) {
            const effect = loadedSkillEffects.get(skill.metadata.seffects);
            html += `
                <div class="info-section">
                    <h4><i class="fas fa-bolt"></i> Skill Effects</h4>
                    <div class="effect-list">
                        <div class="effect-item" data-effect="${skill.metadata.seffects}">
                            <h5>
                                <i class="fas fa-bolt"></i>
                                ${this.formatName(skill.metadata.seffects)}
                            </h5>
                            <div class="effect-details">
                                <div>Duration: ${effect.duration}ms</div>
                                <div>Affects: ${effect.stat}</div>
                                <div>Value: ${effect.value}</div>
                                ${effect.tick ? `<div>Tick: ${effect.tick}ms</div>` : ''}
                            </div>
                            <pre class="seffect-code">${JSON.stringify(effect, null, 2)}</pre>
                        </div>
                    </div>
                </div>`;
        }

        if (skill.metadata.fx) {
            html += `
                <div class="info-section">
                    <h4><i class="fas fa-magic"></i> Visual Effects</h4>
                    <div class="fx-list">`;

            Object.entries(skill.metadata.fx).forEach(([type, fx]) => {
                if (fx) {
                    const effectId = fx.split('.')[0];
                    html += `
                        <div class="fx-item" data-fx="${effectId}">
                            <i class="fas fa-star"></i>
                            <span>${this.formatName(type)}: ${effectId}</span>
                        </div>`;
                }
            });

            if (Object.values(skill.metadata.fx).every(fx => !fx)) {
                html += `<p>No visual effects for this skill</p>`;
            }

            html += `</div></div>`;
        }

        if (skill.metadata.radius) {
            html += `
                <div class="info-section">
                    <h4><i class="fas fa-circle-notch"></i> Radius</h4>
                    <div class="info-grid">
                        <div class="info-item">
                            <i class="fas fa-ruler"></i>
                            <span>${skill.metadata.radius}</span>
                        </div>
                    </div>
                </div>`;
        }

        if (skill.metadata.trigger) {
            html += `
                <div class="info-section">
                    <h4><i class="fas fa-bolt"></i> Triggers</h4>
                    <div class="info-grid">`;

            Object.entries(skill.metadata.trigger).forEach(([key, value]) => {
                if (value) {
                    html += `
                        <div class="info-item">
                            <i class="fas fa-clock"></i>
                            <span>${this.formatName(key)}: ${value}</span>
                        </div>`;
                }
            });

            html += `</div></div>`;
        }

        if (skill.metadata.targetType) {
            html += `
                <div class="info-section">
                    <h4><i class="fas fa-crosshairs"></i> Target Type</h4>
                    <div class="info-grid">`;

            Object.entries(skill.metadata.targetType).forEach(([key, value]) => {
                if (value) {
                    html += `
                        <div class="info-item">
                            <i class="fas fa-bullseye"></i>
                            <span>${this.formatName(key)}</span>
                        </div>`;
                }
            });

            html += `</div></div>`;
        }

        if (skill.metadata.targetTeam) {
            html += `
                <div class="info-section">
                    <h4><i class="fas fa-users"></i> Target Team</h4>
                    <div class="info-grid">`;

            Object.entries(skill.metadata.targetTeam).forEach(([key, value]) => {
                if (value) {
                    html += `
                        <div class="info-item">
                            <i class="fas fa-user-friends"></i>
                            <span>${this.formatName(key)}</span>
                        </div>`;
                }
            });

            html += `</div></div>`;
        }

        if (skill.metadata.spawnUnits) {
            html += `
                <div class="info-section">
                    <h4><i class="fas fa-plus"></i> Spawn Units</h4>
                    <div class="info-grid">
                        <div class="info-item">
                            <i class="fas fa-check"></i>
                            <span>Can spawn units</span>
                        </div>
                    </div>
                </div>`;
        }

        if (skill.metadata.sounds) {
            html += `
                <div class="info-section">
                    <h4><i class="fas fa-volume-up"></i> Sounds</h4>
                    <div class="info-grid">`;

            if (skill.metadata.sounds.start) {
                html += `
                    <div class="info-item">
                        <i class="fas fa-play"></i>
                        <span>On Start</span>
                        <button class="play-sound-btn" data-sound-type="start">
                            <i class="fas fa-volume-up"></i>
                        </button>
                    </div>`;
            }
            
            if (skill.metadata.sounds.end) {
                html += `
                    <div class="info-item">
                        <i class="fas fa-stop"></i>
                        <span>On End</span>
                        <button class="play-sound-btn" data-sound-type="end">
                            <i class="fas fa-volume-up"></i>
                        </button>
                    </div>`;
            }

            html += `</div></div>`;
        }

        content.innerHTML = html;

        content.querySelectorAll('.effect-item').forEach(item => {
            item.addEventListener('click', () => {
                const effectPre = item.querySelector('.seffect-code');
                effectPre.style.display = effectPre.style.display === 'none' ? 'block' : 'none';
            });
        });

        content.querySelectorAll('.fx-item').forEach(item => {
            item.addEventListener('click', () => {
                const fxName = item.dataset.fx;
                const effect = getEffect(fxName);
                if (effect) {
                    const skillCode = this.element.querySelector('.skill-code');
                    skillCode.textContent = effect.toString();
                }
            });
        });

        content.querySelectorAll('.play-sound-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const soundType = btn.dataset.soundType;
                if (skill.metadata.sounds[soundType]) {
                    playConfigSound(skill.metadata.sounds[soundType]);
                }
            });
        });
    }

    formatName(str) {
        if (!str) return '';
        return str
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }

    show() {
        this.element.style.display = 'block';
        this.filterSkills('');
    }

    hide() {
        this.element.style.display = 'none';
        this.currentSkill = null;
        this.metadata = null;
    }
}
import { getUnitData, initializeUnits, getEffect } from './unitLoader.js';
import { createEditorDOM, createFrequencyInput } from './unit-editor-ui.js';
import { UnitSoundEditor } from './unitSoundEditor.js';
import { playConfigSound } from './soundManagerCode.js';

export class UnitEditor {
    constructor() {
        this.currentUnit = null;
        this.selectedColor = '#000000';
        this.graphics = [];
        this.pixelSize = 20;
        this.audioContext = null;
        this.editor = null;
        this.editorInitialized = false;
        this.activeTab = 'basic';
        this.soundEditor = null;
        this.selectedSoundType = null;
        this.effectTypes = [];
        this.skillTypes = [];
        this.initializeGraphics();
    }

    initializeGraphics() {
        this.graphics = [];
        for (let y = 0; y < 7; y++) {
            const row = new Array(5).fill(null);
            this.graphics.push(row);
        }
    }

    initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.audioContext;
    }

    async loadEffectTypes() {
        const effects = [
            { name: 'defaultSpawn', id: 'fx-defaultSpawn' },
            { name: 'defaultDeath', id: 'fx-defaultDeath' },
            { name: 'defaultAttack', id: 'fx-defaultAttack' },
            { name: 'damageEffect', id: 'fx-damageEffect' },
            { name: 'freezeStart', id: 'fx-freezeStart' },
            { name: 'freezeContinuous', id: 'fx-freezeContinuous' },
            { name: 'healStart', id: 'fx-healStart' },
            { name: 'healPulse', id: 'fx-healPulse' },
            { name: 'healContinuous', id: 'fx-healContinuous' },
            { name: 'poisonStart', id: 'fx-poisonStart' },
            { name: 'poisonContinuous', id: 'fx-poisonContinuous' },
            { name: 'shieldStart', id: 'fx-shieldStart' },
            { name: 'shieldContinuous', id: 'fx-shieldContinuous' },
            { name: 'transformStart', id: 'fx-transformStart' },
            { name: 'transformContinuous', id: 'fx-transformContinuous' },
            { name: 'archerAttack', id: 'fx-archerAttack' },
            { name: 'archerDeath', id: 'fx-archerDeath' },
            { name: 'archerSpawn', id: 'fx-archerSpawn' },
            { name: 'basicAttack', id: 'fx-basicAttack' },
            { name: 'basicDeath', id: 'fx-basicDeath' },
            { name: 'basicGlow', id: 'fx-basicGlow' },
            { name: 'basicSpawn', id: 'fx-basicSpawn' },
            { name: 'cloneContinuous', id: 'fx-cloneContinuous' },
            { name: 'cloneStart', id: 'fx-cloneStart' }
        ];
        this.effectTypes = effects;
        return effects;
    }

    async loadSkillTypes() {
        try {
            const response = await fetch('/api/skills');
            const skillsObj = await response.json();
            this.skillTypes = Object.keys(skillsObj).map(filename => filename.replace('.js', ''));
            return this.skillTypes;
        } catch (error) {
            console.error('Error loading skill types:', error);
            return [];
        }
    }

    async initializeEditor() {
        if (this.editorInitialized) return;

        this.editor = createEditorDOM();
        document.body.appendChild(this.editor);
        this.soundEditor = new UnitSoundEditor();
        await Promise.all([
            this.loadEffectTypes(),
            this.loadSkillTypes()
        ]);
        this.setupEventListeners();
        this.setupPixelGrid();
        await this.loadAvailableSkillsAndEffects();
        this.editorInitialized = true;
    }

    setupEventListeners() {
        if (!this.editor) return;

        this.editor.querySelector('.close-editor').addEventListener('click', () => this.hide());
        this.editor.querySelector('.save-unit').addEventListener('click', () => this.saveUnit());
        this.editor.querySelector('.delete-unit').addEventListener('click', () => {
            const dialog = this.editor.querySelector('.confirmation-dialog');
            dialog.style.display = 'block';
        });

        this.editor.querySelector('.confirm-delete').addEventListener('click', async () => {
            if (this.currentUnit) {
                try {
                    const response = await fetch(`/api/units/${this.currentUnit.id}`, {
                        method: 'DELETE'
                    });

                    if (response.ok) {
                        await initializeUnits();
                        this.hide();
                    }
                } catch (error) {
                    console.error('Error deleting unit:', error);
                }
            }
            this.editor.querySelector('.confirmation-dialog').style.display = 'none';
        });

        this.editor.querySelector('.cancel-delete').addEventListener('click', () => {
            this.editor.querySelector('.confirmation-dialog').style.display = 'none';
        });

        const attackType = this.editor.querySelector('#attack-type');
        const meleeConfig = this.editor.querySelector('#melee-config');
        const rangedConfig = this.editor.querySelector('#ranged-config');

        attackType.addEventListener('change', () => {
            meleeConfig.style.display = attackType.value === 'melee' ? 'block' : 'none';
            rangedConfig.style.display = attackType.value === 'ranged' ? 'block' : 'none';
        });

        const colorPicker = this.editor.querySelector('#pixel-color');
        colorPicker.addEventListener('change', (e) => {
            this.selectedColor = e.target.value;
        });

        const commonColors = this.editor.querySelector('.common-colors');
        commonColors.addEventListener('click', (e) => {
            if (e.target.dataset.color) {
                this.selectedColor = e.target.dataset.color;
                colorPicker.value = this.selectedColor;
            }
        });

        this.editor.querySelector('.clear-pixel').addEventListener('click', () => {
            this.selectedColor = null;
        });

        this.editor.querySelector('.clear-all').addEventListener('click', () => {
            this.clearGrid();
        });

        this.editor.querySelector('.resize-grid').addEventListener('click', () => {
            const width = parseInt(this.editor.querySelector('#grid-width').value);
            const height = parseInt(this.editor.querySelector('#grid-height').value);
            this.resizeGrid(width, height);
        });

        this.editor.querySelectorAll('.sound-config').forEach(config => {
            const soundType = config.id.replace('-sound', '');

            config.querySelector('.test-sound')?.addEventListener('click', () => {
                if (this.currentUnit?.sounds?.[soundType]) {
                    playConfigSound(this.currentUnit.sounds[soundType]);
                }
            });

            config.querySelector('.edit-sound')?.addEventListener('click', () => {
                this.selectedSoundType = soundType;
                this.soundEditor.show((newConfig) => {
                    if (!this.currentUnit.sounds) {
                        this.currentUnit.sounds = {};
                    }
                    this.currentUnit.sounds[soundType] = newConfig;
                });
                if (this.currentUnit?.sounds?.[soundType]) {
                    this.soundEditor.setSoundConfig(this.currentUnit.sounds[soundType]);
                }
            });
        });

        const tabs = this.editor.querySelectorAll('.editor-tab');
        const tabContents = this.editor.querySelectorAll('.editor-tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;

                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));

                tab.classList.add('active');
                this.editor.querySelector(`.editor-tab-content[data-tab="${tabId}"]`).classList.add('active');
                this.activeTab = tabId;
            });
        });

        this.editor.querySelector('#unit-name').addEventListener('input', (e) => {
            this.editor.querySelector('#editor-title').textContent = e.target.value;
        });
    }

    setupPixelGrid() {
        if (!this.editor) return;

        const grid = this.editor.querySelector('#pixel-grid');
        if (!grid) return;

        grid.innerHTML = '';

        for (let y = 0; y < this.graphics.length; y++) {
            const gridRow = document.createElement('div');
            gridRow.className = 'grid-row';

            for (let x = 0; x < this.graphics[y].length; x++) {
                const pixel = document.createElement('div');
                pixel.className = 'pixel';
                pixel.style.width = `${this.pixelSize}px`;
                pixel.style.height = `${this.pixelSize}px`;

                if (this.graphics[y][x]) {
                    pixel.style.backgroundColor = this.graphics[y][x];
                }

                pixel.addEventListener('mousedown', () => {
                    this.setPixelColor(pixel, x, y);
                });

                pixel.addEventListener('mouseover', (e) => {
                    if (e.buttons === 1) {
                        this.setPixelColor(pixel, x, y);
                    }
                });

                gridRow.appendChild(pixel);
            }

            grid.appendChild(gridRow);
        }
    }

    resizeGrid(width, height) {
        const newGraphics = [];
        for (let y = 0; y < height; y++) {
            const row = new Array(width).fill(null);
            newGraphics.push(row);
        }

        for (let y = 0; y < Math.min(height, this.graphics.length); y++) {
            for (let x = 0; x < Math.min(width, this.graphics[0].length); x++) {
                newGraphics[y][x] = this.graphics[y][x];
            }
        }

        this.graphics = newGraphics;
        this.setupPixelGrid();
    }

    setPixelColor(pixel, x, y) {
        if (this.selectedColor === null) {
            pixel.style.backgroundColor = 'transparent';
            this.graphics[y][x] = null;
        } else {
            pixel.style.backgroundColor = this.selectedColor;
            this.graphics[y][x] = this.selectedColor;
        }
    }

    clearGrid() {
        const pixels = this.editor.querySelectorAll('.pixel');
        pixels.forEach(pixel => {
            pixel.style.backgroundColor = 'transparent';
        });
        this.graphics = this.graphics.map(row => row.map(() => null));
    }

    async loadAvailableSkillsAndEffects() {
        if (!this.editor) return;

        const skillsList = this.editor.querySelector('#skills-list');
        if (!skillsList) return;

        skillsList.innerHTML = this.skillTypes.map(skill => `
            <div class="skill-item">
                <input type="checkbox" id="skill-${skill}" value="${skill}">
                <label for="skill-${skill}">${this.formatSkillName(skill)}</label>
            </div>
        `).join('');

        const effects = ['spawn', 'death', 'attack', 'continuous'];

        effects.forEach(effect => {
            const select = this.editor.querySelector(`#${effect}-effect`);
            if (select) {
                select.innerHTML = '<option value="">None</option>' +
                    this.effectTypes.map(effect => `<option value="${effect.id}">${this.formatEffectName(effect.name)}</option>`).join('');
            }
        });

        // Agregar visualización previa de efectos
        const effectsSection = this.editor.querySelector('.effects-section');
        if (effectsSection) {
            effectsSection.addEventListener('change', (e) => {
                if (e.target.tagName === 'SELECT') {
                    const effectId = e.target.value;
                    if (effectId) {
                        const effect = getEffect(effectId);
                        if (effect) {
                            const effectCode = document.createElement('pre');
                            effectCode.className = 'effect-code';
                            effectCode.textContent = effect.toString();

                            const existingCode = effectsSection.querySelector('.effect-code');
                            if (existingCode) {
                                existingCode.remove();
                            }
                            effectsSection.appendChild(effectCode);
                        }
                    }
                }
            });
        }
    }

    formatSkillName(skill) {
        return skill.replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase());
    }

    formatEffectName(effect) {
        return effect
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase());
    }

    async show(unitId) {
        await this.initializeEditor();
        this.currentUnit = getUnitData(unitId);
        if (!this.currentUnit) return;

        this.editor.style.display = 'block';
        this.loadUnitData();
    }

    hide() {
        if (this.editor) {
            this.editor.style.display = 'none';
            this.editor.querySelector('.confirmation-dialog').style.display = 'none';
        }
    }

    loadUnitData() {
        if (!this.currentUnit || !this.editor) return;

        this.editor.querySelector('#editor-title').textContent = this.currentUnit.name;
        this.editor.querySelector('#unit-name').value = this.currentUnit.name;
        this.editor.querySelector('#unit-description').value = this.currentUnit.description;
        this.editor.querySelector('#unit-cost').value = this.currentUnit.cost;
        this.editor.querySelector('#unit-life').value = this.currentUnit.life;
        this.editor.querySelector('#unit-speed').value = this.currentUnit.speed;
        this.editor.querySelector('#unit-scale').value = this.currentUnit.scale;
        this.editor.querySelector('#unit-damage').value = this.currentUnit.damage;

        const attackType = this.editor.querySelector('#attack-type');
        attackType.value = this.currentUnit.attackType;
        attackType.dispatchEvent(new Event('change'));

        if (this.currentUnit.attackType === 'melee') {
            this.editor.querySelector('#melee-range').value = this.currentUnit.attackRange;
            this.editor.querySelector('#melee-speed').value = this.currentUnit.attackSpeed;
            if (this.currentUnit.swordGraphics) {
                this.editor.querySelector('#sword-width').value = this.currentUnit.swordGraphics.width;
                this.editor.querySelector('#sword-height').value = this.currentUnit.swordGraphics.height;
                this.editor.querySelector('#sword-color').value = this.currentUnit.swordGraphics.color;
            }
        } else {
            this.editor.querySelector('#optimal-range').value = this.currentUnit.optimalRange;
            this.editor.querySelector('#projectile-speed').value = this.currentUnit.projectileSpeed;
            this.editor.querySelector('#attack-interval-min').value = this.currentUnit.attackInterval.min;
            this.editor.querySelector('#attack-interval-max').value = this.currentUnit.attackInterval.max;
            this.editor.querySelector('#projectile-color').value = this.currentUnit.projectileColor;
            this.editor.querySelector('#projectile-trail-color').value = this.currentUnit.projectileTrailColor;
        }

        this.graphics = JSON.parse(JSON.stringify(this.currentUnit.graphics));
        this.editor.querySelector('#grid-width').value = this.graphics[0].length;
        this.editor.querySelector('#grid-height').value = this.graphics.length;
        this.setupPixelGrid();

        const skillCheckboxes = this.editor.querySelectorAll('#skills-list input[type="checkbox"]');
        skillCheckboxes.forEach(checkbox => {
            checkbox.checked = this.currentUnit.skills?.includes(checkbox.value) || false;
        });

        if (this.currentUnit.effects) {
            Object.entries(this.currentUnit.effects).forEach(([type, effect]) => {
                const select = this.editor.querySelector(`#${type}-effect`);
                if (select) select.value = effect.split('.')[0];
            });
        }

        const tabToShow = this.editor.querySelector(`.editor-tab[data-tab="${this.activeTab}"]`);
        if (tabToShow) {
            tabToShow.click();
        }
    }

    gatherUnitData() {
        if (!this.editor) return null;

        const unitData = {
            id: this.currentUnit.id,
            name: this.editor.querySelector('#unit-name').value,
            description: this.editor.querySelector('#unit-description').value,
            cost: parseInt(this.editor.querySelector('#unit-cost').value),
            life: parseInt(this.editor.querySelector('#unit-life').value),
            speed: parseFloat(this.editor.querySelector('#unit-speed').value),
            scale: parseFloat(this.editor.querySelector('#unit-scale').value),
            damage: parseInt(this.editor.querySelector('#unit-damage').value),
            attackType: this.editor.querySelector('#attack-type').value,
            graphics: this.graphics,
            sounds: this.currentUnit.sounds
        };

        if (unitData.attackType === 'melee') {
            unitData.attackRange = parseInt(this.editor.querySelector('#melee-range').value);
            unitData.attackSpeed = parseInt(this.editor.querySelector('#melee-speed').value);
            unitData.swordGraphics = {
                width: parseInt(this.editor.querySelector('#sword-width').value),
                height: parseInt(this.editor.querySelector('#sword-height').value),
                color: this.editor.querySelector('#sword-color').value
            };
        } else {
            unitData.optimalRange = parseInt(this.editor.querySelector('#optimal-range').value);
            unitData.projectileSpeed = parseInt(this.editor.querySelector('#projectile-speed').value);
            unitData.attackInterval = {
                min: parseInt(this.editor.querySelector('#attack-interval-min').value),
                max: parseInt(this.editor.querySelector('#attack-interval-max').value)
            };
            unitData.projectileColor = this.editor.querySelector('#projectile-color').value;
            unitData.projectileTrailColor = this.editor.querySelector('#projectile-trail-color').value;
        }

        const selectedSkills = Array.from(this.editor.querySelectorAll('#skills-list input:checked'))
            .map(checkbox => checkbox.value);
        if (selectedSkills.length > 0) {
            unitData.skills = selectedSkills;
        }

        const effects = {};
        this.editor.querySelectorAll('[id$="-effect"]').forEach(select => {
            if (select.value) {
                const type = select.id.replace('-effect', '');
                effects[type] = `${select.value}.js`;
            }
        });
        if (Object.keys(effects).length > 0) {
            unitData.effects = effects;
        }

        return unitData;
    }

    async saveUnit() {
        const unitData = this.gatherUnitData();
        if (!unitData) return;

        try {
            const response = await fetch(`/api/units/${unitData.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(unitData, null, 4)
            });

            if (response.ok) {
                await initializeUnits();
                this.hide();
            }
        } catch (error) {
            console.error('Error saving unit:', error);
        }
    }
}
import tabManager from './tabs-manager.js';
import { spawnUnit } from './characters.js';
import { getUnitData, loadedUnits, initializeUnits } from './unitLoader.js';
import { UnitEditor } from './unit-editor-code.js';
import { unitTooltip } from './tooltip-code.js';
import * as gameState from './gameState.js';

export class TestUnitsTab {
    constructor() {
        this.title = 'Test Units';
        this.element = document.getElementById('test-units-tab');
        this.unitEditor = new UnitEditor();
        this.nextNewUnitId = 1;
        
        window.addEventListener('unitsUpdated', () => {
            this.renderUnits();
        });
    }

    async init() {
        this.element.innerHTML = `
            <div class="units-scroll">
                <div class="units-grid" id="test-units-grid"></div>
            </div>
        `;
    }

    getUniqueNewUnitId() {
        let id;
        do {
            id = `zNewUnit${this.nextNewUnitId++}`;
        } while (getUnitData(id));
        return id;
    }

    async cloneBasicUnit() {
        const basicUnit = getUnitData('kewoBasico');
        if (!basicUnit) return;

        const newUnit = JSON.parse(JSON.stringify(basicUnit));
        newUnit.id = this.getUniqueNewUnitId();
        newUnit.name = 'zNew Unit';
        newUnit.description = 'New custom unit';

        try {
            const response = await fetch('/api/units', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newUnit)
            });

            if (response.ok) {
                await initializeUnits();
                this.renderUnits();
            } else {
                console.error('Error creating new unit:', await response.text());
            }
        } catch (error) {
            console.error('Error creating new unit:', error);
        }
    }

    spawnUnitAtRandomPosition(unitId) {
        if (!gameState.isInitialized) {
            gameState.initGame();
        }
        const bounds = gameState.getBattleAreaBounds();
        const x = bounds.left + Math.random() * (bounds.right - bounds.left);
        const y = bounds.top + Math.random() * (bounds.bottom - bounds.top);
        spawnUnit(unitId, null, null, {x, y});
    }

    renderUnits() {
        const grid = document.getElementById('test-units-grid');
        grid.innerHTML = '';

        // ALL button
        const allContainer = document.createElement('div');
        allContainer.className = 'unit-container';
        const allButton = document.createElement('button');
        allButton.className = 'unit-button';
        allButton.innerHTML = `
            <div class="unit-info-left">
                <span class="unit-name">ALL</span>
            </div>
            <div class="unit-info-right">
                <button class="add-button"><i class="fas fa-plus"></i></button>
                <button class="info-button">?</button>
            </div>
        `;

        allButton.addEventListener('click', (e) => {
            if (e.target !== allButton.querySelector('.info-button') &&
                e.target !== allButton.querySelector('.add-button') &&
                e.target !== allButton.querySelector('i')) {
                if (!gameState.isInitialized) {
                    gameState.initGame();
                }
                loadedUnits.forEach(unit => this.spawnUnitAtRandomPosition(unit.id));
            }
        });

        const infoButton = allButton.querySelector('.info-button');
        infoButton.addEventListener('mouseenter', (e) => {
            e.stopPropagation();
            const customData = {
                name: 'ALL Units',
                description: 'Spawn all available units at once',
                life: 'Various',
                speed: 'Various',
                damage: 'Various'
            };
            unitTooltip.show(e, customData);
        });

        infoButton.addEventListener('mouseleave', () => {
            unitTooltip.hide();
        });

        const addButton = allButton.querySelector('.add-button');
        addButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.cloneBasicUnit();
        });

        allContainer.appendChild(allButton);
        grid.appendChild(allContainer);

        // Sort units alphabetically by name
        const sortedUnits = Array.from(loadedUnits.values()).sort((a, b) => a.name.localeCompare(b.name));

        // Rest of units
        for (const unit of sortedUnits) {
            const container = document.createElement('div');
            container.className = 'unit-container';

            const button = document.createElement('button');
            button.className = 'unit-button';
            button.innerHTML = `
                <button class="edit-button"><i class="fas fa-edit"></i></button>
                <div class="unit-preview"></div>
                <div class="unit-info-left">
                    <span class="unit-name">${unit.name}</span>
                </div>
                <div class="unit-info-right">
                    <span class="price">$${unit.cost || 0}</span>
                    <button class="info-button">?</button>
                </div>
            `;

            const editButton = button.querySelector('.edit-button');
            editButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.unitEditor.show(unit.id);
            });

            button.addEventListener('click', (e) => {
                if (e.target !== button.querySelector('.info-button') && e.target !== editButton && !editButton.contains(e.target)) {
                    this.spawnUnitAtRandomPosition(unit.id);
                }
            });

            const preview = button.querySelector('.unit-preview');
            if (unit.graphics) {
                const canvas = document.createElement('canvas');
                const scale = 3;
                canvas.width = unit.graphics[0].length * scale;
                canvas.height = unit.graphics.length * scale;

                const ctx = canvas.getContext('2d');
                unit.graphics.forEach((row, y) => {
                    row.forEach((color, x) => {
                        if (color) {
                            ctx.fillStyle = color;
                            ctx.fillRect(x * scale, y * scale, scale, scale);
                        }
                    });
                });
                preview.appendChild(canvas);
            }

            const infoBtn = button.querySelector('.info-button');
            infoBtn.addEventListener('mouseenter', (e) => {
                e.stopPropagation();
                unitTooltip.show(e, unit);
            });

            infoBtn.addEventListener('mouseleave', () => {
                unitTooltip.hide();
            });

            container.appendChild(button);
            grid.appendChild(container);
        }
    }

    onShow() {
        this.renderUnits();
    }

    onHide() {
        unitTooltip.hide();
    }
}

const testUnitsTab = new TestUnitsTab();
tabManager.registerTab('test-units-tab', testUnitsTab);
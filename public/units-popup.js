import { loadedUnits } from './unitLoader.js';
import { unitTooltip } from './tooltip-code.js';

export class UnitsPopup {
    constructor() {
        this.element = null;
        this.activeTab = 'buy';
        this.currentAI = null;
        this.initialGold = 0;
        this.currentGold = 0;
        this.purchasedUnits = new Map();
        this.availableUnits = new Set(['kewoBasico', 'kewoArco']);
        this.onAccept = null;
        this.init();
    }

    init() {
        this.element = document.createElement('div');
        this.element.className = 'units-popup';
        this.element.innerHTML = `
            <div class="units-popup-overlay">
                <div class="units-popup-content">
                    <div class="units-popup-header">
                        <h2>Units Management</h2>
                    </div>
                    <div class="units-popup-tabs">
                        <button class="units-popup-tab active" data-tab="buy">Buy Units</button>
                        <button class="units-popup-tab" data-tab="available">Available Units</button>
                    </div>
                    <div class="units-popup-body">
                        <div class="units-popup-tab-content active" data-tab="buy">
                            <div class="gold-display">Gold: <span class="gold-amount">1000</span></div>
                            <div class="buy-units-container">
                                <div class="available-units-list">
                                    <h3>Available Units</h3>
                                    <div class="units-grid"></div>
                                </div>
                                <div class="purchased-units-list">
                                    <h3>Purchased Units</h3>
                                    <div class="units-grid"></div>
                                </div>
                            </div>
                        </div>
                        <div class="units-popup-tab-content" data-tab="available">
                            <div class="units-grid"></div>
                        </div>
                    </div>
                    <div class="units-popup-footer">
                        <button class="cancel-button">Cancel</button>
                        <button class="accept-button">Accept</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.element);
        this.setupEventListeners();
    }

    setupEventListeners() {
        const tabs = this.element.querySelectorAll('.units-popup-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });

        this.element.querySelector('.accept-button').addEventListener('click', () => {
            if (this.onAccept) {
                this.onAccept({
                    purchasedUnits: Array.from(this.purchasedUnits.entries()).map(([id, quantity]) => ({
                        id,
                        quantity
                    })),
                    availableUnits: Array.from(this.availableUnits)
                });
            }
            this.hide();
        });

        this.element.querySelector('.cancel-button').addEventListener('click', () => {
            this.hide();
        });
    }

    switchTab(tabId) {
        this.activeTab = tabId;
        this.element.querySelectorAll('.units-popup-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabId);
        });
        this.element.querySelectorAll('.units-popup-tab-content').forEach(content => {
            content.classList.toggle('active', content.dataset.tab === tabId);
        });
        this.renderContent();
    }

    createUnitButton(unit, options = {}) {
        const button = document.createElement('div');
        button.className = 'unit-button';

        let content = `
            ${options.showEdit ? '<button class="edit-button"><i class="fas fa-edit"></i></button>' : ''}
            <div class="unit-preview"></div>
            <div class="unit-info-left">
                <span class="unit-name">${unit.name}</span>
            </div>
            <div class="unit-info-right">
                <span class="price">$${unit.cost}</span>
                <button class="info-button">?</button>
            </div>
        `;

        if (options.quantity) {
            content += `<span class="unit-quantity">x${options.quantity}</span>`;
        }

        if (options.showCheckbox) {
            content += `
                <div class="unit-checkbox">
                    <input type="checkbox" ${this.availableUnits.has(unit.id) ? 'checked' : ''}>
                    <label>Available</label>
                </div>
            `;
        }

        button.innerHTML = content;

        if (options.purchaseHandler) {
            button.addEventListener('click', (e) => {
                if (!e.target.closest('.info-button') && !e.target.closest('.edit-button')) {
                    options.purchaseHandler(unit);
                }
            });
        }

        if (options.showCheckbox) {
            const checkbox = button.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.availableUnits.add(unit.id);
                } else {
                    this.availableUnits.delete(unit.id);
                }
            });

            button.addEventListener('click', (e) => {
                if (!e.target.closest('.info-button') && !e.target.closest('.edit-button') && !e.target.closest('input[type="checkbox"]')) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });
        }

        const infoButton = button.querySelector('.info-button');
        infoButton.addEventListener('mouseenter', (e) => {
            e.stopPropagation();
            unitTooltip.show(e, unit);
        });

        infoButton.addEventListener('mouseleave', () => {
            unitTooltip.hide();
        });

        const preview = button.querySelector('.unit-preview');
        if (preview && unit.graphics) {
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

        return button;
    }

    renderContent() {
        if (this.activeTab === 'buy') {
            const availableList = this.element.querySelector('.available-units-list .units-grid');
            const purchasedList = this.element.querySelector('.purchased-units-list .units-grid');

            availableList.innerHTML = '';
            purchasedList.innerHTML = '';

            this.element.querySelector('.gold-amount').textContent = this.currentGold;

            Array.from(loadedUnits.values())
                .filter(unit => this.availableUnits.has(unit.id))
                .forEach(unit => {
                    const button = this.createUnitButton(unit, {
                        purchaseHandler: (unit) => {
                            if (this.currentGold >= unit.cost) {
                                this.currentGold -= unit.cost;
                                this.purchasedUnits.set(unit.id, (this.purchasedUnits.get(unit.id) || 0) + 1);
                                this.renderContent();
                            }
                        }
                    });
                    availableList.appendChild(button);
                });

            this.purchasedUnits.forEach((quantity, unitId) => {
                const unit = loadedUnits.get(unitId);
                if (unit) {
                    const button = this.createUnitButton(unit, {
                        quantity,
                        purchaseHandler: (unit) => {
                            const currentQuantity = this.purchasedUnits.get(unit.id);
                            if (currentQuantity > 1) {
                                this.purchasedUnits.set(unit.id, currentQuantity - 1);
                            } else {
                                this.purchasedUnits.delete(unit.id);
                            }
                            this.currentGold += unit.cost;
                            this.renderContent();
                        }
                    });
                    purchasedList.appendChild(button);
                }
            });
        } else {
            const grid = this.element.querySelector('[data-tab="available"] .units-grid');
            grid.innerHTML = '';

            Array.from(loadedUnits.values())
                .filter(unit => unit.cost !== undefined && unit.cost > 0)
                .forEach(unit => {
                    const button = this.createUnitButton(unit, {
                        showEdit: true,
                        showCheckbox: true
                    });
                    grid.appendChild(button);
                });
        }
    }

    show(ai, config, onAccept) {
        this.currentAI = ai;
        this.initialGold = config.gameSettings.initialGold;
        this.currentGold = this.initialGold;
        this.purchasedUnits = new Map();
        if (ai.purchasedUnits) {
            ai.purchasedUnits.forEach(unit => {
                this.purchasedUnits.set(unit.id, unit.quantity);
                this.currentGold -= (loadedUnits.get(unit.id)?.cost || 0) * unit.quantity;
            });
        }
        this.availableUnits = new Set(ai.availableUnits || ['kewoBasico', 'kewoArco']);
        this.onAccept = onAccept;
        this.element.style.display = 'block';
        this.switchTab('buy');
    }

    hide() {
        this.element.style.display = 'none';
        unitTooltip.hide();
    }
}
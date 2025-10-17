import tabManager from './tabs-manager.js';
import { setVolume } from './audio.js';
import { testConnection } from './aiSender.js';
import { getGameSpeed, setGameSpeed } from './gameState.js';
import { popupManager } from './popup-manager.js';

export class ConfigTab {
    constructor() {
        this.title = 'Config';
        this.element = document.getElementById('config-tab');
        this.services = [];
        this.init();
    }

    init() {
        this.element.innerHTML = `
            <div class="services-config">
                <div class="game-settings">
                    <h3>Game Settings</h3>
                    <div class="fps-toggle">
                        <input type="checkbox" id="show-fps">
                        <label for="show-fps">Show FPS Counter</label>
                    </div>
                    <div class="units-counter-toggle">
                        <input type="checkbox" id="show-units-counter">
                        <label for="show-units-counter">Show Units Counter</label>
                    </div>
                    <div class="game-speed-indicator-toggle">
                        <input type="checkbox" id="show-game-speed">
                        <label for="show-game-speed">Show Game Speed Indicator</label>
                    </div>
                    <div class="volume-control">
                        <label for="volume-slider">Volume</label>
                        <input 
                            type="range" 
                            id="volume-slider" 
                            min="0" 
                            max="100" 
                            value="50"
                            class="volume-slider"
                        >
                        <span id="volume-value">50%</span>
                    </div>
                    <div class="game-speed-control">
                        <label for="game-speed-slider">Game Speed</label>
                        <input 
                            type="range" 
                            id="game-speed-slider" 
                            min="10" 
                            max="300" 
                            value="100"
                            step="10"
                            class="game-speed-slider"
                        >
                        <span id="game-speed-value">1.0x</span>
                        <div class="speed-buttons">
                            <button id="decrease-speed" class="speed-button">-</button>
                            <button id="reset-speed" class="speed-button">Reset</button>
                            <button id="increase-speed" class="speed-button">+</button>
                        </div>
                    </div>
                </div>
                <h3>AI Services Configuration</h3>
                <div class="services-list" id="services-list"></div>
                <button id="add-service-btn">Add Service</button>
            </div>
        `;

        this.loadConfig();
        this.setupEventListeners();
    }

    setupEventListeners() {
        const addServiceBtn = this.element.querySelector('#add-service-btn');
        addServiceBtn.addEventListener('click', () => this.addService());

        const showFpsCheckbox = this.element.querySelector('#show-fps');
        showFpsCheckbox.addEventListener('change', (e) => {
            window.dispatchEvent(new CustomEvent('fpsToggle', { detail: e.target.checked }));
            this.saveSingleDisplaySetting('showFpsCounter', e.target.checked);
        });

        const showUnitsCounterCheckbox = this.element.querySelector('#show-units-counter');
        showUnitsCounterCheckbox.addEventListener('change', (e) => {
            window.dispatchEvent(new CustomEvent('unitsCounterToggle', { detail: e.target.checked }));
            this.saveSingleDisplaySetting('showUnitsCounter', e.target.checked);
        });

        const showGameSpeedCheckbox = this.element.querySelector('#show-game-speed');
        showGameSpeedCheckbox.addEventListener('change', (e) => {
            window.dispatchEvent(new CustomEvent('gameSpeedToggle', { detail: e.target.checked }));
            this.saveSingleDisplaySetting('showGameSpeedIndicator', e.target.checked);
        });

        const volumeSlider = this.element.querySelector('#volume-slider');
        const volumeValue = this.element.querySelector('#volume-value');

        volumeSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            volumeValue.textContent = `${value}%`;
            setVolume(value / 100);
        });

        volumeSlider.addEventListener('mouseup', (e) => {
            this.saveSingleDisplaySetting('volume', parseInt(e.target.value));
        });

        volumeSlider.addEventListener('touchend', (e) => {
            this.saveSingleDisplaySetting('volume', parseInt(e.target.value));
        });

        const gameSpeedSlider = this.element.querySelector('#game-speed-slider');
        const gameSpeedValue = this.element.querySelector('#game-speed-value');

        gameSpeedSlider.addEventListener('input', (e) => {
            const speed = e.target.value / 100;
            gameSpeedValue.textContent = `${speed.toFixed(1)}x`;
            setGameSpeed(speed);
        });

        gameSpeedSlider.addEventListener('mouseup', (e) => {
            this.saveSingleDisplaySetting('gameSpeed', parseFloat((e.target.value / 100).toFixed(1)));
        });

        gameSpeedSlider.addEventListener('touchend', (e) => {
            this.saveSingleDisplaySetting('gameSpeed', parseFloat((e.target.value / 100).toFixed(1)));
        });

        const decreaseSpeedBtn = this.element.querySelector('#decrease-speed');
        decreaseSpeedBtn.addEventListener('click', () => {
            let speed = getGameSpeed();
            speed = Math.max(0.1, speed - 0.1);
            setGameSpeed(speed);
            gameSpeedSlider.value = speed * 100;
            gameSpeedValue.textContent = `${speed.toFixed(1)}x`;
            this.saveSingleDisplaySetting('gameSpeed', speed);
        });

        const resetSpeedBtn = this.element.querySelector('#reset-speed');
        resetSpeedBtn.addEventListener('click', () => {
            setGameSpeed(1.0);
            gameSpeedSlider.value = 100;
            gameSpeedValue.textContent = '1.0x';
            this.saveSingleDisplaySetting('gameSpeed', 1.0);
        });

        const increaseSpeedBtn = this.element.querySelector('#increase-speed');
        increaseSpeedBtn.addEventListener('click', () => {
            let speed = getGameSpeed();
            speed = Math.min(3.0, speed + 0.1);
            setGameSpeed(speed);
            gameSpeedSlider.value = speed * 100;
            gameSpeedValue.textContent = `${speed.toFixed(1)}x`;
            this.saveSingleDisplaySetting('gameSpeed', speed);
        });
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/config2');
            const config = await response.json();

            if (config.display) {
                this.element.querySelector('#show-fps').checked = config.display.showFpsCounter;
                this.element.querySelector('#show-units-counter').checked = config.display.showUnitsCounter;
                this.element.querySelector('#show-game-speed').checked = config.display.showGameSpeedIndicator;

                if (config.display.volume !== undefined) {
                    this.element.querySelector('#volume-slider').value = config.display.volume;
                    this.element.querySelector('#volume-value').textContent = `${config.display.volume}%`;
                    setVolume(config.display.volume / 100);
                }

                if (config.display.gameSpeed !== undefined) {
                    const gameSpeed = config.display.gameSpeed;
                    this.element.querySelector('#game-speed-slider').value = gameSpeed * 100;
                    this.element.querySelector('#game-speed-value').textContent = `${gameSpeed.toFixed(1)}x`;
                    setGameSpeed(gameSpeed);
                }

                window.dispatchEvent(new CustomEvent('fpsToggle', { detail: config.display.showFpsCounter }));
                window.dispatchEvent(new CustomEvent('unitsCounterToggle', { detail: config.display.showUnitsCounter }));
                window.dispatchEvent(new CustomEvent('gameSpeedToggle', { detail: config.display.showGameSpeedIndicator }));
            }

            if (config.aiServices) {
                this.services = config.aiServices;
                this.renderServices();
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }
    }

    addService() {
        this.services.push({
            name: `New Service`,
            type: 'custom',
            endpoint: '',
            apiKey: '',
            model: '',
            isActive: true,
            thinking: false,
            reasoning: false,
            mirror: false
        });

        this.renderServices();
        this.saveAiServices();
    }

    removeService(index) {
        const serviceToRemove = this.services[index];
        
        if (serviceToRemove && serviceToRemove.service_id) {
            this.deleteService(serviceToRemove.service_id);
            this.services.splice(index, 1);
            this.renderServices();
        }
    }

    async deleteService(serviceId) {
        try {
            await fetch('/api/config2/ai-service/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ service_id: serviceId })
            });
        } catch (error) {
            console.error('Error deleting AI service:', error);
        }
    }

    async updateService(index, field, value) {
        try {
            if (field === 'type') {
                this.services[index][field] = value;
                
                if (value === 'claude') {
                    this.services[index].endpoint = 'https://api.anthropic.com/v1/messages';
                    this.services[index].model = 'claude-3-5-sonnet-20241022';
                    if (this.services[index].thinking === undefined) {
                        this.services[index].thinking = false;
                    }
                } else if (value === 'chatgpt') {
                    this.services[index].endpoint = 'https://api.openai.com/v1/chat/completions';
                    this.services[index].model = 'gpt-3.5-turbo';
                    this.services[index].reasoning = false;
                } else if (value === 'deepseek') {
                    this.services[index].endpoint = 'https://api.deepseek.com/v1/chat/completions';
                    this.services[index].model = 'deepseek-r1-large';
                    this.services[index].mirror = false;
                } else if (value === 'gemini') {
                    this.services[index].endpoint = 'https://generativelanguage.googleapis.com';
                    this.services[index].model = 'gemini-1.5-flash';
                } else if (value === 'grok') {
                    this.services[index].endpoint = 'https://api.x.ai/v1/chat/completions';
                    this.services[index].model = 'grok-4-fast';
                }
            } else {
                this.services[index][field] = value;
            }
            
            const serviceId = this.services[index].service_id;
            if (serviceId) {
                const response = await fetch(`/api/config2/ai-service/check-dependencies/${serviceId}`);
                if (!response.ok) {
                    throw new Error('Error al verificar dependencias del servicio');
                }
                
                const data = await response.json();
                
                if (data.hasDependencies) {
                    await popupManager.showWarning(
                        "No se puede modificar este servicio porque ya tiene partidas asociadas. Las modificaciones podrían afectar a los datos históricos.",
                        "Servicio con partidas existentes"
                    );
                    await this.loadConfig();
                    return;
                }
            }
            
            const result = await this.saveService(this.services[index]);
            if (result && result.success === false && result.error) {
                await popupManager.showWarning(result.error);
                await this.loadConfig();
                return;
            }
            
            this.renderServices();
        } catch (error) {
            console.error('Error updating service:', error);
            await popupManager.showError(`Error al actualizar el servicio: ${error.message}`);
            await this.loadConfig();
        }
    }

    async saveService(service) {
        try {
            const response = await fetch('/api/config2/ai-service/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(service)
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.service_id && !service.service_id) {
                    service.service_id = result.service_id;
                }
                return result;
            }
            return null;
        } catch (error) {
            console.error('Error updating AI service:', error);
            return null;
        }
    }

    toggleService(index) {
        this.services[index].isActive = !this.services[index].isActive;
        this.saveService(this.services[index]);
    }

    async saveSingleDisplaySetting(key, value) {
        try {
            const data = {};
            data[key] = value;
            
            await fetch('/api/config2/display', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        } catch (error) {
            console.error(`Error saving ${key}:`, error);
        }
    }

    async saveAiServices() {
        try {
            const response = await fetch('/api/config2/ai-services', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.services)
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.services) {
                    this.services = result.services;
                    this.renderServices();
                }
            }
        } catch (error) {
            console.error('Error saving AI services:', error);
        }
    }

    renderServices() {
        const servicesList = this.element.querySelector('#services-list');
        servicesList.innerHTML = '';

        this.services.forEach((service, index) => {
            const serviceElement = document.createElement('div');
            serviceElement.className = 'service-config';
            serviceElement.dataset.serviceType = service.type;
            
            if (!service.isActive) {
                serviceElement.classList.add('inactive');
            }

            serviceElement.innerHTML = `
                <div class="service-header">
                    <input type="text" class="service-name" placeholder="Service Name" 
                           value="${service.name}" data-field="name">
                    <div class="service-controls">
                        <button class="toggle-service">${service.isActive ? 'Active' : 'Inactive'}</button>
                        <button class="remove-service">×</button>
                    </div>
                </div>
                <div class="service-details">
                    <div class="input-group">
                        <label>Service Type</label>
                        <select class="service-type" data-field="type">
                            <option value="custom" ${service.type === 'custom' ? 'selected' : ''}>Custom</option>
                            <option value="claude" ${service.type === 'claude' ? 'selected' : ''}>Claude</option>
                            <option value="chatgpt" ${service.type === 'chatgpt' ? 'selected' : ''}>ChatGPT</option>
                            <option value="deepseek" ${service.type === 'deepseek' ? 'selected' : ''}>DeepSeek</option>
                            <option value="gemini" ${service.type === 'gemini' ? 'selected' : ''}>Gemini</option>
                            <option value="grok" ${service.type === 'grok' ? 'selected' : ''}>Grok</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Endpoint URL</label>
                        <input type="text" class="service-endpoint" placeholder="https://api.example.com" 
                               value="${service.endpoint}" data-field="endpoint">
                    </div>
                    <div class="input-group">
                        <label>API Key</label>
                        <input type="password" class="service-key" placeholder="Your API key" 
                               value="${service.apiKey}" data-field="apiKey">
                        <button class="toggle-visibility">Show</button>
                    </div>
                    <div class="input-group">
                        <label>Model Name</label>
                        <input type="text" class="service-model" placeholder="Model identifier" 
                               value="${service.model}" data-field="model">
                    </div>
                    ${service.type === 'claude' ? `
                    <div class="input-group">
                        <label>Thinking Mode</label>
                        <div>
                            <input type="checkbox" id="thinking-checkbox-${index}" class="thinking-checkbox" ${service.thinking ? 'checked' : ''}>
                            <label for="thinking-checkbox-${index}">Enable extended thinking mode</label>
                        </div>
                    </div>
                    ` : ''}
                    ${service.type === 'chatgpt' ? `
                    <div class="input-group">
                        <label>Model Type</label>
                        <div>
                            <input type="checkbox" id="reasoning-checkbox-${index}" class="reasoning-checkbox" ${service.reasoning ? 'checked' : ''}>
                            <label for="reasoning-checkbox-${index}">This is a reasoning model (o3 series)</label>
                        </div>
                    </div>
                    ` : ''}
                    ${service.type === 'deepseek' ? `
                    <div class="input-group">
                        <label>DeepSeek Options</label>
                        <div>
                            <input type="checkbox" id="mirror-checkbox-${index}" class="mirror-checkbox" ${service.mirror ? 'checked' : ''}>
                            <label for="mirror-checkbox-${index}">Enable mirror mode</label>
                        </div>
                    </div>
                    ` : ''}
                    <div class="test-connection">
                        <button class="test-btn">Test Connection</button>
                        <span class="test-status"></span>
                    </div>
                </div>
            `;

            const inputs = serviceElement.querySelectorAll('input[data-field], select[data-field]');
            inputs.forEach(input => {
                input.addEventListener('change', (e) => {
                    this.updateService(index, e.target.dataset.field, e.target.value);
                });
            });

            const toggleVisibility = serviceElement.querySelector('.toggle-visibility');
            const apiKeyInput = serviceElement.querySelector('.service-key');
            toggleVisibility.addEventListener('click', () => {
                if (apiKeyInput.type === 'password') {
                    apiKeyInput.type = 'text';
                    toggleVisibility.textContent = 'Hide';
                } else {
                    apiKeyInput.type = 'password';
                    toggleVisibility.textContent = 'Show';
                }
            });

            const toggleServiceBtn = serviceElement.querySelector('.toggle-service');
            toggleServiceBtn.addEventListener('click', () => {
                this.toggleService(index);
                toggleServiceBtn.textContent = this.services[index].isActive ? 'Active' : 'Inactive';
                serviceElement.classList.toggle('inactive', !this.services[index].isActive);
            });

            const removeBtn = serviceElement.querySelector('.remove-service');
            removeBtn.addEventListener('click', () => this.removeService(index));

            const testBtn = serviceElement.querySelector('.test-btn');
            testBtn.addEventListener('click', async () => {
                const statusElement = serviceElement.querySelector('.test-status');
                testBtn.disabled = true;
                statusElement.className = 'test-status testing';
                statusElement.textContent = 'Testing...';

                const success = await testConnection(this.services[index]);

                statusElement.className = `test-status ${success ? 'success' : 'error'}`;
                statusElement.textContent = success ? 'Connection successful' : 'Connection failed';

                testBtn.disabled = false;
                setTimeout(() => {
                    statusElement.textContent = '';
                }, 3000);
            });

            if (service.type === 'claude') {
                const thinkingCheckbox = serviceElement.querySelector('.thinking-checkbox');
                if (thinkingCheckbox) {
                    thinkingCheckbox.addEventListener('change', (e) => {
                        this.updateService(index, 'thinking', e.target.checked);
                    });
                }
            }

            if (service.type === 'chatgpt') {
                const reasoningCheckbox = serviceElement.querySelector('.reasoning-checkbox');
                if (reasoningCheckbox) {
                    reasoningCheckbox.addEventListener('change', (e) => {
                        this.updateService(index, 'reasoning', e.target.checked);
                    });
                }
            }

            if (service.type === 'deepseek') {
                const mirrorCheckbox = serviceElement.querySelector('.mirror-checkbox');
                if (mirrorCheckbox) {
                    mirrorCheckbox.addEventListener('change', (e) => {
                        this.updateService(index, 'mirror', e.target.checked);
                    });
                }
            }

            servicesList.appendChild(serviceElement);
        });
    }

    onShow() {
        this.loadConfig();
    }

    onHide() {
    }
}

const configTab = new ConfigTab();
tabManager.registerTab('config-tab', configTab);
import { setupSoundManager, playConfigSound } from './soundManagerCode.js';

export class UnitSoundEditor {
    constructor() {
        this.element = null;
        this.callback = null;
        this.init();
    }

    init() {
        this.element = document.createElement('div');
        this.element.className = 'sound-manager';
        this.element.innerHTML = `
            <style>
                .sound-manager {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 9999;
                }

                .sound-manager-overlay {
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.9);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                .sound-manager-content {
                    width: 90%;
                    height: 90%;
                    background: #222;
                    border-radius: 8px;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .sound-manager-header {
                    padding: 15px;
                    background: #2a2a2a;
                    border-bottom: 1px solid #444;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .sound-manager-header h2 {
                    margin: 0;
                    color: #4CAF50;
                    font-size: 28px;
                }

                .header-controls {
                    display: flex;
                    gap: 10px;
                }

                .header-button {
                    width: 32px;
                    height: 32px;
                    background: #444;
                    border: none;
                    border-radius: 4px;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .assign-button {
                    background: #2196F3;
                }

                .play-button {
                    background: #4CAF50;
                }

                .random-button {
                    background: #2196F3;
                }

                .close-button:hover {
                    background: #555;
                }
            </style>

            <div class="sound-manager-overlay">
                <div class="sound-manager-content">
                    <div class="sound-manager-header">
                        <h2>Sound Editor</h2>
                        <div class="header-controls">
                            <button class="header-button play-button"><i class="fas fa-play"></i></button>
                            <button class="header-button random-button"><i class="fas fa-random"></i></button>
                            <button class="header-button assign-button"><i class="fas fa-save"></i></button>
                            <button class="header-button close-button"><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                    <div class="sound-manager-body">
                        <div class="control-section">
                            <h3>Oscillator</h3>
                            <div class="oscillator-type">
                                <button data-type="sine" class="active">Sine</button>
                                <button data-type="square">Square</button>
                                <button data-type="sawtooth">Saw</button>
                                <button data-type="triangle">Triangle</button>
                            </div>
                            <div class="slider-group">
                                <label>Base Frequency <span class="value-display" id="freq-value">440 Hz</span></label>
                                <input type="range" id="frequency" min="20" max="2000" value="440" step="1">
                            </div>
                            <div class="slider-group">
                                <label>Duration <span class="value-display" id="duration-value">500 ms</span></label>
                                <input type="range" id="duration" min="50" max="2000" value="500" step="10">
                            </div>
                        </div>

                        <div class="control-section">
                            <h3>Modulation</h3>
                            <div class="slider-group">
                                <label>Modulation Frequency <span class="value-display" id="modFreq-value">5 Hz</span></label>
                                <input type="range" id="modFreq" min="0.1" max="20" value="5" step="0.1">
                            </div>
                            <div class="slider-group">
                                <label>Modulation Depth <span class="value-display" id="modDepth-value">10</span></label>
                                <input type="range" id="modDepth" min="0" max="100" value="10">
                            </div>
                        </div>

                        <div class="control-section">
                            <h3>Filter & Effects</h3>
                            <div class="slider-group">
                                <label>Filter Frequency <span class="value-display" id="filterFreq-value">1000 Hz</span></label>
                                <input type="range" id="filterFreq" min="20" max="5000" value="1000">
                            </div>
                            <div class="slider-group">
                                <label>Resonance <span class="value-display" id="resonance-value">1</span></label>
                                <input type="range" id="resonance" min="0" max="20" value="1" step="0.1">
                            </div>
                        </div>

                        <div class="chaos-section">
                            <h3>Chaos Controls</h3>
                            <div class="chaos-controls">
                                <div class="chaos-slider">
                                    <label>Frequency Chaos <span id="freq-chaos-value">0%</span></label>
                                    <input type="range" id="freq-chaos" min="0" max="10" value="0">
                                </div>
                                <div class="chaos-slider">
                                    <label>Modulation Chaos <span id="mod-chaos-value">0%</span></label>
                                    <input type="range" id="mod-chaos" min="0" max="10" value="0">
                                </div>
                                <div class="switch-container">
                                    <label class="switch">
                                        <input type="checkbox" id="filter-chaos">
                                        <span class="slider"></span>
                                    </label>
                                    <span class="switch-label">Filter Chaos</span>
                                </div>
                            </div>
                        </div>

                        <div class="harmonizer-section">
                            <h3>Harmonizer</h3>
                            <div class="switch-container">
                                <label class="switch">
                                    <input type="checkbox" id="harmonizer-enabled">
                                    <span class="slider"></span>
                                </label>
                                <span class="switch-label">Enable Harmonics</span>
                            </div>
                            <div class="slider-group">
                                <label>Octave <span class="value-display" id="harmonizer-octave-value">50%</span></label>
                                <input type="range" id="harmonizer-octave" min="0" max="100" value="50">
                            </div>
                            <div class="slider-group">
                                <label>Fifth <span class="value-display" id="harmonizer-fifth-value">30%</span></label>
                                <input type="range" id="harmonizer-fifth" min="0" max="100" value="30">
                            </div>
                            <div class="slider-group">
                                <label>Major Third <span class="value-display" id="harmonizer-third-value">20%</span></label>
                                <input type="range" id="harmonizer-third" min="0" max="100" value="20">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.element);
        this.setupEventListeners();
        setupSoundManager(this);
    }

    setupEventListeners() {
        this.element.querySelector('.close-button').addEventListener('click', () => {
            this.hide();
        });

        this.element.querySelector('.assign-button').addEventListener('click', () => {
            if (this.callback) {
                this.callback(this.getCurrentConfig());
            }
            this.hide();
        });

        this.element.querySelector('.play-button').addEventListener('click', () => {
            playConfigSound(this.getCurrentConfig());
        });

        this.element.querySelector('.random-button').addEventListener('click', () => {
            const oscillatorTypes = ['sine', 'square', 'sawtooth', 'triangle'];
            const randomType = oscillatorTypes[Math.floor(Math.random() * oscillatorTypes.length)];
            this.element.querySelectorAll('.oscillator-type button').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.type === randomType);
            });

            this.element.querySelector('#frequency').value = Math.floor(Math.random() * 1980 + 20);
            this.element.querySelector('#modFreq').value = (Math.random() * 19.9 + 0.1).toFixed(1);
            this.element.querySelector('#filterFreq').value = Math.floor(Math.random() * 4980 + 20);
            this.element.querySelector('#duration').value = Math.floor(Math.random() * 1950 + 50);
            this.element.querySelector('#modDepth').value = Math.floor(Math.random() * 100);
            this.element.querySelector('#resonance').value = (Math.random() * 20).toFixed(1);
            this.element.querySelector('#freq-chaos').value = Math.floor(Math.random() * 10);
            this.element.querySelector('#mod-chaos').value = Math.floor(Math.random() * 10);
            this.element.querySelector('#filter-chaos').checked = Math.random() > 0.5;
            this.element.querySelector('#harmonizer-enabled').checked = Math.random() > 0.5;
            this.element.querySelector('#harmonizer-octave').value = Math.floor(Math.random() * 100);
            this.element.querySelector('#harmonizer-fifth').value = Math.floor(Math.random() * 100);
            this.element.querySelector('#harmonizer-third').value = Math.floor(Math.random() * 100);

            playConfigSound(this.getCurrentConfig());
        });

        this.element.querySelectorAll('.oscillator-type button').forEach(button => {
            button.addEventListener('click', () => {
                this.element.querySelectorAll('.oscillator-type button').forEach(btn => {
                    btn.classList.remove('active');
                });
                button.classList.add('active');
            });
        });
    }

    show(callback) {
        this.callback = callback;
        this.element.style.display = 'block';
    }

    hide() {
        this.element.style.display = 'none';
        this.callback = null;
    }

    getCurrentConfig() {
        const oscillatorType = this.element.querySelector('.oscillator-type button.active').dataset.type;
        return [
            oscillatorType,
            parseFloat(this.element.querySelector('#frequency').value),
            parseFloat(this.element.querySelector('#duration').value),
            parseFloat(this.element.querySelector('#modFreq').value),
            parseFloat(this.element.querySelector('#modDepth').value),
            parseFloat(this.element.querySelector('#filterFreq').value),
            parseFloat(this.element.querySelector('#resonance').value),
            parseFloat(this.element.querySelector('#freq-chaos').value),
            parseFloat(this.element.querySelector('#mod-chaos').value),
            this.element.querySelector('#filter-chaos').checked,
            this.element.querySelector('#harmonizer-enabled').checked,
            parseFloat(this.element.querySelector('#harmonizer-octave').value),
            parseFloat(this.element.querySelector('#harmonizer-fifth').value),
            parseFloat(this.element.querySelector('#harmonizer-third').value)
        ];
    }

    setSoundConfig(config) {
        if (!config || !Array.isArray(config)) return;

        const [
            oscillatorType,
            frequency,
            duration,
            modFrequency,
            modDepth,
            filterFrequency,
            filterResonance,
            chaosFrequency,
            chaosModulation,
            chaosFilter,
            harmonizerEnabled,
            harmonizerOctave,
            harmonizerFifth,
            harmonizerThird
        ] = config;

        this.element.querySelectorAll('.oscillator-type button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === oscillatorType);
        });

        this.element.querySelector('#frequency').value = frequency;
        this.element.querySelector('#duration').value = duration;
        this.element.querySelector('#modFreq').value = modFrequency;
        this.element.querySelector('#modDepth').value = modDepth;
        this.element.querySelector('#filterFreq').value = filterFrequency;
        this.element.querySelector('#resonance').value = filterResonance;
        this.element.querySelector('#freq-chaos').value = chaosFrequency;
        this.element.querySelector('#mod-chaos').value = chaosModulation;
        this.element.querySelector('#filter-chaos').checked = chaosFilter;
        this.element.querySelector('#harmonizer-enabled').checked = harmonizerEnabled;
        this.element.querySelector('#harmonizer-octave').value = harmonizerOctave;
        this.element.querySelector('#harmonizer-fifth').value = harmonizerFifth;
        this.element.querySelector('#harmonizer-third').value = harmonizerThird;
    }
}
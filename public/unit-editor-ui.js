export function createEditorDOM() {
    const editor = document.createElement('div');
    editor.className = 'unit-editor';
    editor.innerHTML = `
        <div class="editor-overlay">
            <div class="editor-content">
                <div class="editor-header">
                    <h2 id="editor-title">Edit Unit</h2>
                    <div class="header-buttons">
                        <button class="delete-unit">Delete</button>
                        <button class="save-unit">Save</button>
                        <button class="close-editor"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div class="editor-tabs">
                    <button class="editor-tab active" data-tab="basic">Basic</button>
                    <button class="editor-tab" data-tab="graphics">Graphics</button>
                    <button class="editor-tab" data-tab="sounds">Sounds</button>
                </div>
                <div class="editor-body">
                    <div class="editor-tab-content active" data-tab="basic">
                        <div class="editor-flex-row">
                            <div class="editor-section basic-section">
                                <h3>Basic Info</h3>
                                <div class="input-group">
                                    <label>Name</label>
                                    <input type="text" id="unit-name">
                                </div>
                                <div class="input-group">
                                    <label>Description</label>
                                    <textarea id="unit-description"></textarea>
                                </div>
                                <div class="input-group">
                                    <label>Cost</label>
                                    <input type="number" id="unit-cost">
                                </div>

                                <h3 class="subsection">Stats</h3>
                                <div class="input-grid">
                                    <div class="input-group">
                                        <label>Life</label>
                                        <input type="number" id="unit-life">
                                    </div>
                                    <div class="input-group">
                                        <label>Speed</label>
                                        <input type="number" id="unit-speed" step="0.1">
                                    </div>
                                    <div class="input-group">
                                        <label>Scale</label>
                                        <input type="number" id="unit-scale" step="0.5">
                                    </div>
                                    <div class="input-group">
                                        <label>Damage</label>
                                        <input type="number" id="unit-damage">
                                    </div>
                                </div>
                            </div>

                            <div class="editor-section">
                                <h3>Skills</h3>
                                <div class="skills-list" id="skills-list"></div>
                            </div>

                            <div class="editor-section">
                                <h3>Attack Configuration</h3>
                                <div class="input-group">
                                    <label>Attack Type</label>
                                    <select id="attack-type">
                                        <option value="melee">Melee</option>
                                        <option value="ranged">Ranged</option>
                                    </select>
                                </div>
                                <div id="melee-config">
                                    <div class="input-grid">
                                        <div class="input-group">
                                            <label>Attack Range</label>
                                            <input type="number" id="melee-range">
                                        </div>
                                        <div class="input-group">
                                            <label>Attack Speed (ms)</label>
                                            <input type="number" id="melee-speed">
                                        </div>
                                    </div>
                                    <div class="input-group">
                                        <label>Sword Graphics</label>
                                        <div class="sword-graphics">
                                            <div class="input-grid">
                                                <div class="input-group">
                                                    <label>Width</label>
                                                    <input type="number" id="sword-width">
                                                </div>
                                                <div class="input-group">
                                                    <label>Height</label>
                                                    <input type="number" id="sword-height">
                                                </div>
                                            </div>
                                            <div class="input-group color-input">
                                                <label>Color</label>
                                                <input type="color" id="sword-color" class="color-square">
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div id="ranged-config" style="display: none;">
                                    <div class="input-grid">
                                        <div class="input-group">
                                            <label>Optimal Range</label>
                                            <input type="number" id="optimal-range">
                                        </div>
                                        <div class="input-group">
                                            <label>Projectile Speed</label>
                                            <input type="number" id="projectile-speed">
                                        </div>
                                    </div>
                                    <div class="input-group">
                                        <label>Attack Interval (ms)</label>
                                        <div class="range-inputs">
                                            <input type="number" id="attack-interval-min" placeholder="Min">
                                            <span>-</span>
                                            <input type="number" id="attack-interval-max" placeholder="Max">
                                        </div>
                                    </div>
                                    <div class="input-group color-input">
                                        <label>Projectile Color</label>
                                        <input type="color" id="projectile-color" class="color-square">
                                    </div>
                                    <div class="input-group color-input">
                                        <label>Projectile Trail Color</label>
                                        <input type="color" id="projectile-trail-color" class="color-square">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="editor-tab-content" data-tab="graphics">
                        <h3 class="tab-title">Graphics Editor</h3>
                        <div class="editor-flex-row">
                            <div class="editor-section grid-section">
                                <div class="frame-tabs">
                                    <div class="frame-tab-buttons">
                                        <button class="frame-tab active" data-frame="idle">Frame 1 (Idle)</button>
                                        <button class="frame-tab" data-frame="move1">Frame 2 (Move)</button>
                                        <button class="frame-tab" data-frame="move2">Frame 3 (Move)</button>
                                        <button class="frame-tab" data-frame="attack">Frame 4 (Attack)</button>
                                    </div>
                                    <div class="frame-tab-actions">
                                        <button class="copy-frame">Copy</button>
                                        <button class="paste-frame">Paste</button>
                                    </div>
                                </div>
                                <div class="pixel-grid" id="pixel-grid"></div>
                            </div>

                            <div class="editor-section tools-section">
                                <div class="graphics-tools">
                                    <div class="color-picker">
                                        <label>Color</label>
                                        <input type="color" id="pixel-color" class="color-square" value="#000000">
                                    </div>
                                    <div class="common-colors">
                                        <button data-color="#32CD32" style="background: #32CD32"></button>
                                        <button data-color="#8B4513" style="background: #8B4513"></button>
                                        <button data-color="#000000" style="background: #000000"></button>
                                        <button data-color="#FF0000" style="background: #FF0000"></button>
                                        <button data-color="#4B0082" style="background: #4B0082"></button>
                                    </div>
                                    <button class="clear-pixel">Eraser</button>
                                        <button class="clear-all">Clear All</button>
                                    <div class="grid-size">
                                        <label>Grid Size</label>
                                        <div class="size-inputs">
                                            <input type="number" id="grid-width" min="3" max="12" value="5">
                                            <span>x</span>
                                            <input type="number" id="grid-height" min="3" max="12" value="7">
                                        </div>
                                        <button class="resize-grid">Resize</button>
                                    </div>
                                </div>
                            </div>

                            <div class="editor-section effects-section">
                                <h3>Effects</h3>
                                <div class="effects-list">
                                    <div class="effect-type">
                                        <label>Spawn Effect</label>
                                        <select id="spawn-effect"></select>
                                    </div>
                                    <div class="effect-type">
                                        <label>Death Effect</label>
                                        <select id="death-effect"></select>
                                    </div>
                                    <div class="effect-type">
                                        <label>Attack Effect</label>
                                        <select id="attack-effect"></select>
                                    </div>
                                    <div class="effect-type">
                                        <label>Continuous Effect</label>
                                        <select id="continuous-effect"></select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="editor-tab-content" data-tab="sounds">
                        <div class="editor-flex-row sounds-editor">
                            <div class="editor-section">
                                <h3>Spawn Sound</h3>
                                <div class="sound-config" id="spawn-sound">
                                    <div class="sound-controls">
                                        <button class="test-sound">Test</button>
                                        <button class="edit-sound">Edit</button>
                                    </div>
                                </div>
                            </div>

                            <div class="editor-section">
                                <h3>Attack Sound</h3>
                                <div class="sound-config" id="attack-sound">
                                    <div class="sound-controls">
                                        <button class="test-sound">Test</button>
                                        <button class="edit-sound">Edit</button>
                                    </div>
                                </div>
                            </div>

                            <div class="editor-section">
                                <h3>Death Sound</h3>
                                <div class="sound-config" id="death-sound">
                                    <div class="sound-controls">
                                        <button class="test-sound">Test</button>
                                        <button class="edit-sound">Edit</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="confirmation-dialog" style="display: none;">
            <h3>Delete Unit</h3>
            <p>Are you sure you want to delete this unit? This action cannot be undone.</p>
            <div class="confirmation-buttons">
                <button class="confirm-delete">Delete</button>
                <button class="cancel-delete">Cancel</button>
            </div>
        </div>
    `;

    return editor;
}

export function createFrequencyInput() {
    const frequencyGroup = document.createElement('div');
    frequencyGroup.className = 'frequency-group';
    frequencyGroup.innerHTML = `
        <div class="input-group">
            <label>Type</label>
            <select class="wave-type">
                <option value="sine">Sine</option>
                <option value="square">Square</option>
                <option value="sawtooth">Sawtooth</option>
                <option value="triangle">Triangle</option>
            </select>
        </div>
        <div class="input-group slider-group">
            <label>Frequency (Hz)</label>
            <div class="slider-with-input">
                <input type="range" class="frequency-slider" min="50" max="10000" step="1" value="440">
                <input type="number" class="frequency" min="50" max="10000" value="440">
            </div>
        </div>
        <div class="input-group slider-group">
            <label>Duration (s)</label>
            <div class="slider-with-input">
                <input type="range" class="duration-slider" min="0.1" max="2" step="0.1" value="0.2">
                <input type="number" class="duration" step="0.1" min="0.1" max="2" value="0.2">
            </div>
        </div>
        <button class="remove-frequency">×</button>
    `;

    return frequencyGroup;
}

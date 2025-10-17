export let audioCtx = null;
export let masterGain = null;
export let volume = 0.5;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = volume;
        masterGain.connect(audioCtx.destination);

        try {
            fetch('/api/config2')
                .then(response => response.json())
                .then(config => {
                    if (config.display?.volume !== undefined) {
                        setVolume(config.display.volume / 100, false);
                    }
                })
                .catch(error => {
                    console.error('Error loading volume from config:', error);
                });
        } catch (error) {
            console.error('Error initializing audio context:', error);
        }
    }
    return { audioCtx, masterGain };
}

function getCurrentSettings(element) {
    return {
        oscillator: {
            type: element.querySelector('.oscillator-type button.active').dataset.type,
            frequency: parseFloat(element.querySelector('#frequency').value)
        },
        modulation: {
            frequency: parseFloat(element.querySelector('#modFreq').value),
            depth: parseFloat(element.querySelector('#modDepth').value)
        },
        filter: {
            frequency: parseFloat(element.querySelector('#filterFreq').value),
            resonance: parseFloat(element.querySelector('#resonance').value)
        },
        duration: parseFloat(element.querySelector('#duration').value),
        chaos: {
            frequency: parseFloat(element.querySelector('#freq-chaos').value) / 100,
            modulation: parseFloat(element.querySelector('#mod-chaos').value) / 100,
            filter: element.querySelector('#filter-chaos').checked
        },
        harmonizer: {
            enabled: element.querySelector('#harmonizer-enabled').checked,
            octave: parseFloat(element.querySelector('#harmonizer-octave').value) / 100,
            fifth: parseFloat(element.querySelector('#harmonizer-fifth').value) / 100,
            third: parseFloat(element.querySelector('#harmonizer-third').value) / 100
        }
    };
}

function updateValueDisplays(element) {
    element.querySelectorAll('input[type="range"]').forEach(slider => {
        const display = element.querySelector(`#${slider.id}-value`);
        if (display) {
            let value = slider.value;
            if (slider.id.includes('Freq')) {
                value += ' Hz';
            } else if (slider.id === 'duration') {
                value += ' ms';
            } else if (slider.id.includes('chaos') || slider.id.includes('harmonizer')) {
                value = value + '%';
            }
            display.textContent = value;
        }
    });
}

function applyChaos(value, chaosAmount) {
    if (!chaosAmount || chaosAmount <= 0) return value;
    const maxDeviation = value * chaosAmount;
    return value + (Math.random() * 2 - 1) * maxDeviation;
}

function createHarmonicOscillator(baseFreq, type, multiplier, gain) {
    const { audioCtx } = initAudio();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = type;
    osc.frequency.value = baseFreq * multiplier;
    gainNode.gain.value = gain;

    osc.connect(gainNode);
    return { oscillator: osc, gain: gainNode };
}

function randomizeSettings(element) {
    const oscillatorTypes = ['sine', 'square', 'sawtooth', 'triangle'];
    const randomType = oscillatorTypes[Math.floor(Math.random() * oscillatorTypes.length)];
    element.querySelectorAll('.oscillator-type button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === randomType);
    });

    element.querySelector('#frequency').value = Math.floor(Math.random() * 1980 + 20);
    element.querySelector('#modFreq').value = (Math.random() * 19.9 + 0.1).toFixed(1);
    element.querySelector('#filterFreq').value = Math.floor(Math.random() * 4980 + 20);
    element.querySelector('#duration').value = Math.floor(Math.random() * 1950 + 50);
    element.querySelector('#modDepth').value = Math.floor(Math.random() * 100);
    element.querySelector('#resonance').value = (Math.random() * 20).toFixed(1);
    element.querySelector('#freq-chaos').value = Math.floor(Math.random() * 10);
    element.querySelector('#mod-chaos').value = Math.floor(Math.random() * 10);
    element.querySelector('#filter-chaos').checked = Math.random() > 0.5;
    element.querySelector('#harmonizer-enabled').checked = Math.random() > 0.5;
    element.querySelector('#harmonizer-octave').value = Math.floor(Math.random() * 100);
    element.querySelector('#harmonizer-fifth').value = Math.floor(Math.random() * 100);
    element.querySelector('#harmonizer-third').value = Math.floor(Math.random() * 100);

    updateValueDisplays(element);
    playSound(element);
}

function playSound(element) {
    const { audioCtx, masterGain } = initAudio();
    const settings = getCurrentSettings(element);
    const now = audioCtx.currentTime;

    const baseFreq = applyChaos(settings.oscillator.frequency, settings.chaos.frequency);
    const mainOsc = audioCtx.createOscillator();
    const mainGain = audioCtx.createGain();
    mainOsc.type = settings.oscillator.type;
    mainOsc.frequency.setValueAtTime(baseFreq, now);

    const mod = audioCtx.createOscillator();
    const modGain = audioCtx.createGain();
    const modFreq = applyChaos(settings.modulation.frequency, settings.chaos.modulation);
    mod.frequency.value = modFreq;
    modGain.gain.value = baseFreq * (settings.modulation.depth / 100);
    mod.connect(modGain);
    modGain.connect(mainOsc.frequency);

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = settings.chaos.filter ?
        (Math.random() * settings.filter.frequency) :
        settings.filter.frequency;
    filter.Q.value = settings.filter.resonance;

    let oscillators = [{ oscillator: mainOsc, gain: mainGain }];

    if (settings.harmonizer.enabled) {
        if (settings.harmonizer.octave > 0) {
            oscillators.push(createHarmonicOscillator(
                baseFreq, settings.oscillator.type, 2, settings.harmonizer.octave
            ));
        }

        if (settings.harmonizer.fifth > 0) {
            oscillators.push(createHarmonicOscillator(
                baseFreq, settings.oscillator.type, 1.5, settings.harmonizer.fifth
            ));
        }

        if (settings.harmonizer.third > 0) {
            oscillators.push(createHarmonicOscillator(
                baseFreq, settings.oscillator.type, 1.25, settings.harmonizer.third
            ));
        }
    }

    oscillators.forEach(({ oscillator, gain }) => {
        oscillator.connect(gain);
        gain.connect(filter);
    });

    filter.connect(masterGain);

    const duration = settings.duration / 1000;
    oscillators.forEach(({ oscillator, gain }) => {
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.25, now + duration * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    });

    oscillators.forEach(({ oscillator }) => {
        oscillator.start(now);
        oscillator.stop(now + duration);
    });
    mod.start(now);
    mod.stop(now + duration);

    setTimeout(() => {
        oscillators.forEach(({ oscillator, gain }) => {
            oscillator.disconnect();
            gain.disconnect();
        });
        mod.disconnect();
        modGain.disconnect();
        filter.disconnect();
    }, duration * 1000 + 100);
}
export function playConfigSound(config) {
    const REQUIRED_PARAMS = 14;

    if (!Array.isArray(config)) {
        console.warn('Sound configuration must be an array');
        return;
    }

    if (config.length < REQUIRED_PARAMS) {
        const defaultConfig = [
            "sine", 440, 200, 5, 20, 1000, 1, 0, 0,
            false, true, 50, 30, 20
        ];
        console.warn(`Invalid sound configuration - only ${config.length} parameters provided but ${REQUIRED_PARAMS} are required. Using default configuration.`);
        config = defaultConfig;
    }

    let [
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

    const validTypes = ['sine', 'square', 'sawtooth', 'triangle'];
    if (!validTypes.includes(oscillatorType)) {
        console.warn(`Invalid oscillator type: ${oscillatorType}. Defaulting to sine.`);
        oscillatorType = 'sine';
    }

    if (typeof frequency !== 'number' || frequency < 20 || frequency > 2000) {
        console.warn(`Invalid frequency: ${frequency}. Defaulting to 440Hz.`);
        frequency = 440;
    }

    if (typeof duration !== 'number' || duration < 50 || duration > 2000) {
        console.warn(`Invalid duration: ${duration}. Defaulting to 200ms.`);
        duration = 200;
    }

    if (typeof modFrequency !== 'number' || modFrequency < 0.1 || modFrequency > 20) {
        console.warn(`Invalid modulation frequency: ${modFrequency}. Defaulting to 5Hz.`);
        modFrequency = 5;
    }

    if (typeof modDepth !== 'number' || modDepth < 0 || modDepth > 100) {
        console.warn(`Invalid modulation depth: ${modDepth}. Defaulting to 20.`);
        modDepth = 20;
    }

    if (typeof filterFrequency !== 'number' || filterFrequency < 20 || filterFrequency > 5000) {
        console.warn(`Invalid filter frequency: ${filterFrequency}. Defaulting to 1000Hz.`);
        filterFrequency = 1000;
    }

    if (typeof filterResonance !== 'number' || filterResonance < 0 || filterResonance > 20) {
        console.warn(`Invalid filter resonance: ${filterResonance}. Defaulting to 1.`);
        filterResonance = 1;
    }

    if (typeof chaosFrequency !== 'number' || chaosFrequency < 0 || chaosFrequency > 10) {
        console.warn(`Invalid chaos frequency: ${chaosFrequency}. Defaulting to 0.`);
        chaosFrequency = 0;
    }

    if (typeof chaosModulation !== 'number' || chaosModulation < 0 || chaosModulation > 10) {
        console.warn(`Invalid chaos modulation: ${chaosModulation}. Defaulting to 0.`);
        chaosModulation = 0;
    }

    if (typeof chaosFilter !== 'boolean') {
        console.warn(`Invalid chaos filter: ${chaosFilter}. Defaulting to false.`);
        chaosFilter = false;
    }

    if (typeof harmonizerEnabled !== 'boolean') {
        console.warn(`Invalid harmonizer enabled: ${harmonizerEnabled}. Defaulting to true.`);
        harmonizerEnabled = true;
    }

    if (typeof harmonizerOctave !== 'number' || harmonizerOctave < 0 || harmonizerOctave > 100) {
        console.warn(`Invalid harmonizer octave: ${harmonizerOctave}. Defaulting to 50.`);
        harmonizerOctave = 50;
    }

    if (typeof harmonizerFifth !== 'number' || harmonizerFifth < 0 || harmonizerFifth > 100) {
        console.warn(`Invalid harmonizer fifth: ${harmonizerFifth}. Defaulting to 30.`);
        harmonizerFifth = 30;
    }

    if (typeof harmonizerThird !== 'number' || harmonizerThird < 0 || harmonizerThird > 100) {
        console.warn(`Invalid harmonizer third: ${harmonizerThird}. Defaulting to 20.`);
        harmonizerThird = 20;
    }

    try {
        const { audioCtx, masterGain } = initAudio();
        const now = audioCtx.currentTime;
        const durationInSecs = duration / 1000;

        const baseFreq = applyChaos(frequency, chaosFrequency);
        const mainOsc = audioCtx.createOscillator();
        const mainGain = audioCtx.createGain();
        mainOsc.type = oscillatorType;
        mainOsc.frequency.setValueAtTime(baseFreq, now);

        const mod = audioCtx.createOscillator();
        const modGain = audioCtx.createGain();
        const modFreq = applyChaos(modFrequency, chaosModulation);
        mod.frequency.value = modFreq;
        modGain.gain.value = baseFreq * (modDepth / 100);
        mod.connect(modGain);
        modGain.connect(mainOsc.frequency);

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = chaosFilter ? (Math.random() * filterFrequency) : filterFrequency;
        filter.Q.value = filterResonance;

        let oscillators = [{ oscillator: mainOsc, gain: mainGain }];

        if (harmonizerEnabled) {
            if (harmonizerOctave > 0) {
                oscillators.push(createHarmonicOscillator(baseFreq, oscillatorType, 2, harmonizerOctave / 100));
            }

            if (harmonizerFifth > 0) {
                oscillators.push(createHarmonicOscillator(baseFreq, oscillatorType, 1.5, harmonizerFifth / 100));
            }

            if (harmonizerThird > 0) {
                oscillators.push(createHarmonicOscillator(baseFreq, oscillatorType, 1.25, harmonizerThird / 100));
            }
        }

        oscillators.forEach(({ oscillator, gain }) => {
            oscillator.connect(gain);
            gain.connect(filter);
        });

        filter.connect(masterGain);

        oscillators.forEach(({ oscillator, gain }) => {
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.25, now + durationInSecs * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, now + durationInSecs);
        });

        oscillators.forEach(({ oscillator }) => {
            oscillator.start(now);
            oscillator.stop(now + durationInSecs);
        });
        mod.start(now);
        mod.stop(now + durationInSecs);

        setTimeout(() => {
            oscillators.forEach(({ oscillator, gain }) => {
                oscillator.disconnect();
                gain.disconnect();
            });
            mod.disconnect();
            modGain.disconnect();
            filter.disconnect();
        }, duration + 100);
    } catch (error) {
        console.warn('Error playing sound:', error);
    }
}

export function setVolume(value, syncWithServer = true) {
    if (volume !== value) {
        volume = value;
        if (masterGain) {
            masterGain.gain.setValueAtTime(value, audioCtx.currentTime);
        }

        if (syncWithServer) {
            try {
                fetch('/api/config2/display', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        volume: Math.round(value * 100)
                    })
                });
            } catch (error) {
                console.error('Error saving volume:', error);
            }
        }
    }
}

export function setupSoundManager(soundManager) {
    const element = soundManager.element;

    element.querySelector('.play-button').addEventListener('click', () => {
        playSound(element);
    });

    element.querySelector('.random-button').addEventListener('click', () => {
        randomizeSettings(element);
    });

    element.querySelector('.close-button').addEventListener('click', () => {
        soundManager.hide();
    });

    element.querySelectorAll('.oscillator-type button').forEach(button => {
        button.addEventListener('click', () => {
            element.querySelectorAll('.oscillator-type button').forEach(btn => {
                btn.classList.remove('active');
            });
            button.classList.add('active');
        });
    });

    element.querySelectorAll('input[type="range"]').forEach(slider => {
        slider.addEventListener('input', () => {
            updateValueDisplays(element);
        });
    });

    updateValueDisplays(element);
}
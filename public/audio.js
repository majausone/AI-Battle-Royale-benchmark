import { playConfigSound, setVolume as setMasterVolume } from './soundManagerCode.js';

document.addEventListener('click', () => {}, { once: true });

export function setVolume(value, syncWithServer = true) {
    setMasterVolume(value, syncWithServer);
}

export function playSpawnSound(unitData, sourceContext = {}) {
    if (unitData?.sounds?.spawn) {
        playConfigSound(unitData.sounds.spawn, sourceContext);
    } else {
        playConfigSound(["sine", 440, 100, 5, 10, 1000, 1, 0, 0, false, true, 50, 30, 20], sourceContext);
    }
}

export function playDeathSound(unitData, sourceContext = {}) {
    if (unitData?.sounds?.death) {
        playConfigSound(unitData.sounds.death, sourceContext);
    } else {
        playConfigSound(["sawtooth", 220, 200, 5, 10, 1000, 1, 0, 0, false, true, 50, 30, 20], sourceContext);
    }
}

export function playAttackSound(unitData, sourceContext = {}) {
    if (unitData?.sounds?.attack) {
        playConfigSound(unitData.sounds.attack, sourceContext);
    } else {
        playConfigSound(["triangle", 880, 100, 5, 10, 1000, 1, 0, 0, false, true, 50, 30, 20], sourceContext);
    }
}

export function playSkillStartSound(soundConfig, sourceContext = {}) {
    if (soundConfig?.start) {
        playConfigSound(soundConfig.start, sourceContext);
    } else {
        playConfigSound(["sine", 660, 200, 5, 10, 1000, 1, 0, 0, false, true, 50, 30, 20], sourceContext);
    }
}

export function playSkillEndSound(soundConfig, sourceContext = {}) {
    if (soundConfig?.end) {
        playConfigSound(soundConfig.end, sourceContext);
    } else {
        playConfigSound(["sine", 330, 200, 5, 10, 1000, 1, 0, 0, false, true, 50, 30, 20], sourceContext);
    }
}

export function playProjectileImpactSound(sourceContext = {}) {
    playConfigSound(["sawtooth", 120, 100, 15, 90, 2000, 10, 0, 0, false, true, 30, 20, 10], sourceContext);
}

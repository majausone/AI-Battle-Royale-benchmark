import { playConfigSound, setVolume as setMasterVolume } from './soundManagerCode.js';

document.addEventListener('click', () => {}, { once: true });

export function setVolume(value, syncWithServer = true) {
    setMasterVolume(value, syncWithServer);
}

export function playSpawnSound(unitData) {
    if (unitData?.sounds?.spawn) {
        playConfigSound(unitData.sounds.spawn);
    } else {
        playConfigSound(["sine", 440, 100, 5, 10, 1000, 1, 0, 0, false, true, 50, 30, 20]);
    }
}

export function playDeathSound(unitData) {
    if (unitData?.sounds?.death) {
        playConfigSound(unitData.sounds.death);
    } else {
        playConfigSound(["sawtooth", 220, 200, 5, 10, 1000, 1, 0, 0, false, true, 50, 30, 20]);
    }
}

export function playAttackSound(unitData) {
    if (unitData?.sounds?.attack) {
        playConfigSound(unitData.sounds.attack);
    } else {
        playConfigSound(["triangle", 880, 100, 5, 10, 1000, 1, 0, 0, false, true, 50, 30, 20]);
    }
}

export function playSkillStartSound(soundConfig) {
    if (soundConfig?.start) {
        playConfigSound(soundConfig.start);
    } else {
        playConfigSound(["sine", 660, 200, 5, 10, 1000, 1, 0, 0, false, true, 50, 30, 20]);
    }
}

export function playSkillEndSound(soundConfig) {
    if (soundConfig?.end) {
        playConfigSound(soundConfig.end);
    } else {
        playConfigSound(["sine", 330, 200, 5, 10, 1000, 1, 0, 0, false, true, 50, 30, 20]);
    }
}

export function playProjectileImpactSound() {
    playConfigSound(["sawtooth", 120, 100, 15, 90, 2000, 10, 0, 0, false, true, 30, 20, 10]);
}
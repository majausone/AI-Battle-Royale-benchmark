import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-berserkContinuous";

export default async function berserkContinuousEffect(target) {
    return await baseFx.createEffect({
        id: effectId,
        target,
        type: EFFECT_TYPES.GLOW,
        properties: {
            color: 'rgba(255, 0, 0, 1)',
            size: 1.3,
            pulseSpeed: 300,
            minAlpha: 0.2,
            maxAlpha: 0.4
        }
    });
}

berserkContinuousEffect.id = effectId;
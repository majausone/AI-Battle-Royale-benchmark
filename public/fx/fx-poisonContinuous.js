import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-poisonContinuous";

export default async function poisonContinuousEffect(target) {
    return await baseFx.createEffect({
        id: effectId,
        target,
        type: EFFECT_TYPES.SHIELD,
        properties: {
            color: 'rgba(0, 255, 0, 1)',
            size: 1.0,
            pulseSpeed: 500,
            minAlpha: 0.1,
            maxAlpha: 0.2,
            segments: 3,
            rotation: true,
            rotationSpeed: 700
        }
    });
}

poisonContinuousEffect.id = effectId;
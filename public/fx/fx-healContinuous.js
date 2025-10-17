import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-healContinuous";

export default async function healContinuousEffect(target) {
    return await baseFx.createEffect({
        id: effectId,
        target,
        type: EFFECT_TYPES.SHIELD,
        properties: {
            color: 'rgba(0, 255, 0, 1)',
            size: 1.2,
            pulseSpeed: 500,
            minAlpha: 0.1,
            maxAlpha: 0.2,
            segments: 6,
            rotation: true,
            rotationSpeed: 2000
        }
    });
}

healContinuousEffect.id = effectId;
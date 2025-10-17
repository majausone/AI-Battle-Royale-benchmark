import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-freezeContinuous";

export default async function freezeContinuousEffect(target) {
    return await baseFx.createEffect({
        id: effectId,
        target,
        type: EFFECT_TYPES.SHIELD,
        properties: {
            color: 'rgba(135, 206, 250, 1)',
            size: 1.5,
            pulseSpeed: 1000,
            minAlpha: 0.1,
            maxAlpha: 0.2,
            segments: 6,
            rotation: true,
            rotationSpeed: 1000
        }
    });
}

freezeContinuousEffect.id = effectId;
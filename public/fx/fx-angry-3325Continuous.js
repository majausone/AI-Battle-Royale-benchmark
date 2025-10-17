import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-angry-3325Continuous";

export default async function angryContinuousEffect(target) {
    return await baseFx.createEffect({
        id: effectId,
        target,
        type: EFFECT_TYPES.GLOW,
        properties: {
            color: 'rgba(255, 165, 0, 1)',
            size: 1.3,
            pulseSpeed: 200,
            minAlpha: 0.2,
            maxAlpha: 0.4
        }
    });
}

angryContinuousEffect.id = effectId;
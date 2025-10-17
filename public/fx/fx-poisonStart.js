import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-poisonStart";

export default async function poisonStartEffect(target) {
    return await baseFx.createEffect({
        id: effectId,
        target,
        type: EFFECT_TYPES.PARTICLES,
        duration: 600,
        properties: {
            particleCount: 12,
            particleSize: 3,
            particleSpeed: 2,
            particleColor: 'rgba(0, 255, 0, 1)',
            particleLife: 600,
            particleGravity: 0,
            particleShape: 'circle',
            emitterShape: 'explosion',
            fadeOut: true
        }
    });
}

poisonStartEffect.id = effectId;
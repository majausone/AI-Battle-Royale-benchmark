import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-defaultDeath";

export default async function defaultDeathEffect(target) {
    return await baseFx.createEffect({
        id: effectId,
        target,
        type: EFFECT_TYPES.PARTICLES,
        duration: 1000,
        properties: {
            particleCount: 10,
            particleSize: 2,
            particleSpeed: 2,
            particleColor: 'rgba(255, 255, 255, 1)',
            particleLife: 1000,
            particleGravity: 0,
            particleShape: 'circle',
            emitterShape: 'explosion',
            fadeOut: true
        }
    });
}

defaultDeathEffect.id = effectId;
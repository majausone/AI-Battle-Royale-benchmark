import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-basicDeath";

export default async function basicDeathEffect(target) {
    return await baseFx.createEffect({
        id: effectId,
        target,
        type: EFFECT_TYPES.PARTICLES,
        duration: 1000,
        properties: {
            particleCount: 15,
            particleSize: 3,
            particleSpeed: 2,
            particleColor: '#32CD32',
            particleLife: 1000,
            particleGravity: 0.1,
            particleShape: 'circle',
            emitterShape: 'explosion',
            fadeOut: true
        }
    });
}

basicDeathEffect.id = effectId;
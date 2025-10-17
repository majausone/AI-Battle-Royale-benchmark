import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-angry-3325Start";

export default async function angryStartEffect(target) {
    return await baseFx.createEffect({
        id: effectId,
        target,
        type: EFFECT_TYPES.EXPLOSION,
        duration: 500,
        properties: {
            color: 'rgba(255, 165, 0, 1)',
            size: 1.3,
            rays: 10,
            particleCount: 20,
            speed: 1.8
        }
    });
}

angryStartEffect.id = effectId;
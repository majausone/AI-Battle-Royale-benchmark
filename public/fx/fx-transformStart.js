import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-transformStart";

export default async function transformStartEffect(target) {
    return await baseFx.createEffect({
        id: effectId,
        target,
        type: EFFECT_TYPES.EXPLOSION,
        duration: 800,
        properties: {
            color: 'rgba(255, 0, 0, 1)',
            size: 1.2,
            rays: 5,
            particleCount: 0,
            speed: 1
        }
    });
}

transformStartEffect.id = effectId;
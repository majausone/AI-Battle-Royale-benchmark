import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-berserkStart";

export default async function berserkStartEffect(target) {
    return await baseFx.createEffect({
        id: effectId,
        target,
        type: EFFECT_TYPES.EXPLOSION,
        duration: 500,
        properties: {
            color: 'rgba(255, 0, 0, 1)',
            size: 1.2,
            rays: 8,
            particleCount: 15,
            speed: 1.5
        }
    });
}

berserkStartEffect.id = effectId;
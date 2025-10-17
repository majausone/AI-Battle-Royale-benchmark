import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-basicSpawn";

export default async function basicSpawnEffect(target) {
    return await baseFx.createEffect({
        id: effectId,
        target,
        type: EFFECT_TYPES.EXPLOSION,
        duration: 500,
        properties: {
            color: 'rgba(50, 205, 50, 1)',
            size: 1.5,
            rays: 0,
            particleCount: 0
        }
    });
}

basicSpawnEffect.id = effectId;
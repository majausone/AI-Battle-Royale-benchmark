import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-defaultSpawn";

export default async function defaultSpawnEffect(target) {
    return await baseFx.createEffect({
        id: effectId,
        target,
        type: EFFECT_TYPES.PULSE,
        duration: 500,
        properties: {
            color: 'rgba(255, 255, 255, 1)',
            size: 1.0,
            rings: 1,
            thickness: 2
        }
    });
}

defaultSpawnEffect.id = effectId;
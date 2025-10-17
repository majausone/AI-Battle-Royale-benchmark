import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-shieldStart";

export default async function shieldStartEffect(target) {
    return await baseFx.createEffect({
        id: effectId,
        target,
        type: EFFECT_TYPES.PULSE,
        duration: 500,
        properties: {
            color: 'rgba(192, 192, 192, 1)',
            size: 1.2,
            rings: 1,
            thickness: 2
        }
    });
}

shieldStartEffect.id = effectId;
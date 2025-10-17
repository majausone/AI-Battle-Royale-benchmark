import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-healPulse";

export default async function healPulseEffect(target) {
    return await baseFx.createEffect({
        id: effectId,
        target,
        type: EFFECT_TYPES.PULSE,
        duration: 500,
        properties: {
            color: 'rgba(0, 255, 0, 1)',
            size: 0.8,
            rings: 1,
            thickness: 2,
            symbol: 'plus'
        }
    });
}

healPulseEffect.id = effectId;
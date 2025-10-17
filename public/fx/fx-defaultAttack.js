import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-defaultAttack";

export default async function defaultAttackEffect(target, data) {
    return await baseFx.createEffect({
        id: effectId,
        target,
        type: EFFECT_TYPES.ATTACK,
        duration: 200,
        properties: {
            color: 'rgba(255, 255, 0, 1)',
            type: 'pulse',
            size: 1,
            speed: 1,
            position: data
        }
    });
}

defaultAttackEffect.id = effectId;
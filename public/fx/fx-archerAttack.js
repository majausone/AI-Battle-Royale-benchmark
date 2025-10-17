import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-archerAttack";

export default async function archerAttackEffect(target, data) {
    return await baseFx.createEffect({
        id: effectId,
        target,
        type: EFFECT_TYPES.ATTACK,
        duration: 400,
        properties: {
            color: 'rgba(139, 69, 19, 1)',
            type: 'bow',
            size: 1,
            speed: 1,
            position: data
        }
    });
}

archerAttackEffect.id = effectId;
import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-basicAttack";

export default async function basicAttackEffect(target, data) {
    return await baseFx.createEffect({
        id: effectId,
        target,
        type: EFFECT_TYPES.ATTACK,
        duration: 300,
        properties: {
            color: 'rgba(128, 128, 128, 1)',
            type: 'slash',
            size: 3,
            speed: 1,
            position: data
        }
    });
}

basicAttackEffect.id = effectId;
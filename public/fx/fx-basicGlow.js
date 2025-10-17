import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-basicGlow";

export default async function basicGlowEffect(target) {
    return await baseFx.createEffect({
        id: effectId,
        target,
        type: EFFECT_TYPES.GLOW,
        properties: {
            color: 'rgba(50, 205, 50, 1)',
            size: 1.2,
            pulseSpeed: 1000,
            minAlpha: 0.1,
            maxAlpha: 0.2
        }
    });
}

basicGlowEffect.id = effectId;
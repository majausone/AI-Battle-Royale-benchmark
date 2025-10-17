import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-transformContinuous";

export default async function transformContinuousEffect(target) {
    try {
        const cleanup = await baseFx.createEffect({
            id: effectId,
            target,
            type: EFFECT_TYPES.GLOW,
            properties: {
                color: 'rgba(255, 0, 0, 1)',
                size: 1.3,
                pulseSpeed: 200,
                minAlpha: 0.2,
                maxAlpha: 0.3
            }
        });
        
        return typeof cleanup === 'function' ? cleanup : function() {};
    } catch (error) {
        console.warn("Error creating transform continuous effect:", error);
        return function() {};
    }
}

transformContinuousEffect.id = effectId;
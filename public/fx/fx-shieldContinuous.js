import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-shieldContinuous";

export default function shieldContinuousEffect(target) {
    try {
        const uniqueEffectId = `${effectId}-${target.id}`;
        let cleanupFunc = null;
        
        baseFx.createEffect({
            id: uniqueEffectId,
            target,
            type: EFFECT_TYPES.SHIELD,
            properties: {
                color: 'rgba(192, 192, 192, 1)',
                size: 1.2,
                pulseSpeed: 500,
                minAlpha: 0.2,
                maxAlpha: 0.3,
                segments: 6,
                rotation: true,
                rotationSpeed: 2000
            }
        }).then(cleanup => {
            cleanupFunc = cleanup;
        });
        
        return function() {
            if (typeof cleanupFunc === 'function') {
                cleanupFunc();
            }
        };
    } catch (error) {
        console.warn("Error creating shield continuous effect:", error);
        return function() {};
    }
}

shieldContinuousEffect.id = effectId;
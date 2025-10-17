import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-cloneContinuous";

export default async function cloneContinuousEffect(target) {
    let renderModule;
    try {
        renderModule = await import('../render.js');
    } catch (error) {
        console.error('Error loading modules:', error);
        return function() {};
    }

    const id = `clone-continuous-${target.id}`;
    const startTime = performance.now();
    const effectSize = 20;

    const effect = {
        render(ctx) {
            if (!target || target.health <= 0) {
                renderModule.removeEffect(id);
                return;
            }

            const elapsed = performance.now() - startTime;
            const baseAlpha = 0.3 + Math.sin(elapsed / 300) * 0.1;
            const centerX = target.x + target.width / 2;
            const centerY = target.y + target.height / 2;

            ctx.save();

            ctx.beginPath();
            ctx.rect(centerX - effectSize / 2, centerY - effectSize / 2, effectSize, effectSize);
            ctx.strokeStyle = `rgba(255, 255, 255, ${baseAlpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();

            const ghostOffset = Math.sin(elapsed / 200) * 3;
            ctx.beginPath();
            ctx.rect(centerX - effectSize / 2 + ghostOffset, centerY - effectSize / 2, effectSize, effectSize);
            ctx.strokeStyle = `rgba(255, 255, 255, ${baseAlpha * 0.5})`;
            ctx.stroke();

            ctx.restore();
        }
    };
    
    renderModule.addEffect(id, effect);
    
    return function() {
        if (renderModule) {
            renderModule.removeEffect(id);
        }
    };
}

cloneContinuousEffect.id = effectId;
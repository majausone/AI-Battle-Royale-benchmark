import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-cloneStart";

export default async function cloneStartEffect(target) {
    let renderModule;
    try {
        renderModule = await import('../render.js');
    } catch (error) {
        console.error('Error loading render module:', error);
        return;
    }

    const startTime = performance.now();
    const duration = 500;
    const id = `clone-start-${target.id}`;
    const effectSize = 20;

    const effect = {
        render(ctx) {
            const elapsed = performance.now() - startTime;
            if (elapsed >= duration) {
                renderModule.removeEffect(id);
                return;
            }

            const progress = elapsed / duration;
            const alpha = 1 - progress;
            const centerX = target.x + target.width / 2;
            const centerY = target.y + target.height / 2;

            ctx.save();

            const mirrorDistance = effectSize * progress;

            ctx.beginPath();
            ctx.moveTo(centerX - mirrorDistance, centerY - effectSize);
            ctx.lineTo(centerX - mirrorDistance, centerY + effectSize);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.stroke();

            for (let i = 0; i < 10; i++) {
                const particleProgress = (progress + i / 10) % 1;
                const x = centerX - mirrorDistance + particleProgress * effectSize;
                const y = centerY + (Math.random() - 0.5) * effectSize;

                ctx.beginPath();
                ctx.arc(x, y, 2, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
                ctx.fill();
            }

            ctx.restore();
        }
    };
    
    renderModule.addEffect(id, effect);
}

cloneStartEffect.id = effectId;
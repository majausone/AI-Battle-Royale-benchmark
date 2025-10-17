import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-freezeStart";

export default async function freezeStartEffect(target) {
    let renderModule;
    try {
        renderModule = await import('../render.js');
    } catch (error) {
        console.error('Error loading render module:', error);
        return;
    }

    const startTime = performance.now();
    const duration = 500;
    const id = `freeze-start-${target.id}`;
    const radius = Math.max(target.width, target.height) * 2;

    const effect = {
        render(ctx) {
            const elapsed = performance.now() - startTime;
            if (elapsed >= duration) {
                renderModule.removeEffect(id);
                return;
            }

            const progress = elapsed / duration;
            const alpha = 1 - progress;
            const currentRadius = radius * progress;

            ctx.save();
            ctx.translate(target.x + target.width / 2, target.y + target.height / 2);

            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                ctx.save();
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(currentRadius * 0.7, currentRadius * 0.3);
                ctx.lineTo(currentRadius, 0);
                ctx.strokeStyle = `rgba(135, 206, 235, ${alpha})`;
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            }

            ctx.beginPath();
            ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(135, 206, 250, ${alpha * 0.2})`;
            ctx.fill();

            ctx.restore();
        }
    };
    
    renderModule.addEffect(id, effect);
}

freezeStartEffect.id = effectId;
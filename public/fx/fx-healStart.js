import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-healStart";

export default async function healStartEffect(target) {
    let renderModule;
    try {
        renderModule = await import('../render.js');
    } catch (error) {
        console.error('Error loading render module:', error);
        return;
    }

    const startTime = performance.now();
    const duration = 600;
    const id = `heal-start-${target.id}`;

    const effect = {
        render(ctx) {
            const elapsed = performance.now() - startTime;
            if (elapsed >= duration) {
                renderModule.removeEffect(id);
                return;
            }

            const progress = elapsed / duration;
            const alpha = 1 - progress;
            const radius = target.width * 2 * progress;

            ctx.save();
            ctx.translate(target.x + target.width / 2, target.y + target.height / 2);

            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 255, 0, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.stroke();

            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2 + progress * Math.PI;
                const crossRadius = radius * 0.7;
                const x = Math.cos(angle) * crossRadius;
                const y = Math.sin(angle) * crossRadius;
                const size = 10;

                ctx.beginPath();
                ctx.moveTo(x - size, y);
                ctx.lineTo(x + size, y);
                ctx.moveTo(x, y - size);
                ctx.lineTo(x, y + size);
                ctx.strokeStyle = `rgba(0, 255, 0, ${alpha})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            ctx.restore();
        }
    };
    
    renderModule.addEffect(id, effect);
}

healStartEffect.id = effectId;
import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-damageEffect";

export default async function damageEffect(target, data) {
    let renderModule;
    try {
        renderModule = await import('../render.js');
    } catch (error) {
        console.error('Error loading render module:', error);
        return;
    }

    const startTime = performance.now();
    const duration = 300;
    const id = `damage-${target.id}-${startTime}`;

    const effect = {
        render(ctx) {
            const elapsed = performance.now() - startTime;
            if (elapsed >= duration) {
                renderModule.removeEffect(id);
                return;
            }

            const progress = elapsed / duration;
            const alpha = 1 - progress;

            ctx.save();
            ctx.translate(target.x + target.width / 2, target.y + target.height / 2);

            ctx.beginPath();
            ctx.arc(0, 0, target.width / 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 0, 0, ${alpha * 0.3})`;
            ctx.fill();

            if (data && data.damage) {
                ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
                ctx.font = '14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(-data.damage, 0, -20 - progress * 20);
            }

            ctx.restore();
        }
    };

    renderModule.addEffect(id, effect);
}

damageEffect.id = effectId;
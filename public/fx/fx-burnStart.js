import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-burnStart";

export default async function burnStartEffect(target, data) {
    let renderModule;
    try {
        renderModule = await import('../render.js');
    } catch (error) {
        console.error('Error loading render module:', error);
        return;
    }

    const startTime = performance.now();
    const duration = 600;
    const id = `burn-start-${target.id}-${startTime}`;

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
            const radius = target.width * (1 + progress * 0.5);

            ctx.save();
            ctx.translate(centerX, centerY);

            const explosionGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
            explosionGradient.addColorStop(0, `rgba(255, 69, 0, ${alpha * 0.7})`);
            explosionGradient.addColorStop(0.6, `rgba(255, 140, 0, ${alpha * 0.4})`);
            explosionGradient.addColorStop(1, `rgba(255, 215, 0, 0)`);

            ctx.fillStyle = explosionGradient;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();

            const particleCount = 12;
            for (let i = 0; i < particleCount; i++) {
                const angle = (i / particleCount) * Math.PI * 2;
                const distance = radius * 0.7 * progress;
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                const particleSize = 2 + Math.random() * 2;

                ctx.beginPath();
                ctx.arc(x, y, particleSize, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 215, 0, ${alpha * (0.5 + Math.random() * 0.5)})`;
                ctx.fill();
            }

            if (data && data.damage) {
                ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
                ctx.font = '14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(-data.damage, 0, -20 - progress * 15);
            }

            ctx.restore();
        }
    };
    
    renderModule.addEffect(id, effect);
}

burnStartEffect.id = effectId;
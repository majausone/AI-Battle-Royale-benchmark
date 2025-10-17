import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-totemStart-6846";

export default async function totemStartEffect(target, data) {
    let renderModule;
    try {
        renderModule = await import('../render.js');
    } catch (error) {
        console.error('Error loading render module:', error);
        return;
    }

    const startTime = performance.now();
    const duration = 500;
    const id = `totem-start-${target.id}-${startTime}`;

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
            const size = 30 * Math.sin(progress * Math.PI);

            ctx.save();
            ctx.translate(centerX, centerY);

            const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
            glowGradient.addColorStop(0, `rgba(255, 255, 0, ${alpha * 0.8})`);
            glowGradient.addColorStop(0.6, `rgba(255, 215, 0, ${alpha * 0.3})`);
            glowGradient.addColorStop(1, `rgba(255, 165, 0, 0)`);

            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();

            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2 + progress * Math.PI;
                const dist = size * 0.6;
                const particleSize = 2 + Math.sin(progress * Math.PI) * 3;
                
                ctx.beginPath();
                ctx.arc(
                    Math.cos(angle) * dist,
                    Math.sin(angle) * dist,
                    particleSize,
                    0, Math.PI * 2
                );
                ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
                ctx.fill();
            }

            const innerRadius = size * 0.4;
            ctx.beginPath();
            ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.7})`;
            ctx.fill();

            ctx.restore();
        }
    };
    
    renderModule.addEffect(id, effect);
}

totemStartEffect.id = effectId;
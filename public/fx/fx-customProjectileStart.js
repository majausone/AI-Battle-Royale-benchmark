import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-customProjectileStart";

export default async function customProjectileStartEffect(target) {
    let renderModule;
    try {
        renderModule = await import('../render.js');
    } catch (error) {
        console.error('Error loading render module:', error);
        return;
    }

    const startTime = performance.now();
    const duration = 400;
    const id = `projectile-start-${target.id}-${startTime}`;

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
            glowGradient.addColorStop(0, `rgba(70, 130, 180, ${alpha * 0.8})`);
            glowGradient.addColorStop(0.6, `rgba(70, 130, 180, ${alpha * 0.3})`);
            glowGradient.addColorStop(1, `rgba(70, 130, 180, 0)`);

            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();

            for (let i = 0; i < 5; i++) {
                const angle = (i / 5) * Math.PI * 2 + progress * Math.PI;
                const dist = size * 0.6;
                const particleSize = 2 + Math.sin(progress * Math.PI) * 3;
                
                ctx.beginPath();
                ctx.arc(
                    Math.cos(angle) * dist,
                    Math.sin(angle) * dist,
                    particleSize,
                    0, Math.PI * 2
                );
                ctx.fillStyle = `rgba(135, 206, 235, ${alpha})`;
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

customProjectileStartEffect.id = effectId;
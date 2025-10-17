import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-explosion-start-3809";

export default async function explosionStartEffect(target, data) {
    let renderModule;
    try {
        renderModule = await import('../render.js');
    } catch (error) {
        console.error('Error loading render module:', error);
        return;
    }

    const startTime = performance.now();
    const duration = 800;
    const id = `explosion-start-${target.id}-${startTime}`;

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
            const size = 120 * progress;

            ctx.save();
            ctx.translate(centerX, centerY);

            const outerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
            outerGradient.addColorStop(0, `rgba(255, 165, 0, ${alpha})`);
            outerGradient.addColorStop(0.3, `rgba(255, 69, 0, ${alpha * 0.7})`);
            outerGradient.addColorStop(0.7, `rgba(178, 34, 34, ${alpha * 0.4})`);
            outerGradient.addColorStop(1, `rgba(139, 0, 0, 0)`);

            ctx.fillStyle = outerGradient;
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();

            const innerSize = size * 0.6;
            const innerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, innerSize);
            innerGradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
            innerGradient.addColorStop(0.5, `rgba(255, 215, 0, ${alpha * 0.8})`);
            innerGradient.addColorStop(1, `rgba(255, 140, 0, 0)`);

            ctx.fillStyle = innerGradient;
            ctx.beginPath();
            ctx.arc(0, 0, innerSize, 0, Math.PI * 2);
            ctx.fill();

            const particleCount = 30;
            for (let i = 0; i < particleCount; i++) {
                const angle = (i / particleCount) * Math.PI * 2;
                const distance = size * (0.2 + 0.8 * progress);
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                const particleSize = 3 + Math.random() * 4;

                ctx.beginPath();
                ctx.arc(x, y, particleSize, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, ${Math.floor(165 + Math.random() * 90)}, 0, ${alpha * 0.8})`;
                ctx.fill();
            }

            const fragmentCount = 20;
            for (let i = 0; i < fragmentCount; i++) {
                const angle = (i / fragmentCount) * Math.PI * 2 + Math.random() * 0.5;
                const distance = size * (0.3 + 0.7 * progress);
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                const fragmentSize = 2 + Math.random() * 3;

                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(angle);
                
                ctx.beginPath();
                ctx.moveTo(-fragmentSize, -fragmentSize);
                ctx.lineTo(fragmentSize, -fragmentSize/2);
                ctx.lineTo(fragmentSize/2, fragmentSize);
                ctx.lineTo(-fragmentSize/2, fragmentSize/2);
                ctx.closePath();
                
                ctx.fillStyle = `rgba(139, 0, 0, ${alpha * 0.6})`;
                ctx.fill();
                ctx.restore();
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

explosionStartEffect.id = effectId;
import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-totemImpact-6846";

export default async function totemImpactEffect(target, data) {
    let renderModule;
    try {
        renderModule = await import('../render.js');
    } catch (error) {
        console.error('Error loading render module:', error);
        return;
    }

    const startTime = performance.now();
    const duration = 800;
    const id = `totem-impact-${target.id}-${startTime}`;

    const position = data || {
        x: target.x + target.width / 2,
        y: target.y + target.height / 2
    };

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
            ctx.translate(position.x, position.y);
            
            const radius = 50 * progress;
            
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
            gradient.addColorStop(0, `rgba(255, 255, 0, ${alpha * 0.7})`);
            gradient.addColorStop(0.7, `rgba(255, 215, 0, ${alpha * 0.4})`);
            gradient.addColorStop(1, `rgba(255, 165, 0, 0)`);
            ctx.fillStyle = gradient;
            ctx.fill();
            
            const innerRadius = 10 * (1 - progress);
            ctx.beginPath();
            ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fill();
            
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const rayLength = radius * 1.2;
                
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(
                    Math.cos(angle) * rayLength,
                    Math.sin(angle) * rayLength
                );
                ctx.strokeStyle = `rgba(255, 215, 0, ${alpha * 0.6})`;
                ctx.lineWidth = 2;
                ctx.stroke();
                
                const cloudX = Math.cos(angle) * (radius * 0.7);
                const cloudY = Math.sin(angle) * (radius * 0.7);
                const cloudSize = 8 * (1 - progress * 0.5);
                
                ctx.beginPath();
                ctx.arc(cloudX, cloudY, cloudSize, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 0, ${alpha * 0.4})`;
                ctx.fill();
            }
            
            if (data && data.areaEffect) {
                const areaRadius = (data.areaRadius || 100) * progress;
                ctx.beginPath();
                ctx.arc(0, 0, areaRadius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 215, 0, ${alpha * 0.5})`;
                ctx.setLineDash([5, 5]);
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.setLineDash([]);
            }
            
            ctx.restore();
        }
    };
    
    renderModule.addEffect(id, effect);
}

totemImpactEffect.id = effectId;
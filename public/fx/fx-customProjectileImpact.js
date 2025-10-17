import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-customProjectileImpact";

export default async function customProjectileImpactEffect(target, data) {
    let renderModule;
    try {
        renderModule = await import('../render.js');
    } catch (error) {
        console.error('Error loading render module:', error);
        return;
    }

    const startTime = performance.now();
    const duration = 600;
    const id = `projectile-impact-${target.id}-${startTime}`;
    
    const position = data || {
        x: target.x + target.width / 2,
        y: target.y + target.height / 2
    };

    const particles = [];
    const particleCount = 20;
    
    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 2;
        particles.push({
            x: 0,
            y: 0,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 1 + Math.random() * 3,
            color: Math.random() > 0.7 ? '#4682B4' : '#87CEEB',
            alpha: 0.8 + Math.random() * 0.2
        });
    }

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
            
            const waveRadius = 50 * progress;
            ctx.beginPath();
            ctx.arc(0, 0, waveRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(70, 130, 180, ${alpha * 0.6})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            
            const innerRadius = 15 * (1 - progress);
            ctx.beginPath();
            ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(70, 130, 180, ${alpha * 0.5})`;
            ctx.fill();
            
            for (const particle of particles) {
                particle.x += particle.vx;
                particle.y += particle.vy;
                
                const particleAlpha = particle.alpha * (1 - progress);
                const particleSize = particle.size * (1 - progress * 0.5);
                
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particleSize, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${particle.color === '#4682B4' ? '70, 130, 180' : '135, 206, 235'}, ${particleAlpha})`;
                ctx.fill();
            }
            
            if (data && data.areaEffect) {
                const areaRadius = (data.areaRadius || 80) * progress;
                ctx.beginPath();
                ctx.arc(0, 0, areaRadius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(70, 130, 180, ${alpha * 0.3})`;
                ctx.setLineDash([5, 5]);
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.setLineDash([]);
            }
            
            ctx.restore();
            
            if (data && data.damage && progress < 0.3) {
                ctx.save();
                ctx.fillStyle = `rgba(255, 0, 0, ${(1 - progress * 3) * 0.8})`;
                ctx.font = '14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(-data.damage, position.x, position.y - 20 - progress * 20);
                ctx.restore();
            }
        }
    };
    
    renderModule.addEffect(id, effect);
}

customProjectileImpactEffect.id = effectId;
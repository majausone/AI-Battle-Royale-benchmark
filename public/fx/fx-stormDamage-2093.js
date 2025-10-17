import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-stormDamage-2093";

export default async function stormDamageEffect(target, data) {
    let renderModule;
    try {
        renderModule = await import('../render.js');
    } catch (error) {
        console.error('Error loading render module:', error);
        return;
    }

    const startTime = performance.now();
    const duration = 300;
    const id = `storm-damage-${target.id}-${startTime}`;

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
            
            // Dibujar rayo principal
            const boltLength = 30 * (1 - progress);
            const angle = Math.PI * 1.5; // rayo de arriba a abajo
            const startX = centerX;
            const startY = centerY - target.height;
            
            const endX = centerX;
            const endY = centerY;
            
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            
            const segments = 4;
            let prevX = startX;
            let prevY = startY;
            
            for (let i = 1; i <= segments; i++) {
                const t = i / segments;
                const nextX = startX + (endX - startX) * t;
                const nextY = startY + (endY - startY) * t;
                
                const offset = 5 * Math.sin(t * Math.PI);
                const perpX = -Math.sin(angle) * offset;
                const perpY = Math.cos(angle) * offset;
                
                const midX = nextX + perpX;
                const midY = nextY + perpY;
                
                ctx.lineTo(midX, midY);
            }
            
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 3;
            ctx.stroke();
            
            ctx.strokeStyle = `rgba(30, 144, 255, ${alpha * 0.7})`;
            ctx.lineWidth = 6;
            ctx.stroke();
            
            // Círculo de impacto
            const impactRadius = 15 * progress;
            ctx.beginPath();
            ctx.arc(centerX, centerY, impactRadius, 0, Math.PI * 2);
            
            const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, impactRadius);
            gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
            gradient.addColorStop(0.6, `rgba(30, 144, 255, ${alpha * 0.7})`);
            gradient.addColorStop(1, `rgba(25, 25, 112, 0)`);
            
            ctx.fillStyle = gradient;
            ctx.fill();
            
            // Pequeños rayos secundarios
            const smallBoltCount = 3;
            for (let i = 0; i < smallBoltCount; i++) {
                const smallAngle = (i / smallBoltCount) * Math.PI * 2;
                const smallStartX = centerX;
                const smallStartY = centerY;
                const smallLength = 10 * (1 - progress);
                
                const smallEndX = smallStartX + Math.cos(smallAngle) * smallLength;
                const smallEndY = smallStartY + Math.sin(smallAngle) * smallLength;
                
                ctx.beginPath();
                ctx.moveTo(smallStartX, smallStartY);
                ctx.lineTo(smallEndX, smallEndY);
                
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            
            // Texto de daño
            if (data && data.damage) {
                ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
                ctx.font = '14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(-data.damage, centerX, centerY - 20 - progress * 15);
            }
            
            ctx.restore();
        }
    };
    
    renderModule.addEffect(id, effect);
}

stormDamageEffect.id = effectId;
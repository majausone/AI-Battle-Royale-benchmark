import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-totemFieldContinuous-6846";

export default async function totemFieldContinuousEffect(position) {
    let renderModule;
    try {
        renderModule = await import('../render.js');
    } catch (error) {
        console.error('Error loading render module:', error);
        return function() {};
    }

    const id = `totem-field-continuous-${Date.now()}`;
    const startTime = performance.now();
    const radius = 100;
    
    const effect = {
        render(ctx) {
            const elapsed = performance.now() - startTime;
            
            ctx.save();
            ctx.translate(position.x, position.y);
            
            const pulseScale = 1 + 0.1 * Math.sin(elapsed / 500);
            const rotationAngle = elapsed / 2000;
            
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * pulseScale);
            gradient.addColorStop(0, 'rgba(255, 255, 0, 0.1)');
            gradient.addColorStop(0.7, 'rgba(255, 215, 0, 0.05)');
            gradient.addColorStop(1, 'rgba(255, 165, 0, 0)');
            
            ctx.beginPath();
            ctx.arc(0, 0, radius * pulseScale, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(0, 0, radius * pulseScale, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            const innerRadius = 15;
            ctx.beginPath();
            ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
            const innerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, innerRadius);
            innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
            innerGradient.addColorStop(1, 'rgba(255, 255, 0, 0.3)');
            ctx.fillStyle = innerGradient;
            ctx.fill();
            
            ctx.rotate(rotationAngle);
            
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const x = Math.cos(angle) * radius * 0.6;
                const y = Math.sin(angle) * radius * 0.6;
                const runeSize = 8;
                
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(-rotationAngle * 2 + angle);
                
                ctx.beginPath();
                ctx.moveTo(-runeSize/2, -runeSize/2);
                ctx.lineTo(runeSize/2, -runeSize/2);
                ctx.lineTo(runeSize/2, runeSize/2);
                ctx.lineTo(-runeSize/2, runeSize/2);
                ctx.closePath();
                ctx.strokeStyle = `rgba(255, 215, 0, ${0.3 + 0.2 * Math.sin(elapsed / 300 + i)})`;
                ctx.lineWidth = 1;
                ctx.stroke();
                
                ctx.restore();
            }
            
            ctx.restore();
        }
    };
    
    renderModule.addEffect(id, effect);
    
    return function() {
        renderModule.removeEffect(id);
    };
}

totemFieldContinuousEffect.id = effectId;
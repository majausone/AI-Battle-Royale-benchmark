import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-totemBuffStart-6846";

export default async function totemBuffStartEffect(target) {
    let renderModule;
    try {
        renderModule = await import('../render.js');
    } catch (error) {
        console.error('Error loading render module:', error);
        return;
    }

    const startTime = performance.now();
    const duration = 400;
    const id = `totem-buff-start-${target.id}-${startTime}`;

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
            ctx.translate(centerX, centerY);
            
            const size = 25 * Math.sin(progress * Math.PI);
            const runeCount = 3;
            
            for (let i = 0; i < runeCount; i++) {
                const angle = (i / runeCount) * Math.PI * 2;
                const distance = size;
                
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(angle + Math.PI/4);
                
                const runeSize = 6 + 4 * Math.sin(progress * Math.PI);
                
                ctx.beginPath();
                ctx.moveTo(-runeSize/2, -runeSize/2);
                ctx.lineTo(runeSize/2, -runeSize/2);
                ctx.lineTo(runeSize/2, runeSize/2);
                ctx.lineTo(-runeSize/2, runeSize/2);
                ctx.closePath();
                ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
                ctx.fill();
                
                ctx.restore();
            }
            
            ctx.beginPath();
            ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);
            gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
            gradient.addColorStop(1, `rgba(255, 215, 0, ${alpha * 0.7})`);
            ctx.fillStyle = gradient;
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 215, 0, ${alpha * 0.5})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            
            const sparks = 6;
            for (let i = 0; i < sparks; i++) {
                const sparkAngle = Math.random() * Math.PI * 2;
                const sparkDist = size * Math.random();
                const sparkSize = 1 + Math.random() * 2;
                
                ctx.beginPath();
                ctx.arc(
                    Math.cos(sparkAngle) * sparkDist,
                    Math.sin(sparkAngle) * sparkDist,
                    sparkSize, 
                    0, 
                    Math.PI * 2
                );
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
                ctx.fill();
            }
            
            ctx.restore();
        }
    };
    
    renderModule.addEffect(id, effect);
}

totemBuffStartEffect.id = effectId;
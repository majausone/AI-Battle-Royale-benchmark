import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-burnContinuous";

export default async function burnContinuousEffect(target) {
    let renderModule;
    try {
        renderModule = await import('../render.js');
    } catch (error) {
        console.error('Error loading render module:', error);
        return;
    }

    const id = `burn-continuous-${target.id}`;
    const startTime = performance.now();
    
    const effect = {
        render(ctx) {
            if (!target || target.health <= 0) {
                renderModule.removeEffect(id);
                return;
            }

            const elapsed = performance.now() - startTime;
            const centerX = target.x + target.width / 2;
            const centerY = target.y + target.height / 2;
            
            const particleCount = 8;
            const maxHeight = target.height * 1.5;
            
            ctx.save();
            
            for (let i = 0; i < particleCount; i++) {
                const offset = (i / particleCount) + ((elapsed % 1000) / 1000);
                const normalizedOffset = offset % 1;
                
                const x = target.x + (Math.sin(normalizedOffset * Math.PI * 4) * target.width * 0.3) + target.width / 2;
                const y = target.y + target.height - (normalizedOffset * maxHeight);
                
                const alpha = Math.sin(normalizedOffset * Math.PI) * 0.7;
                const size = 2 + (normalizedOffset * 3);
                
                const colorStop = Math.random();
                let color;
                
                if (colorStop < 0.3) {
                    color = `rgba(255, 69, 0, ${alpha})`;  // Red-orange
                } else if (colorStop < 0.7) {
                    color = `rgba(255, 140, 0, ${alpha})`;  // Dark orange
                } else {
                    color = `rgba(255, 215, 0, ${alpha})`;  // Gold
                }
                
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
            }
            
            const heatDistortion = Math.sin(elapsed / 200) * 3;
            ctx.beginPath();
            ctx.moveTo(target.x, target.y + target.height);
            ctx.bezierCurveTo(
                target.x + target.width * 0.3, target.y + target.height + heatDistortion,
                target.x + target.width * 0.7, target.y + target.height - heatDistortion,
                target.x + target.width, target.y + target.height
            );
            ctx.strokeStyle = 'rgba(255, 140, 0, 0.2)';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.restore();
        }
    };
    
    renderModule.addEffect(id, effect);
    return () => renderModule.removeEffect(id);
}

burnContinuousEffect.id = effectId;
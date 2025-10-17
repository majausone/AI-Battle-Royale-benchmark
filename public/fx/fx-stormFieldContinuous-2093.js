import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-stormFieldContinuous-2093";

export default async function stormFieldContinuousEffect(position) {
    let renderModule;
    try {
        renderModule = await import('../render.js');
    } catch (error) {
        console.error('Error loading render module:', error);
        return function() {};
    }

    const id = `storm-field-continuous-${Date.now()}`;
    const startTime = performance.now();
    const radius = 80;
    
    const spikeCount = 25;
    const iceSpikes = [];
    
    const baseDirectionX = -0.2;
    
    for (let i = 0; i < spikeCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * radius * 0.9;
        
        iceSpikes.push({
            x: Math.cos(angle) * distance,
            y: -radius - Math.random() * radius,
            width: 2 + Math.random() * 3,
            height: 10 + Math.random() * 25,
            speed: 7 + Math.random() * 4,
            dirX: baseDirectionX + Math.random() * 0.2 - 0.1,
            dirY: 0.9 + Math.random() * 0.2,
            alpha: 0.7 + Math.random() * 0.3,
            delay: Math.random() * 1000
        });
    }
    
    const effect = {
        render(ctx) {
            const elapsed = performance.now() - startTime;
            
            ctx.save();
            ctx.translate(position.x, position.y);
            
            for (const spike of iceSpikes) {
                if (elapsed < spike.delay) continue;
                
                spike.y += spike.speed * spike.dirY;
                spike.x += spike.speed * spike.dirX;
                
                if (spike.y > radius || Math.abs(spike.x) > radius) {
                    const angle = Math.random() * Math.PI * 2;
                    const distance = Math.random() * radius * 0.8;
                    
                    spike.x = Math.cos(angle) * distance;
                    spike.y = -radius;
                    spike.width = 2 + Math.random() * 3;
                    spike.height = 10 + Math.random() * 25;
                    spike.speed = 7 + Math.random() * 4;
                    spike.dirX = baseDirectionX + Math.random() * 0.2 - 0.1;
                    spike.dirY = 0.9 + Math.random() * 0.2;
                }
                
                ctx.save();
                ctx.translate(spike.x, spike.y);
                
                const rotationAngle = Math.atan2(spike.dirY, spike.dirX);
                ctx.rotate(rotationAngle + Math.PI/2);
                
                const gradient = ctx.createLinearGradient(0, 0, 0, spike.height);
                gradient.addColorStop(0, `rgba(255, 255, 255, ${spike.alpha})`);
                gradient.addColorStop(0.7, `rgba(135, 206, 250, ${spike.alpha})`);
                gradient.addColorStop(1, `rgba(0, 191, 255, ${spike.alpha * 0.8})`);
                
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-spike.width/2, spike.height/4);
                ctx.lineTo(-spike.width/2, spike.height);
                ctx.lineTo(spike.width/2, spike.height);
                ctx.lineTo(spike.width/2, spike.height/4);
                ctx.closePath();
                
                ctx.fillStyle = gradient;
                ctx.fill();
                
                ctx.strokeStyle = `rgba(255, 255, 255, ${spike.alpha * 0.8})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
                
                ctx.restore();
            }
            
            if (Math.random() < 0.05) {
                const flashX = (Math.random() * 2 - 1) * radius * 0.8;
                const flashY = (Math.random() * 2 - 1) * radius * 0.8;
                const flashSize = 3 + Math.random() * 5;
                
                ctx.beginPath();
                ctx.arc(flashX, flashY, flashSize, 0, Math.PI * 2);
                const flashGradient = ctx.createRadialGradient(
                    flashX, flashY, 0, 
                    flashX, flashY, flashSize
                );
                flashGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
                flashGradient.addColorStop(0.7, 'rgba(135, 206, 250, 0.6)');
                flashGradient.addColorStop(1, 'rgba(0, 191, 255, 0)');
                ctx.fillStyle = flashGradient;
                ctx.fill();
            }
            
            const vortexSize = 10 + Math.sin(elapsed / 300) * 3;
            const vortexGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, vortexSize);
            vortexGradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
            vortexGradient.addColorStop(0.5, 'rgba(135, 206, 250, 0.5)');
            vortexGradient.addColorStop(1, 'rgba(0, 191, 255, 0)');
            
            ctx.beginPath();
            ctx.arc(0, 0, vortexSize, 0, Math.PI * 2);
            ctx.fillStyle = vortexGradient;
            ctx.fill();
            
            if (Math.random() < 0.1) {
                const rayCount = 1 + Math.floor(Math.random() * 2);
                for (let i = 0; i < rayCount; i++) {
                    const rayAngle = Math.random() * Math.PI * 2;
                    const rayLength = 20 + Math.random() * 30;
                    
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    
                    let prevX = 0;
                    let prevY = 0;
                    const segments = 3;
                    
                    for (let j = 1; j <= segments; j++) {
                        const segmentDistance = (rayLength / segments) * j;
                        const offsetAngle = rayAngle + (Math.random() * 0.5 - 0.25);
                        const x = Math.cos(offsetAngle) * segmentDistance;
                        const y = Math.sin(offsetAngle) * segmentDistance;
                        
                        ctx.lineTo(x, y);
                        prevX = x;
                        prevY = y;
                    }
                    
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    
                    ctx.strokeStyle = 'rgba(0, 191, 255, 0.3)';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                }
            }
            
            ctx.restore();
        }
    };
    
    renderModule.addEffect(id, effect);
    
    return function() {
        renderModule.removeEffect(id);
    };
}

stormFieldContinuousEffect.id = effectId;
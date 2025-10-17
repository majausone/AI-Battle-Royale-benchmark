import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-stormImpact-2093";

export default async function stormImpactEffect(target, data) {
    let renderModule;
    try {
        renderModule = await import('../render.js');
    } catch (error) {
        console.error('Error loading render module:', error);
        return;
    }

    const startTime = performance.now();
    const duration = 700;
    const id = `storm-impact-${target.id}-${startTime}`;

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
            
            const radius = 40 * progress;
            
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
            gradient.addColorStop(0, `rgba(135, 206, 235, ${alpha * 0.7})`);
            gradient.addColorStop(0.7, `rgba(70, 130, 180, ${alpha * 0.4})`);
            gradient.addColorStop(1, `rgba(25, 25, 112, 0)`);
            ctx.fillStyle = gradient;
            ctx.fill();
            
            const cloudCount = 4;
            const cloudMaxSize = 20;
            
            for (let i = 0; i < cloudCount; i++) {
                const angle = (i / cloudCount) * Math.PI * 2;
                const cloudDistance = radius * 0.6;
                const x = Math.cos(angle) * cloudDistance;
                const y = Math.sin(angle) * cloudDistance;
                const size = cloudMaxSize * (0.5 + 0.5 * Math.sin(progress * Math.PI));
                
                drawCloud(ctx, x, y, size, alpha);
            }
            
            const boltCount = 5;
            for (let i = 0; i < boltCount; i++) {
                const angle = (i / boltCount) * Math.PI * 2 + progress * Math.PI;
                const boltLength = radius * 0.8;
                const startX = Math.cos(angle) * (radius * 0.2);
                const startY = Math.sin(angle) * (radius * 0.2);
                
                drawLightningBolt(ctx, startX, startY, angle, boltLength, alpha);
            }
            
            if (data && data.areaEffect) {
                const areaRadius = (data.areaRadius || 80) * progress;
                ctx.beginPath();
                ctx.arc(0, 0, areaRadius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(65, 105, 225, ${alpha * 0.5})`;
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

function drawCloud(ctx, x, y, size, alpha) {
    ctx.save();
    ctx.translate(x, y);
    
    const circles = [
        { x: 0, y: 0, r: size * 0.5 },
        { x: size * 0.4, y: 0, r: size * 0.4 },
        { x: -size * 0.4, y: 0, r: size * 0.4 },
        { x: size * 0.2, y: -size * 0.3, r: size * 0.3 },
        { x: -size * 0.2, y: -size * 0.3, r: size * 0.3 }
    ];
    
    ctx.beginPath();
    for (const circle of circles) {
        ctx.moveTo(circle.x + circle.r, circle.y);
        ctx.arc(circle.x, circle.y, circle.r, 0, Math.PI * 2);
    }
    
    ctx.fillStyle = `rgba(176, 224, 230, ${alpha * 0.6})`;
    ctx.fill();
    
    ctx.restore();
}

function drawLightningBolt(ctx, startX, startY, angle, length, alpha) {
    const endX = startX + Math.cos(angle) * length;
    const endY = startY + Math.sin(angle) * length;
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    
    const segments = 4;
    let prevX = startX;
    let prevY = startY;
    
    for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const nextX = startX + (endX - startX) * t;
        const nextY = startY + (endY - startY) * t;
        
        const offset = 10 * Math.sin(t * Math.PI);
        const perpX = -Math.sin(angle) * offset;
        const perpY = Math.cos(angle) * offset;
        
        const midX = nextX + perpX;
        const midY = nextY + perpY;
        
        ctx.lineTo(midX, midY);
    }
    
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.strokeStyle = `rgba(0, 191, 255, ${alpha * 0.5})`;
    ctx.lineWidth = 4;
    ctx.stroke();
}

stormImpactEffect.id = effectId;
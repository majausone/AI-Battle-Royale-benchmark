import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-archerSpawn";

export default async function archerSpawnEffect(target) {
    let renderModule;
    try {
        renderModule = await import('../render.js');
    } catch (error) {
        console.error('Error loading render module:', error);
        return;
    }

    const startTime = performance.now();
    const duration = 800;
    const id = `spawn-${target.id}`;
    const numArrows = 8;

    const arrows = Array(numArrows).fill(0).map((_, i) => {
        const angle = (Math.PI * 2 * i) / numArrows;
        return {
            angle,
            distance: 0,
            maxDistance: 50 + Math.random() * 20
        };
    });

    const effect = {
        render(ctx) {
            const elapsed = performance.now() - startTime;
            if (elapsed >= duration) {
                renderModule.removeEffect(id);
                return;
            }

            const progress = elapsed / duration;
            const alpha = Math.min(1, 2 * (1 - progress));

            ctx.save();
            ctx.translate(target.x + target.width / 2, target.y + target.height / 2);

            arrows.forEach(arrow => {
                arrow.distance = arrow.maxDistance * Math.sin(progress * Math.PI);

                const x = Math.cos(arrow.angle) * arrow.distance;
                const y = Math.sin(arrow.angle) * arrow.distance;

                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(arrow.angle + Math.PI / 2);

                ctx.beginPath();
                ctx.moveTo(0, -10);
                ctx.lineTo(-2, 0);
                ctx.lineTo(0, 10);
                ctx.lineTo(2, 0);
                ctx.closePath();

                ctx.fillStyle = `rgba(139, 69, 19, ${alpha})`;
                ctx.fill();
                ctx.restore();
            });

            ctx.restore();
        }
    };
    
    renderModule.addEffect(id, effect);
}

archerSpawnEffect.id = effectId;
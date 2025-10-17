import baseFx, { EFFECT_TYPES } from '../baseFx.js';

const effectId = "fx-archerDeath";

export default async function archerDeathEffect(target) {
    let renderModule;
    try {
        renderModule = await import('../render.js');
    } catch (error) {
        console.error('Error loading render module:', error);
        return;
    }

    const startTime = performance.now();
    const duration = 1200;
    const id = `death-${target.id}`;
    const numArrows = 12;
    const arrows = [];

    for (let i = 0; i < numArrows; i++) {
        const angle = (Math.PI * 2 * i) / numArrows;
        arrows.push({
            x: target.x + target.width / 2,
            y: target.y + target.height / 2,
            angle: angle,
            speed: 2 + Math.random() * 2,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.2
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
            arrows.forEach(arrow => {
                arrow.x += Math.cos(arrow.angle) * arrow.speed;
                arrow.y += Math.sin(arrow.angle) * arrow.speed;
                arrow.rotation += arrow.rotationSpeed;

                ctx.save();
                ctx.translate(arrow.x, arrow.y);
                ctx.rotate(arrow.rotation);

                ctx.beginPath();
                ctx.moveTo(0, -8);
                ctx.lineTo(-2, 0);
                ctx.lineTo(0, 8);
                ctx.lineTo(2, 0);
                ctx.closePath();

                ctx.fillStyle = `rgba(139, 69, 19, ${alpha})`;
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(-5, 0);
                ctx.lineTo(5, 0);
                ctx.strokeStyle = `rgba(165, 42, 42, ${alpha})`;
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.restore();
            });
            ctx.restore();
        }
    };
    
    renderModule.addEffect(id, effect);
}

archerDeathEffect.id = effectId;
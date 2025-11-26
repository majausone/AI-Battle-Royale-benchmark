let renderModule;
let gameStateModule;
let socketManager;

async function loadDependencies() {
    if (!renderModule) {
        renderModule = await import('./render.js');
    }
    if (!gameStateModule) {
        gameStateModule = await import('./gameState.js');
    }
    if (!socketManager) {
        socketManager = await import('./socketManager.js');
    }
}

function reportFxIssue(effectId, message, isError = false, meta = {}) {
    if (!socketManager || !socketManager.reportValidationIssue) return;
    const matchId = typeof window !== 'undefined' ? (window.currentMatchId || null) : null;
    const filename = effectId ? `${effectId}.js` : 'fx-unknown.js';
    const owner = resolveOwner(meta.target || null);
    const payloadMeta = {
        matchId,
        aiId: owner.aiId ?? meta.aiId ?? null,
        teamId: owner.teamId ?? meta.teamId ?? null,
        aiName: owner.aiName ?? null,
        teamName: owner.teamName ?? null
    };
    try {
        socketManager.reportValidationIssue(filename, message, isError, payloadMeta);
    } catch (e) {
        console.warn('[FX Validation] Unable to report issue:', e?.message || e);
    }
}

function resolveOwner(target) {
    const meta = { aiId: null, teamId: null, aiName: null, teamName: null };
    const teamId = target?.teamId || null;
    const aiId = target?.aiId || null;

    if (teamId && gameStateModule?.teamStats?.has(teamId)) {
        const team = gameStateModule.teamStats.get(teamId);
        meta.teamId = teamId;
        meta.teamName = team?.name || null;
        if (aiId && team?.ais?.has(aiId)) {
            const ai = team.ais.get(aiId);
            meta.aiId = aiId;
            meta.aiName = ai?.service || null;
        }
    } else {
        meta.teamId = teamId || null;
        meta.aiId = aiId || null;
    }

    return meta;
}

function clampAlpha(value, fallback = 0.2) {
    const alpha = Number(value);
    if (!Number.isFinite(alpha)) return fallback;
    return Math.min(1, Math.max(0, alpha));
}

export async function createEffect(params) {
    await loadDependencies();
    
    const {
        id,
        target,
        type,
        duration,
        properties
    } = params;
    
    const effectId = `${id}-${target.id}`;
    const startTime = performance.now();
    
    let effectObject;
    
    switch (type) {
        case EFFECT_TYPES.GLOW:
            effectObject = createGlowEffect(effectId, target, startTime, duration, properties);
            break;
        case EFFECT_TYPES.PARTICLES:
            effectObject = createParticlesEffect(effectId, target, startTime, duration, properties);
            break;
        case EFFECT_TYPES.SHIELD:
            effectObject = createShieldEffect(effectId, target, startTime, duration, properties);
            break;
        case EFFECT_TYPES.EXPLOSION:
            effectObject = createExplosionEffect(effectId, target, startTime, duration, properties);
            break;
        case EFFECT_TYPES.PULSE:
            effectObject = createPulseEffect(effectId, target, startTime, duration, properties);
            break;
        case EFFECT_TYPES.TRAIL:
            effectObject = createTrailEffect(effectId, target, startTime, duration, properties);
            break;
        case EFFECT_TYPES.ATTACK:
            effectObject = createAttackEffect(effectId, target, startTime, duration, properties);
            break;
        default:
            console.warn(`Unknown effect type: ${type}`);
            return null;
    }
    
    renderModule.addEffect(effectId, effectObject);
    
    return () => renderModule.removeEffect(effectId);
}

function createGlowEffect(effectId, target, startTime, duration, properties) {
    const {
        color = 'rgba(50, 205, 50, 1)',
        size = 1.2,
        pulseSpeed = 1000,
        minAlpha = 0.1,
        maxAlpha = 0.2
    } = properties || {};

    const safeMinAlpha = clampAlpha(minAlpha, 0.1);
    const safeMaxAlpha = clampAlpha(maxAlpha, 0.2);
    
    return {
        render(ctx) {
            if (!target || target.health <= 0 || 
                isNaN(target.x) || isNaN(target.y) || 
                !isFinite(target.x) || !isFinite(target.y) ||
                !gameStateModule.gameObjects.has(target.id)) {
                renderModule.removeEffect(effectId);
                return;
            }

            const gameSpeed = gameStateModule.getGameSpeed();
            const elapsed = (performance.now() - startTime) * gameSpeed;
            
            if (duration && elapsed >= duration) {
                renderModule.removeEffect(effectId);
                return;
            }
            
            const pulseProgress = (Math.sin(elapsed / pulseSpeed) + 1) / 2;
            let alpha = safeMinAlpha + pulseProgress * (safeMaxAlpha - safeMinAlpha);
            if (!Number.isFinite(alpha)) {
                alpha = clampAlpha(safeMinAlpha, 0.15);
                reportFxIssue(effectId, `Invalid alpha in FX ${effectId}, using fallback.`, true, { target });
            }
            
            const glowSize = Math.max(target.width, target.height) * size;
            const centerX = target.x + target.width / 2;
            const centerY = target.y + target.height / 2;
            
            if (isNaN(centerX) || isNaN(centerY) || !isFinite(centerX) || !isFinite(centerY)) {
                renderModule.removeEffect(effectId);
                return;
            }

            ctx.save();
            try {
                const gradient = ctx.createRadialGradient(
                    centerX, centerY, 0,
                    centerX, centerY, glowSize
                );
                
                const baseColor = parseColor(color);
                
                gradient.addColorStop(0, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha})`);
                gradient.addColorStop(1, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 0)`);

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(centerX, centerY, glowSize, 0, Math.PI * 2);
                ctx.fill();
            } catch(e) {
                renderModule.removeEffect(effectId);
            }
            ctx.restore();
        }
    };
}

function createParticlesEffect(effectId, target, startTime, duration, properties) {
    const {
        particleCount = 10,
        particleSize = 3,
        particleSpeed = 2,
        particleColor = 'rgba(255, 255, 255, 1)',
        particleLife = 1000,
        particleGravity = 0.1,
        particleShape = 'circle',
        emitterShape = 'point',
        emitterRadius = 0,
        fadeOut = true
    } = properties || {};
    
    const particles = [];
    const baseColor = parseColor(particleColor);
    
    for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount;
        const speed = particleSpeed * (0.5 + Math.random() * 0.5);
        
        particles.push({
            x: 0,
            y: 0,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: particleSize * (0.5 + Math.random() * 0.5),
            life: particleLife * (0.8 + Math.random() * 0.4),
            born: performance.now()
        });
    }
    
    return {
        render(ctx) {
            if (target && target.health <= 0) {
                renderModule.removeEffect(effectId);
                return;
            }

            const gameSpeed = gameStateModule.getGameSpeed();
            const elapsed = (performance.now() - startTime) * gameSpeed;
            
            if (duration && elapsed >= duration) {
                renderModule.removeEffect(effectId);
                return;
            }
            
            const progress = duration ? elapsed / duration : 0;
            const centerX = target ? target.x + target.width / 2 : 0;
            const centerY = target ? target.y + target.height / 2 : 0;
            
            ctx.save();
            ctx.translate(centerX, centerY);
            
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                const particleElapsed = (performance.now() - p.born) * gameSpeed;
                
                if (particleElapsed > p.life) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = particleSpeed * (0.5 + Math.random() * 0.5);
                    
                    p.x = 0;
                    p.y = 0;
                    p.vx = Math.cos(angle) * speed;
                    p.vy = Math.sin(angle) * speed;
                    p.size = particleSize * (0.5 + Math.random() * 0.5);
                    p.life = particleLife * (0.8 + Math.random() * 0.4);
                    p.born = performance.now();
                    continue;
                }
                
                p.x += p.vx;
                p.y += p.vy;
                p.vy += particleGravity;
                
                const alpha = fadeOut ? 1 - (particleElapsed / p.life) : 1;
                const particleAlpha = duration ? alpha * (1 - progress) : alpha;
                
                if (particleShape === 'circle') {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${particleAlpha})`;
                    ctx.fill();
                } else if (particleShape === 'square') {
                    ctx.fillStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${particleAlpha})`;
                    ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
                } else if (particleShape === 'line') {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
                    ctx.strokeStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${particleAlpha})`;
                    ctx.lineWidth = p.size;
                    ctx.stroke();
                }
            }
            
            ctx.restore();
        }
    };
}

function createShieldEffect(effectId, target, startTime, duration, properties) {
    const {
        color = 'rgba(192, 192, 192, 1)',
        size = 1.2,
        pulseSpeed = 500,
        minAlpha = 0.1,
        maxAlpha = 0.3,
        segments = 6,
        rotation = true,
        rotationSpeed = 3000
    } = properties || {};
    
    const baseColor = parseColor(color);
    const safeMinAlpha = clampAlpha(minAlpha, 0.1);
    const safeMaxAlpha = clampAlpha(maxAlpha, 0.3);
    
    return {
        render(ctx) {
            if (!target || target.health <= 0 || !gameStateModule.gameObjects.has(target.id)) {
                renderModule.removeEffect(effectId);
                return;
            }

            const gameSpeed = gameStateModule.getGameSpeed();
            const elapsed = (performance.now() - startTime) * gameSpeed;
            
            if (duration && elapsed >= duration) {
                renderModule.removeEffect(effectId);
                return;
            }
            
            const pulseProgress = (Math.sin(elapsed / pulseSpeed) + 1) / 2;
            let alpha = safeMinAlpha + pulseProgress * (safeMaxAlpha - safeMinAlpha);
            if (!Number.isFinite(alpha)) {
                alpha = clampAlpha(safeMinAlpha, 0.2);
                reportFxIssue(effectId, `Invalid shield alpha in FX ${effectId}, using fallback.`, true, { target });
            }
            
            const shieldRadius = Math.max(target.width, target.height) * size;
            const centerX = target.x + target.width / 2;
            const centerY = target.y + target.height / 2;
            
            ctx.save();
            ctx.translate(centerX, centerY);
            
            ctx.beginPath();
            ctx.arc(0, 0, shieldRadius, 0, Math.PI * 2);
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, shieldRadius);
            
            gradient.addColorStop(0, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha})`);
            gradient.addColorStop(1, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 0)`);
            
            ctx.fillStyle = gradient;
            ctx.fill();
            
            if (rotation) {
                const angle = (elapsed / rotationSpeed) * Math.PI * 2;
                
                for (let i = 0; i < segments; i++) {
                    const segmentAngle = angle + (i / segments) * Math.PI * 2;
                    const x = Math.cos(segmentAngle) * shieldRadius * 0.8;
                    const y = Math.sin(segmentAngle) * shieldRadius * 0.8;
                    
                    ctx.beginPath();
                    ctx.arc(x, y, 4, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha * 1.5})`;
                    ctx.fill();
                }
                
                ctx.beginPath();
                for (let i = 0; i < segments; i++) {
                    const segmentAngle = angle * 0.5 + (i / segments) * Math.PI * 2;
                    const x = Math.cos(segmentAngle) * shieldRadius * 0.6;
                    const y = Math.sin(segmentAngle) * shieldRadius * 0.6;
                    
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.closePath();
                ctx.strokeStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            
            ctx.restore();
        }
    };
}

function createExplosionEffect(effectId, target, startTime, duration, properties) {
    const {
        color = 'rgba(255, 255, 255, 1)',
        size = 1.5,
        rays = 8,
        particleCount = 15,
        speed = 1
    } = properties || {};
    
    const baseColor = parseColor(color);
    const particles = [];
    
    for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount;
        const speed = 1 + Math.random() * 2;
        
        particles.push({
            x: 0,
            y: 0,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 2 + Math.random() * 3
        });
    }
    
    return {
        render(ctx) {
            const gameSpeed = gameStateModule.getGameSpeed();
            const elapsed = (performance.now() - startTime) * gameSpeed;
            
            if (elapsed >= duration) {
                renderModule.removeEffect(effectId);
                return;
            }
            
            const progress = elapsed / duration;
            const alpha = 1 - progress;
            const currentSize = size * Math.max(target.width, target.height) * progress;
            
            const centerX = target.x + target.width / 2;
            const centerY = target.y + target.height / 2;
            
            ctx.save();
            ctx.translate(centerX, centerY);
            
            ctx.beginPath();
            ctx.arc(0, 0, currentSize, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha * 0.3})`;
            ctx.fill();
            
            for (let i = 0; i < rays; i++) {
                const angle = (i / rays) * Math.PI * 2;
                const rayLength = currentSize * 1.2;
                
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(
                    Math.cos(angle) * rayLength,
                    Math.sin(angle) * rayLength
                );
                ctx.strokeStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            
            for (const particle of particles) {
                particle.x += particle.vx * speed;
                particle.y += particle.vy * speed;
                
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size * (1 - progress), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha})`;
                ctx.fill();
            }
            
            ctx.restore();
        }
    };
}

function createPulseEffect(effectId, target, startTime, duration, properties) {
    const {
        color = 'rgba(0, 255, 0, 1)',
        size = 1.5,
        rings = 1,
        thickness = 2,
        symbol = null
    } = properties || {};
    
    const baseColor = parseColor(color);
    
    return {
        render(ctx) {
            const gameSpeed = gameStateModule.getGameSpeed();
            const elapsed = (performance.now() - startTime) * gameSpeed;
            
            if (elapsed >= duration) {
                renderModule.removeEffect(effectId);
                return;
            }
            
            const progress = elapsed / duration;
            const alpha = 1 - progress;
            
            const centerX = target.x + target.width / 2;
            const centerY = target.y + target.height / 2;
            
            ctx.save();
            ctx.translate(centerX, centerY);
            
            for (let i = 0; i < rings; i++) {
                const ringProgress = (progress + i / rings) % 1;
                const ringSize = size * target.width * ringProgress;
                
                ctx.beginPath();
                ctx.arc(0, 0, ringSize, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha})`;
                ctx.lineWidth = thickness;
                ctx.stroke();
            }
            
            if (symbol) {
                const symbolSize = 10 * (1 - progress);
                
                if (symbol === 'plus') {
                    ctx.beginPath();
                    ctx.moveTo(-symbolSize, 0);
                    ctx.lineTo(symbolSize, 0);
                    ctx.moveTo(0, -symbolSize);
                    ctx.lineTo(0, symbolSize);
                    ctx.strokeStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha})`;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                } else if (symbol === 'cross') {
                    ctx.beginPath();
                    ctx.moveTo(-symbolSize, -symbolSize);
                    ctx.lineTo(symbolSize, symbolSize);
                    ctx.moveTo(symbolSize, -symbolSize);
                    ctx.lineTo(-symbolSize, symbolSize);
                    ctx.strokeStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha})`;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                } else if (symbol === 'star') {
                    const points = 5;
                    ctx.beginPath();
                    
                    for (let i = 0; i < points * 2; i++) {
                        const angle = (i * Math.PI) / points;
                        const radius = i % 2 === 0 ? symbolSize : symbolSize * 0.5;
                        const x = Math.cos(angle) * radius;
                        const y = Math.sin(angle) * radius;
                        
                        if (i === 0) {
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }
                    }
                    
                    ctx.closePath();
                    ctx.fillStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha})`;
                    ctx.fill();
                }
            }
            
            ctx.restore();
        }
    };
}

function createTrailEffect(effectId, target, startTime, duration, properties) {
    const {
        color = 'rgba(0, 255, 0, 1)',
        width = 2,
        length = 10,
        fadeSpeed = 500
    } = properties || {};
    
    const baseColor = parseColor(color);
    const trail = [];
    let lastPosition = null;
    
    return {
        render(ctx) {
            if (!target || target.health <= 0 || !gameStateModule.gameObjects.has(target.id)) {
                renderModule.removeEffect(effectId);
                return;
            }

            const gameSpeed = gameStateModule.getGameSpeed();
            const elapsed = (performance.now() - startTime) * gameSpeed;
            
            if (duration && elapsed >= duration) {
                renderModule.removeEffect(effectId);
                return;
            }
            
            const currentPosition = {
                x: target.x + target.width / 2,
                y: target.y + target.height / 2,
                time: performance.now()
            };
            
            if (!lastPosition || 
                Math.abs(currentPosition.x - lastPosition.x) > 2 ||
                Math.abs(currentPosition.y - lastPosition.y) > 2) {
                
                trail.push(currentPosition);
                lastPosition = currentPosition;
                
                if (trail.length > length) {
                    trail.shift();
                }
            }
            
            ctx.save();
            
            if (trail.length > 1) {
                ctx.beginPath();
                ctx.moveTo(trail[0].x, trail[0].y);
                
                for (let i = 1; i < trail.length; i++) {
                    ctx.lineTo(trail[i].x, trail[i].y);
                }
                
                ctx.strokeStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 0.5)`;
                ctx.lineWidth = width;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.stroke();
                
                for (let i = 0; i < trail.length; i++) {
                    const point = trail[i];
                    const pointAge = (performance.now() - point.time) * gameSpeed;
                    const alpha = Math.max(0, 1 - pointAge / fadeSpeed);
                    
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, width / 2, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha})`;
                    ctx.fill();
                }
            }
            
            ctx.restore();
        }
    };
}

function createAttackEffect(effectId, target, startTime, duration, properties) {
    const {
        color = 'rgba(255, 255, 0, 1)',
        type = 'slash',
        size = 1,
        speed = 1,
        position = null
    } = properties || {};
    
    const baseColor = parseColor(color);
    const pos = position || { 
        x: target.x + target.width / 2, 
        y: target.y + target.height / 2 
    };
    
    return {
        render(ctx) {
            const gameSpeed = gameStateModule.getGameSpeed();
            const elapsed = (performance.now() - startTime) * gameSpeed;
            
            if (elapsed >= duration) {
                renderModule.removeEffect(effectId);
                return;
            }
            
            const progress = elapsed / duration;
            const alpha = 1 - progress;
            
            ctx.save();
            
            if (type === 'slash') {
                const slashSize = 10 * size * (1 - Math.abs(progress - 0.5) * 2);
                
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, slashSize, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            } else if (type === 'bow') {
                const bowRadius = 30 * size;
                const stringPull = 15 * size * Math.sin(progress * Math.PI);

                ctx.translate(pos.x, pos.y);
                
                ctx.beginPath();
                ctx.arc(0, 0, bowRadius, -Math.PI / 3, Math.PI / 3);
                ctx.strokeStyle = `rgba(139, 69, 19, ${alpha})`;
                ctx.lineWidth = 3;
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(bowRadius * Math.cos(-Math.PI / 3), bowRadius * Math.sin(-Math.PI / 3));
                ctx.quadraticCurveTo(-stringPull, 0,
                    bowRadius * Math.cos(Math.PI / 3), bowRadius * Math.sin(Math.PI / 3));
                ctx.strokeStyle = `rgba(165, 42, 42, ${alpha})`;
                ctx.lineWidth = 1;
                ctx.stroke();

                if (progress < 0.5) {
                    ctx.beginPath();
                    ctx.moveTo(-stringPull, 0);
                    ctx.lineTo(-stringPull + 20, 0);
                    ctx.strokeStyle = `rgba(139, 69, 19, ${alpha})`;
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(-stringPull + 20, 0);
                    ctx.lineTo(-stringPull + 15, -3);
                    ctx.lineTo(-stringPull + 15, 3);
                    ctx.closePath();
                    ctx.fillStyle = `rgba(139, 69, 19, ${alpha})`;
                    ctx.fill();
                }
            } else if (type === 'pulse') {
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 10 * size * progress, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha})`;
                ctx.fill();
            }
            
            ctx.restore();
        }
    };
}

function parseColor(color) {
    if (color.startsWith('rgba(') || color.startsWith('rgb(')) {
        const values = color.replace(/rgba?\(|\)/g, '').split(',');
        return {
            r: parseInt(values[0].trim()),
            g: parseInt(values[1].trim()),
            b: parseInt(values[2].trim())
        };
    } else if (color.startsWith('#')) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return { r, g, b };
    }
    
    return { r: 255, g: 255, b: 255 };
}

export const EFFECT_TYPES = {
    GLOW: 'glow',
    PARTICLES: 'particles',
    SHIELD: 'shield',
    EXPLOSION: 'explosion',
    PULSE: 'pulse',
    TRAIL: 'trail',
    ATTACK: 'attack'
};

export default {
    createEffect,
    EFFECT_TYPES,
    parseColor
};

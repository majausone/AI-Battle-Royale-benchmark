import { gameArea, mainCanvas, gameObjects, projectiles, swords, teamStats, getBattleAreaBounds, isInitialized, effects, selectedUnit, getGameSpeed, getActiveTeamsForDisplay, getCameraZoom } from './gameState.js';
import { renderMapLayer } from './mapManager.js';
import { CONFIG } from './config.js';

const ctx = mainCanvas.getContext('2d');
const spriteCache = new Map();
const trails = [];

export function initializeCanvas() {
    mainCanvas.width = gameArea.offsetWidth;
    mainCanvas.height = gameArea.offsetHeight;
    mainCanvas.style.cursor = 'pointer';
}

function createSpriteFromGraphics(artData, scale) {
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = artData[0].length * scale;
    spriteCanvas.height = artData.length * scale;
    const spriteCtx = spriteCanvas.getContext('2d');

    artData.forEach((row, y) => {
        row.forEach((color, x) => {
            if (color) {
                spriteCtx.fillStyle = color;
                spriteCtx.fillRect(x * scale, y * scale, scale, scale);
            }
        });
    });

    return spriteCanvas;
}

export function drawPixelArt(artData, scale, x, y) {
    const key = JSON.stringify({ graphics: artData, scale: scale });
    let canvas;

    if (!spriteCache.has(key)) {
        canvas = createSpriteFromGraphics(artData, scale);
        spriteCache.set(key, canvas);
    } else {
        canvas = spriteCache.get(key);
    }

    return {
        key,
        x,
        y,
        width: canvas.width,
        height: canvas.height
    };
}

function renderSpawnPoints() {
    if (!isInitialized) return;

    const bounds = getBattleAreaBounds();
    const centerX = (bounds.right - bounds.left) / 2 + bounds.left;
    const centerY = (bounds.bottom - bounds.top) / 2 + bounds.top;
    const radius = Math.min(centerX - bounds.left, centerY - bounds.top) * 0.8;
    const spawnRadius = Math.min(bounds.right - bounds.left, bounds.bottom - bounds.top) * 0.08;

    const teams = getActiveTeamsForDisplay();
    const totalTeams = teams.length || 1;

    teams.forEach(([teamId, team], index) => {
        const angle = (index * 2 * Math.PI / totalTeams) - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        ctx.beginPath();
        ctx.arc(x, y, spawnRadius, 0, 2 * Math.PI);
        ctx.fillStyle = `${team.color}40`;
        ctx.fill();

        ctx.font = '14px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(team.name, x, y);
    });
}

function renderBattleArea() {
    if (!isInitialized) return;

    const bounds = getBattleAreaBounds();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 4;
    ctx.strokeRect(bounds.left, bounds.top,
        bounds.right - bounds.left,
        bounds.bottom - bounds.top);
}

export function createTrail(x, y, color) {
    if (!CONFIG.showTrails) return;

    const gameSpeed = getGameSpeed();
    const trail = {
        x, y, color,
        alpha: 0.7,
        timestamp: performance.now()
    };

    setTimeout(() => {
        const index = trails.indexOf(trail);
        if (index > -1) trails.splice(index, 1);
    }, CONFIG.trailDuration / gameSpeed);

    trails.push(trail);
}

export function createProjectile(x, y, width, height, color) {
    const projectile = {
        x, y, width, height, color,
        active: true
    };
    return projectile;
}

export function removeProjectile(projectile) {
    projectile.active = false;
}

export function createSword(kewoX, kewoY, targetX, targetY, swordGraphics) {
    const dx = targetX - kewoX;
    const dy = targetY - kewoY;
    const angle = Math.atan2(dy, dx);
    const startAngle = angle - Math.PI / 3;
    const swingTime = 400;

    const width = typeof swordGraphics?.width === 'number' && swordGraphics.width > 0
        ? swordGraphics.width
        : 20;
    const height = typeof swordGraphics?.height === 'number' && swordGraphics.height > 0
        ? swordGraphics.height
        : 40;
    const color = swordGraphics?.color || '#ffffff';

    return {
        x: kewoX,
        y: kewoY,
        width,
        height,
        color,
        angle: startAngle,
        targetAngle: angle + Math.PI / 3,
        timestamp: performance.now(),
        duration: swingTime
    };
}

export function addEffect(id, effect) {
    if (effect.cleanup) {
        const existingEffect = effects.get(id);
        if (existingEffect && existingEffect.cleanup) {
            existingEffect.cleanup();
        }
    }
    effects.set(id, effect);
}

export function removeEffect(id) {
    const effect = effects.get(id);
    if (effect && effect.cleanup) {
        effect.cleanup();
    }
    effects.delete(id);
}

function renderUnit(unit) {
    if (!unit || !unit.key) return;

    const sprite = spriteCache.get(unit.key);
    if (!sprite) return;

    ctx.save();

    if (selectedUnit && selectedUnit.id === unit.id) {
        ctx.shadowColor = '#4CAF50';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        ctx.strokeRect(unit.x - 2, unit.y - 2, unit.width + 4, unit.height + 4);
    }

    ctx.translate(Math.floor(unit.x), Math.floor(unit.y));
    ctx.drawImage(sprite, 0, 0);

    const healthBarWidth = unit.width;
    const healthBarHeight = 5;
    const healthPercent = unit.health / unit.maxHealth;

    if (unit.teamId) {
        const team = teamStats.get(unit.teamId);
        if (team) {
            ctx.fillStyle = team.color;
            ctx.fillRect(-8, -10, 6, healthBarHeight);

            ctx.font = '10px Arial';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.textAlign = 'center';
            ctx.fillText(team.name, unit.width / 2, -15);
        }
    }

    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.fillRect(0, -10, healthBarWidth, healthBarHeight);
    ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
    ctx.fillRect(0, -10, healthBarWidth * healthPercent, healthBarHeight);

    ctx.restore();
}

function renderProjectile(proj) {
    ctx.save();
    ctx.fillStyle = proj.color;
    ctx.fillRect(proj.x, proj.y, proj.width, proj.height);
    ctx.restore();
}

function renderSword(sword) {
    const gameSpeed = getGameSpeed();
    const elapsed = (performance.now() - sword.timestamp) * gameSpeed;
    if (elapsed >= sword.duration) return;

    const progress = elapsed / sword.duration;
    const currentAngle = sword.angle + (sword.targetAngle - sword.angle) * progress;

    ctx.save();
    ctx.translate(sword.x, sword.y);
    ctx.rotate(currentAngle);

    const alpha = Math.sin(progress * Math.PI);
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.moveTo(0, -sword.height / 2);
    ctx.lineTo(sword.width, -sword.height / 2);
    ctx.lineTo(sword.width, sword.height / 2);
    ctx.lineTo(0, sword.height / 2);
    ctx.closePath();
    ctx.fillStyle = sword.color;
    ctx.fill();

    const glowSize = 2;
    ctx.shadowColor = sword.color;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = glowSize;
    ctx.stroke();

    ctx.restore();
}

function renderTrail(trail) {
    const gameSpeed = getGameSpeed();
    ctx.save();
    const age = (performance.now() - trail.timestamp) * gameSpeed;
    if (age < CONFIG.trailDuration) {
        ctx.fillStyle = trail.color;
        ctx.globalAlpha = trail.alpha * (1 - age / CONFIG.trailDuration);
        ctx.fillRect(trail.x, trail.y, 5, 5);
    }
    ctx.restore();
}

function renderEffects() {
    effects.forEach((effect, id) => {
        if (effect.render) {
            effect.render(ctx);
        }
    });
}

export function render() {
    if (!isInitialized) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

    const { zoom, target, targetPos } = getCameraZoom();
    const effectiveZoom = Math.max(1, zoom || 1);
    let targetX = mainCanvas.width / 2;
    let targetY = mainCanvas.height / 2;
    if (targetPos && typeof targetPos.x === 'number' && typeof targetPos.y === 'number') {
        targetX = targetPos.x;
        targetY = targetPos.y;
    } else if (target && gameObjects.has(target.id)) {
        targetX = target.x + target.width / 2;
        targetY = target.y + target.height / 2;
    }

    ctx.save();
    if (effectiveZoom > 1) {
        ctx.translate(mainCanvas.width / 2, mainCanvas.height / 2);
        ctx.scale(effectiveZoom, effectiveZoom);
        ctx.translate(-targetX, -targetY);
    }

    renderMapLayer(ctx);
    renderBattleArea();
    renderSpawnPoints();
    trails.forEach(renderTrail);
    gameObjects.forEach(renderUnit);
    projectiles.forEach(proj => {
        if (proj.active) renderProjectile(proj);
    });
    swords.forEach(renderSword);
    renderEffects();

    ctx.restore();
}

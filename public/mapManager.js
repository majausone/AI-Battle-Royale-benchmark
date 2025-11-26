import { getBattleAreaBounds } from './gameState.js';

const themes = {
    none: {
        background: '#111',
        loaders: []
    },
    forest: {
        background: '#0f1e0f',
        loaders: Array.from({ length: 10 }, (_, i) => () => import(`./map/forest/forest${i + 1}.js`))
    },
    lava: {
        background: '#2b0d0d',
        loaders: Array.from({ length: 10 }, (_, i) => () => import(`./map/lava/lava${i + 1}.js`))
    },
    snow: {
        background: '#0d1620',
        loaders: Array.from({ length: 10 }, (_, i) => () => import(`./map/snow/snow${i + 1}.js`))
    }
};

let currentTheme = 'none';
let backgroundColor = themes.none.background;
let decorations = [];
let rainMode = 'never'; // never | always | sometimes
let isRaining = false;
const rainDrops = [];
let snowMode = 'never'; // never | always | sometimes
let isSnowing = false;
const snowFlakes = [];


function createSpriteFromMatrix(matrix) {
    if (!Array.isArray(matrix) || matrix.length === 0) return null;
    const height = matrix.length;
    const width = matrix[0].length;
    const cell = 2; // small pixels for background
    const canvas = document.createElement('canvas');
    canvas.width = width * cell;
    canvas.height = height * cell;
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const color = matrix[y][x];
            if (color && color !== 0) {
                ctx.fillStyle = color;
                ctx.fillRect(x * cell, y * cell, cell, cell);
            }
        }
    }
    return canvas;
}

function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
}

async function loadDecorations(theme) {
    if (!themes[theme]) return [];
    const loaders = themes[theme].loaders || [];
    const modules = await Promise.all(loaders.map(loader => loader()));
    return modules.map(m => m.default).filter(Boolean);
}

function generateDecorations(matrices) {
    const bounds = getBattleAreaBounds();
    const decoList = [];
    if (!matrices || matrices.length === 0) return decoList;

    const count = 35;
    for (let i = 0; i < count; i++) {
        const matrix = matrices[Math.floor(Math.random() * matrices.length)];
        const sprite = createSpriteFromMatrix(matrix);
        if (!sprite) continue;
        const x = randomBetween(bounds.left, bounds.right);
        const y = randomBetween(bounds.top, bounds.bottom);
        const scale = randomBetween(0.8, 1.4);
        decoList.push({ sprite, x, y, scale });
    }
    return decoList;
}

export async function setMapTheme(theme = 'none') {
    currentTheme = themes[theme] ? theme : 'none';
    backgroundColor = themes[currentTheme].background;
    if (currentTheme === 'none') {
        decorations = [];
        return;
    }
    const matrices = await loadDecorations(currentTheme);
    decorations = generateDecorations(matrices);
}

export function setRainMode(mode = 'never') {
    const normalized = ['never', 'always', 'sometimes'].includes(mode) ? mode : 'never';
    rainMode = normalized;
    isRaining = rainMode === 'always' ? true : rainMode === 'sometimes' ? Math.random() < 0.2 : false;
    rainDrops.length = 0;
}

export function setSnowMode(mode = 'never') {
    const normalized = ['never', 'always', 'sometimes'].includes(mode) ? mode : 'never';
    snowMode = normalized;
    isSnowing = snowMode === 'always' ? true : snowMode === 'sometimes' ? Math.random() < 0.2 : false;
    snowFlakes.length = 0;
}


function updateRain() {
    if (!isRaining) return;
    const bounds = getBattleAreaBounds();
    // spawn drops
    for (let i = 0; i < 6; i++) {
        rainDrops.push({
            x: randomBetween(bounds.left, bounds.right),
            y: randomBetween(bounds.top - 100, bounds.top),
            speedY: randomBetween(6, 10),
            length: randomBetween(8, 14)
        });
    }

    for (let i = rainDrops.length - 1; i >= 0; i--) {
        const drop = rainDrops[i];
        drop.y += drop.speedY;
        if (drop.y > bounds.bottom) {
            rainDrops.splice(i, 1);
        }
    }
}

function updateSnow() {
    if (!isSnowing) return;
    const bounds = getBattleAreaBounds();
    // spawn snowflakes
    for (let i = 0; i < 4; i++) {
        snowFlakes.push({
            x: randomBetween(bounds.left, bounds.right),
            y: randomBetween(bounds.top - 100, bounds.top),
            speedY: randomBetween(1, 2.5),
            speedX: randomBetween(-0.5, 0.5),
            size: randomBetween(2, 4),
            opacity: randomBetween(0.6, 1.0)
        });
    }

    for (let i = snowFlakes.length - 1; i >= 0; i--) {
        const flake = snowFlakes[i];
        flake.y += flake.speedY;
        flake.x += flake.speedX;
        if (flake.y > bounds.bottom || flake.x < bounds.left || flake.x > bounds.right) {
            snowFlakes.splice(i, 1);
        }
    }
}


export function renderMapLayer(ctx) {
    const bounds = getBattleAreaBounds();
    ctx.save();
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    decorations.forEach(deco => {
        if (!deco.sprite) return;
        ctx.save();
        ctx.translate(deco.x, deco.y);
        ctx.scale(deco.scale, deco.scale);
        ctx.drawImage(deco.sprite, -deco.sprite.width / 2, -deco.sprite.height / 2);
        ctx.restore();
    });

    updateRain();
    ctx.strokeStyle = '#ffffff22';
    rainDrops.forEach(drop => {
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x, drop.y + drop.length);
        ctx.stroke();
    });

    updateSnow();
    snowFlakes.forEach(flake => {
        ctx.save();
        ctx.globalAlpha = flake.opacity;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    ctx.restore();
}

export function getMapTheme() {
    return currentTheme;
}

export function getRainMode() {
    return rainMode;
}

export function getSnowMode() {
    return snowMode;
}

export function refreshMap() {
    // Regenerate decorations using current theme
    setMapTheme(currentTheme);
    setRainMode(rainMode);
    setSnowMode(snowMode);
}

window.addEventListener('mapThemeChanged', (e) => {
    setMapTheme(e.detail || 'none');
});

window.addEventListener('rainModeChanged', (e) => {
    setRainMode(e.detail || 'never');
});

window.addEventListener('snowModeChanged', (e) => {
    setSnowMode(e.detail || 'never');
});

window.addEventListener('battleReady', () => {
    refreshMap();
});

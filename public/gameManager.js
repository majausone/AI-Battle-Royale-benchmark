import { clearAllCharacters } from './characters.js';
import { initializeCanvas, render } from './render.js';
import { updateUI } from './ui.js';
import * as gameState from './gameState.js';

const gameOverScreen = document.getElementById('game-over');
const youWinScreen = document.getElementById('you-win');
const restartButton = document.getElementById('restart-button');
const restartLevelButton = document.getElementById('restart-level-button');
const pauseOverlay = document.createElement('div');
pauseOverlay.id = 'pause-overlay';
pauseOverlay.textContent = 'Paused';
gameState.gameArea.appendChild(pauseOverlay);

let lastFrameTime = performance.now();
let fps = 0;
let fpsElement = null;
let unitsCounterElement = null;
let gameSpeedElement = null;

export function gameOver() {
    gameState.setGameOver(true);
    gameOverScreen.style.display = 'block';
}

export function youWin() {
    gameState.setGameOver(true);
    youWinScreen.style.display = 'block';
}

function clearAllGameElements() {
    gameState.cleanupEffects();
    gameState.resetGameState();
    gameOverScreen.style.display = 'none';
    youWinScreen.style.display = 'none';
    pauseOverlay.style.display = 'none';

    if (fpsElement) {
        fpsElement.remove();
        fpsElement = null;
    }
    if (unitsCounterElement) {
        unitsCounterElement.remove();
        unitsCounterElement = null;
    }
    if (gameSpeedElement) {
        gameSpeedElement.remove();
        gameSpeedElement = null;
    }
}

export function restartGame() {
    clearAllCharacters();
    clearAllGameElements();

    const pauseButton = document.querySelector('#pauseButton');
    if (pauseButton) {
        pauseButton.textContent = 'Pause';
        pauseButton.classList.remove('resume');
    }
}

export function togglePause() {
    gameState.setPaused(!gameState.isPaused);
    const pauseButton = document.querySelector('#pauseButton');

    if (gameState.isPaused) {
        pauseOverlay.style.display = 'flex';
        if (pauseButton) {
            pauseButton.textContent = 'Resume';
            pauseButton.classList.add('resume');
        }
    } else {
        pauseOverlay.style.display = 'none';
        if (pauseButton) {
            pauseButton.textContent = 'Pause';
            pauseButton.classList.remove('resume');
        }
    }
}

export function setGameSpeed(factor) {
    const newSpeed = gameState.setGameSpeed(factor);
    if (gameSpeedElement) {
        gameSpeedElement.textContent = `Speed: ${newSpeed.toFixed(1)}x`;
    }
    return newSpeed;
}

export function increaseGameSpeed() {
    let currentSpeed = gameState.getGameSpeed();
    currentSpeed = Math.min(3.0, currentSpeed + 0.1);
    return setGameSpeed(currentSpeed);
}

export function decreaseGameSpeed() {
    let currentSpeed = gameState.getGameSpeed();
    currentSpeed = Math.max(0.1, currentSpeed - 0.1);
    return setGameSpeed(currentSpeed);
}

export function resetGameSpeed() {
    return setGameSpeed(1.0);
}

function gameLoop() {
    const currentTime = performance.now();
    const deltaTime = currentTime - lastFrameTime;
    fps = Math.round(1000 / deltaTime);

    if (!gameState.isPaused && !gameState.gameIsOver && gameState.isInitialized) {
        gameState.processGameUpdates(deltaTime);
        render();
        updateUI();
    }

    if (fpsElement) {
        fpsElement.textContent = `FPS: ${fps}`;
    }

    if (unitsCounterElement) {
        unitsCounterElement.textContent = `Units: ${gameState.gameObjects.size}`;
    }

    lastFrameTime = currentTime;
    requestAnimationFrame(gameLoop);
}

function createFpsCounter() {
    if (fpsElement) return;

    fpsElement = document.createElement('div');
    fpsElement.style.position = 'fixed';
    fpsElement.style.top = '10px';
    fpsElement.style.right = '10px';
    fpsElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    fpsElement.style.color = '#4CAF50';
    fpsElement.style.padding = '5px 10px';
    fpsElement.style.borderRadius = '4px';
    fpsElement.style.fontSize = '14px';
    fpsElement.style.zIndex = '9999';
    document.body.appendChild(fpsElement);
}

function createUnitsCounter() {
    if (unitsCounterElement) return;

    unitsCounterElement = document.createElement('div');
    unitsCounterElement.style.position = 'fixed';
    unitsCounterElement.style.top = '40px';
    unitsCounterElement.style.right = '10px';
    unitsCounterElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    unitsCounterElement.style.color = '#4CAF50';
    unitsCounterElement.style.padding = '5px 10px';
    unitsCounterElement.style.borderRadius = '4px';
    unitsCounterElement.style.fontSize = '14px';
    unitsCounterElement.style.zIndex = '9999';
    document.body.appendChild(unitsCounterElement);
}

function createGameSpeedIndicator() {
    if (gameSpeedElement) return;

    gameSpeedElement = document.createElement('div');
    gameSpeedElement.style.position = 'fixed';
    gameSpeedElement.style.top = '70px';
    gameSpeedElement.style.right = '10px';
    gameSpeedElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    gameSpeedElement.style.color = '#4CAF50';
    gameSpeedElement.style.padding = '5px 10px';
    gameSpeedElement.style.borderRadius = '4px';
    gameSpeedElement.style.fontSize = '14px';
    gameSpeedElement.style.zIndex = '9999';
    gameSpeedElement.textContent = `Speed: ${gameState.getGameSpeed().toFixed(1)}x`;
    document.body.appendChild(gameSpeedElement);
}

export async function initializeGame() {
    initializeCanvas();

    try {
        const response = await fetch('/api/config2');
        if (response.ok) {
            const config = await response.json();

            if (config.display) {
                if (config.display.showFpsCounter) {
                    createFpsCounter();
                }
                if (config.display.showUnitsCounter) {
                    createUnitsCounter();
                }
                if (config.display.showGameSpeedIndicator) {
                    createGameSpeedIndicator();
                }
            }
        }
    } catch (error) {
        console.error('Error loading display preferences:', error);
    }

    window.addEventListener('fpsToggle', (e) => {
        if (e.detail) {
            createFpsCounter();
        } else if (fpsElement) {
            fpsElement.remove();
            fpsElement = null;
        }
    });

    window.addEventListener('unitsCounterToggle', (e) => {
        if (e.detail) {
            createUnitsCounter();
        } else if (unitsCounterElement) {
            unitsCounterElement.remove();
            unitsCounterElement = null;
        }
    });

    window.addEventListener('gameSpeedToggle', (e) => {
        if (e.detail) {
            createGameSpeedIndicator();
        } else if (gameSpeedElement) {
            gameSpeedElement.remove();
            gameSpeedElement = null;
        }
    });

    window.addEventListener('gameSpeedChange', (e) => {
        if (gameSpeedElement) {
            gameSpeedElement.textContent = `Speed: ${e.detail.toFixed(1)}x`;
        }
    });

    if (restartButton) restartButton.addEventListener('click', restartGame);
    if (restartLevelButton) restartLevelButton.addEventListener('click', restartGame);

    requestAnimationFrame(gameLoop);
}
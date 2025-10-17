import { initializeGame } from './gameManager.js';
import { initializeUnits } from './unitLoader.js';
import tabManager from './tabs-manager.js';
import { RoundTab } from './round-tab.js';
import { TestUnitsTab } from './test-units-tab.js';
import { TeamsTab } from './teams-tab.js';
import { ConfigTab } from './config-tab.js';
import { StatsTab } from './stats-tab.js';
import { DataTab } from './data-tab.js';
import { ErrorsTab } from './errors-tab.js';
import * as gameState from './gameState.js';
import { initUI } from './ui.js';
import { setVolume } from './audio.js';
import { testerPopup } from './tester-popup.js';

async function loadInitialConfig() {
    try {
        const response = await fetch('/api/config2');
        const config = await response.json();
        
        if (config.display) {
            const showFps = config.display.showFpsCounter;
            const showUnitsCounter = config.display.showUnitsCounter;
            const volume = config.display.volume;
            const gameSpeed = config.display.gameSpeed;

            window.dispatchEvent(new CustomEvent('fpsToggle', { detail: showFps }));
            window.dispatchEvent(new CustomEvent('unitsCounterToggle', { detail: showUnitsCounter }));
            setVolume(volume / 100, false);
            
            if (gameSpeed !== undefined) {
                gameState.setGameSpeed(gameSpeed, false);
            }
        }
        return config;
    } catch (error) {
        console.error('Error loading initial config:', error);
        return null;
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    try {
        await Promise.all([
            import('./audio.js'),
            import('./render.js'),
            import('./characters.js'),
            import('./projectiles.js'),
            import('./collisions.js'),
            import('./characterMovement.js'),
            import('./gameState.js')
        ]);

        await loadInitialConfig();
        gameState.cleanupEffects();
        await initializeUnits();
        await initializeGame();
        await setupTabs();
        
        updateLayout();
        initUI();
        
        window.gameState = gameState;
    } catch (error) {
        console.error('Error initializing game:', error);
    }
});

async function setupTabs() {
    tabManager.registerTab('round-tab', new RoundTab());
    tabManager.registerTab('test-units-tab', new TestUnitsTab());
    tabManager.registerTab('teams-tab', new TeamsTab());
    tabManager.registerTab('config-tab', new ConfigTab());
    tabManager.registerTab('stats-tab', new StatsTab(), true);
    tabManager.registerTab('data-tab', new DataTab(), true);
    tabManager.registerTab('errors-tab', new ErrorsTab(), true);
    
    await tabManager.init();
}

function updateLayout() {
    const gameArea = document.getElementById('game-area');
    const sidebar = document.getElementById('sidebar');
    const teamsTab = document.getElementById('teams-tab');
    const configTab = document.getElementById('config-tab');
    
    const totalWidth = window.innerWidth;
    const sidebarWidth = sidebar.offsetWidth;
    
    gameArea.style.width = `${totalWidth - sidebarWidth}px`;
    gameArea.style.height = `${window.innerHeight}px`;
    sidebar.style.height = `${window.innerHeight}px`;

    if (teamsTab) {
        const teamsList = teamsTab.querySelector('.teams-list');
        if (teamsList) {
            const teamsConfig = teamsTab.querySelector('.teams-config');
            const gameSettings = teamsTab.querySelector('.game-settings');
            if (teamsConfig && gameSettings) {
                teamsList.style.height = `${teamsConfig.offsetHeight - gameSettings.offsetHeight - 40}px`;
            }
        }
    }

    if (configTab) {
        const servicesList = configTab.querySelector('.services-list');
        if (servicesList) {
            const servicesConfig = configTab.querySelector('.services-config');
            const header = configTab.querySelector('h3');
            const addButton = configTab.querySelector('#add-service-btn');
            if (servicesConfig && header && addButton) {
                servicesList.style.height = `${servicesConfig.offsetHeight - header.offsetHeight - addButton.offsetHeight - 50}px`;
            }
        }
    }
}

window.addEventListener('beforeunload', () => {
    gameState.cleanupEffects();
});

window.addEventListener('resize', updateLayout);
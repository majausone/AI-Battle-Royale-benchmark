import allSkills from './allSkills.js';

const gameArea = document.getElementById('game-area');

let isPaused = false;
let gameIsOver = false;
let isInitialized = false;
let gameObjects = new Map();
let addGameObject;
let applySkillEffect;
let getModifiedStat;
let processEffects;
let registerSkill;
let drawPixelArt;
let createTrail;
let moveCharacter;
let on;
let EVENTS;
let playSkillStartSound;
let playSkillEndSound;
let getUnitData;
let getEffect;
let getSkillEffect;
let getAlliesInRange;
let getEnemiesInRange;
let getUnitsInRange;
let checkCollision;
let removeEffect;
let getBattleAreaBounds;
let isPositionInBounds;
let killUnit;
let createTerrainEffect;
let getGameSpeed;

import('./gameState.js').then(module => {
    isPaused = module.isPaused;
    gameIsOver = module.gameIsOver;
    isInitialized = module.isInitialized;
    gameObjects = module.gameObjects;
    addGameObject = module.addGameObject;
    applySkillEffect = module.applySkillEffect;
    getModifiedStat = module.getModifiedStat;
    processEffects = module.processEffects;
    registerSkill = module.registerSkill;
    getBattleAreaBounds = module.getBattleAreaBounds;
    isPositionInBounds = module.isPositionInBounds;
    killUnit = module.killUnit;
    createTerrainEffect = module.createTerrainEffect;
    getGameSpeed = module.getGameSpeed;
});

import('./render.js').then(module => {
    drawPixelArt = module.drawPixelArt;
    createTrail = module.createTrail;
    removeEffect = module.removeEffect;
});

import('./characterMovement.js').then(module => {
    moveCharacter = module.moveCharacter;
});

import('./events.js').then(module => {
    on = module.on;
    EVENTS = module.EVENTS;
});

import('./audio.js').then(module => {
    playSkillStartSound = module.playSkillStartSound;
    playSkillEndSound = module.playSkillEndSound;
});

import('./unitLoader.js').then(module => {
    getUnitData = module.getUnitData;
    getEffect = module.getEffect;
    getSkillEffect = module.getSkillEffect;
});

import('./collisions.js').then(module => {
    getAlliesInRange = module.getAlliesInRange;
    getEnemiesInRange = module.getEnemiesInRange;
    getUnitsInRange = module.getUnitsInRange;
    checkCollision = module.checkCollision;
});

export class BaseSkill {
    constructor() {
        this.id = "";
        this.metadata = {
            name: "",
            description: "",
            skillType: "",          
            seffects: null,              

            trigger: {
                onAttack: false,        
                onAttackOnce: false,    
                onGetAttacked: false,   
                onDeath: false,         
                onSpawn: false,         
                interval: null,         
                duration: null,         
                chance: null           
            },
            
            spawnUnits: false,          

            fx: {
                start: null,            
                end: null,              
                continuous: null        
            },

            sounds: {
                start: null,
                end: null
            }
        };
    }

    async apply(unit) {
        await allSkills.applySkill(this, unit);
    }
}

function areUnitsInSameTeam(unit1, unit2) {
    return unit1 && unit2 && unit1.teamId && unit2.teamId && unit1.teamId === unit2.teamId;
}

function applyFX(effectName, target, data = {}) {
    if (!target) return null;
    
    const effectFn = getEffect(effectName);
    if (!effectFn) return null;
    
    return effectFn(target, data);
}

export function getTerrainEffectsInRange(position, range) {
    if (!createTerrainEffect) return [];
    
    return Array.from(terrainEffects.values()).filter(effect => {
        if (!effect.position) return false;
        
        const dx = effect.position.x - position.x;
        const dy = effect.position.y - position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        return distance <= range;
    });
}

export {
    gameArea,
    isPaused,
    gameIsOver,
    isInitialized,
    addGameObject,
    gameObjects,
    applyFX,
    applySkillEffect,
    getModifiedStat,
    getSkillEffect,
    processEffects,
    registerSkill,
    drawPixelArt,
    createTrail,
    moveCharacter,
    on,
    EVENTS,
    playSkillStartSound,
    playSkillEndSound,
    getUnitData,
    getEffect,
    getAlliesInRange,
    getEnemiesInRange,
    getUnitsInRange,
    checkCollision,
    removeEffect,
    getBattleAreaBounds,
    isPositionInBounds,
    killUnit,
    createTerrainEffect,
    areUnitsInSameTeam,
    getGameSpeed
};
import { validateEffect } from './seffectValidator.js';

export let loadedUnits = new Map();
export let loadedSkills = new Map();
export let loadedEffects = new Map();
export let loadedSkillEffects = new Map();

async function loadEffect(effectFile) {
    try {
        const module = await import(`/fx/${effectFile}`);
        const effect = module.default;
        if (!effect.id) {
            return false;
        }
        loadedEffects.set(effect.id, effect);
        return true;
    } catch (error) {
        return false;
    }
}

async function loadSkillEffect(effectFile) {
    try {
        const response = await fetch(`/seffects/${effectFile}`);
        if (!response.ok) return false;
        const effectData = await response.json();
        
        validateEffect(effectData);
        
        loadedSkillEffects.set(effectData.id, effectData);
        return true;
    } catch (error) {
        return false;
    }
}

async function loadSkill(skillFile) {
    try {
        const module = await import(`/skills/${skillFile}`).catch(error => {
            if (error instanceof SyntaxError && error.message.includes("Unexpected token '<'")) {
                return {
                    default: {
                        id: skillFile.replace('.js', ''),
                        metadata: {
                            name: "Error Loading Skill",
                            description: "This skill failed to load properly"
                        },
                        apply: () => { }
                    }
                };
            }
            throw error;
        });

        if (!module.default) {
            return false;
        }

        loadedSkills.set(module.default.id, module.default);
        return true;
    } catch (error) {
        return false;
    }
}

async function loadUnit(unitData) {
    try {
        if (unitData.skills && Array.isArray(unitData.skills)) {
            for (const skillName of unitData.skills) {
                if (!loadedSkills.has(skillName)) {
                    await loadSkill(skillName + '.js');
                }
            }
        }

        loadedUnits.set(unitData.id, unitData);
        return unitData;
    } catch (error) {
        return null;
    }
}

export async function initializeUnits() {
    try {
        const response = await fetch('/api/units');
        const units = await response.json();

        const [fxResponse, seffectsResponse] = await Promise.all([
            fetch('/api/fx'),
            fetch('/api/seffects')
        ]);

        const [effectsObj, skillEffectsObj] = await Promise.all([
            fxResponse.json(),
            seffectsResponse.json()
        ]);

        const effects = Object.keys(effectsObj);
        const skillEffects = Object.keys(skillEffectsObj);

        await Promise.all(
            effects.map(file => loadEffect(file + '.js'))
        );

        await Promise.all(
            skillEffects.map(file => loadSkillEffect(file + '.json'))
        );

        const loadPromises = units.map(unit => loadUnit(unit));
        await Promise.all(loadPromises);

        return Array.from(loadedUnits.values());
    } catch (error) {
        return [];
    }
}

export function getUnitData(unitId) {
    return loadedUnits.get(unitId);
}

export function getSkill(skillName) {
    return loadedSkills.get(skillName);
}

export function getEffect(effectName) {
    return loadedEffects.get(effectName);
}

export function getSkillEffect(effectName) {
    return loadedSkillEffects.get(effectName);
}
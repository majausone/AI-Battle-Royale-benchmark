import { reportValidationIssue } from './socketManager.js';

function reportEffect(effectId, message, isError = false) {
    const filename = effectId ? `${effectId}.json` : 'seffect-unknown.json';
    console.warn(message);
    reportValidationIssue(filename, message, isError);
}

export function validateEffect(effect) {
    if (!effect) {
        reportEffect(null, `Warning: Null or undefined effect object provided.`);
        return false;
    }

    if (!effect.id) {
        reportEffect(null, `Warning: Effect is missing required 'id' property.`);
        return false;
    }

    if (!effect.effectType) {
        reportEffect(effect.id, `Warning: Effect '${effect.id}' is missing required 'effectType' property.`);
        return false;
    }

    switch (effect.effectType) {
        case 'STAT':
            return validateStatEffect(effect);
        case 'MULTI_STAT':
            return validateMultiStatEffect(effect);
        case 'AURA':
            return validateAuraEffect(effect);
        case 'PROJECTILE':
            return validateProjectileEffect(effect);
        default:
            reportEffect(effect.id, `Warning: Effect '${effect.id}' has unknown effect type '${effect.effectType}'.`);
            return false;
    }
}

function validateStatEffect(effect) {
    let isValid = true;

    if (!effect.stat && !effect.shieldAmount && !effect.damageAmount && !effect.healAmount) {
        reportEffect(effect.id, `Warning: STAT effect '${effect.id}' needs at least one of these properties: 'stat', 'shieldAmount', 'damageAmount', or 'healAmount'.`);
        isValid = false;
    }

    if (effect.stat && effect.stat !== "damage" && effect.stat !== "speed") {
        reportEffect(effect.id, `Warning: STAT effect '${effect.id}' has invalid 'stat' value. Valid values are: 'damage', 'speed'.`);
        isValid = false;
    }

    if ((effect.damageAmount || effect.healAmount) && !effect.pulseInterval) {
        reportEffect(effect.id, `Warning: STAT effect '${effect.id}' has 'damageAmount' or 'healAmount' but is missing required 'pulseInterval'.`);
        isValid = false;
    }

    if (effect.effects) {
        reportEffect(effect.id, `Warning: 'effects' property is not allowed in STAT effect '${effect.id}'.`);
        isValid = false;
    }

    if (effect.auraRadius) {
        reportEffect(effect.id, `Warning: 'auraRadius' property is not allowed in STAT effect '${effect.id}'.`);
        isValid = false;
    }

    if (effect.targetType) {
        reportEffect(effect.id, `Warning: 'targetType' property is not allowed in STAT effect '${effect.id}'.`);
        isValid = false;
    }

    if (effect.targetEffectId) {
        reportEffect(effect.id, `Warning: 'targetEffectId' property is not allowed in STAT effect '${effect.id}'.`);
        isValid = false;
    }

    if (effect.noUnit) {
        reportEffect(effect.id, `Warning: 'noUnit' property is not allowed in STAT effect '${effect.id}'.`);
        isValid = false;
    }

    return isValid;
}

function validateMultiStatEffect(effect) {
    let isValid = true;

    if (!effect.effects || !Array.isArray(effect.effects) || effect.effects.length === 0) {
        reportEffect(effect.id, `Warning: MULTI_STAT effect '${effect.id}' is missing required 'effects' array property.`);
        isValid = false;
    } else {
        effect.effects.forEach((subEffect, index) => {
            if (!subEffect.stat) {
                reportEffect(effect.id, `Warning: MULTI_STAT effect '${effect.id}' has subeffect at index ${index} missing required 'stat' property.`);
                isValid = false;
            }

            if (subEffect.stat && subEffect.stat !== "damage" && subEffect.stat !== "speed") {
                reportEffect(effect.id, `Warning: MULTI_STAT effect '${effect.id}' has invalid 'stat' value in subeffect at index ${index}. Valid values are: 'damage', 'speed'.`);
                isValid = false;
            }
        });
    }

    if (effect.stat) {
        reportEffect(effect.id, `Warning: 'stat' property is not allowed directly in MULTI_STAT effect '${effect.id}'.`);
        isValid = false;
    }

    if (effect.value) {
        reportEffect(effect.id, `Warning: 'value' property is not allowed directly in MULTI_STAT effect '${effect.id}'.`);
        isValid = false;
    }

    if (effect.auraRadius) {
        reportEffect(effect.id, `Warning: 'auraRadius' property is not allowed in MULTI_STAT effect '${effect.id}'.`);
        isValid = false;
    }

    if (effect.targetType) {
        reportEffect(effect.id, `Warning: 'targetType' property is not allowed in MULTI_STAT effect '${effect.id}'.`);
        isValid = false;
    }

    if (effect.targetEffectId) {
        reportEffect(effect.id, `Warning: 'targetEffectId' property is not allowed in MULTI_STAT effect '${effect.id}'.`);
        isValid = false;
    }

    if (effect.noUnit) {
        reportEffect(effect.id, `Warning: 'noUnit' property is not allowed in MULTI_STAT effect '${effect.id}'.`);
        isValid = false;
    }

    return isValid;
}

function validateAuraEffect(effect) {
    let isValid = true;

    if (!effect.auraRadius) {
        reportEffect(effect.id, `Warning: AURA effect '${effect.id}' is missing required 'auraRadius' property.`);
        isValid = false;
    }

    if (!effect.targetType) {
        reportEffect(effect.id, `Warning: AURA effect '${effect.id}' is missing required 'targetType' property.`);
        isValid = false;
    }

    if (effect.stat) {
        reportEffect(effect.id, `Warning: 'stat' property is not allowed in AURA effect '${effect.id}'.`);
        isValid = false;
    }

    if (effect.value) {
        reportEffect(effect.id, `Warning: 'value' property is not allowed in AURA effect '${effect.id}'.`);
        isValid = false;
    }

    if (effect.effects) {
        reportEffect(effect.id, `Warning: 'effects' property is not allowed in AURA effect '${effect.id}'.`);
        isValid = false;
    }

    return isValid;
}

function validateProjectileEffect(effect) {
    let isValid = true;

    if (effect.targetEffectId) {
        reportEffect(effect.id, `Warning: 'targetEffectId' property is not allowed in PROJECTILE effect '${effect.id}'.`);
        isValid = false;
    }

    if (effect.auraRadius) {
        reportEffect(effect.id, `Warning: 'auraRadius' property is not allowed in PROJECTILE effect '${effect.id}'.`);
        isValid = false;
    }

    if (effect.targetType) {
        reportEffect(effect.id, `Warning: 'targetType' property is not allowed in PROJECTILE effect '${effect.id}'.`);
        isValid = false;
    }

    if (effect.effects) {
        reportEffect(effect.id, `Warning: 'effects' property is not allowed in PROJECTILE effect '${effect.id}'.`);
        isValid = false;
    }

    if (effect.noUnit) {
        reportEffect(effect.id, `Warning: 'noUnit' property is not allowed in PROJECTILE effect '${effect.id}'.`);
        isValid = false;
    }

    if (effect.stat && effect.stat !== "damage" && effect.stat !== "speed") {
        reportEffect(effect.id, `Warning: PROJECTILE effect '${effect.id}' has invalid 'stat' value. Valid values are: 'damage', 'speed'.`);
        isValid = false;
    }

    return isValid;
}
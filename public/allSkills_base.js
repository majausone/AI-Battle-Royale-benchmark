import { reportValidationIssue } from './socketManager.js';

class SkillManager {
    constructor() {
        this.skillCache = new Map();
        this.skillProcessors = {
            "AURA": this.applyAuraSkill.bind(this),
            "BUFF": this.applyBuffSkill.bind(this),
            "DEBUFF": this.applyDebuffSkill.bind(this),
            "TRANSFORM": this.applyTransformSkill.bind(this),
            "SUMMON": this.applySummonSkill.bind(this),
            "PROJECTILE": this.applyCustomProjectileSkill.bind(this),
            "TELEPORT": this.applyTeleportSkill.bind(this)
        };
    }

    reportIssue(skill, message, isError = false, metadata = {}) {
        if (!skill || !skill.id) {
            console.warn(message);
            return;
        }

        const filename = `${skill.id}.js`;
        console.warn(message);

        const context = {
            aiId: metadata.aiId || skill._ownerContext?.aiId || null,
            teamId: metadata.teamId || skill._ownerContext?.teamId || null,
            matchId: metadata.matchId || window.currentMatchId || null
        };

        reportValidationIssue(filename, message, isError, context);
    }

    validateActivationSystem(skill) {
        const { metadata } = skill;

        if (!metadata.trigger ||
            !(metadata.trigger.onAttack ||
                metadata.trigger.onAttackOnce ||
                metadata.trigger.onGetAttacked ||
                metadata.trigger.onDeath ||
                metadata.trigger.onSpawn ||
                metadata.trigger.interval ||
                metadata.trigger.healthThreshold)) {
            this.reportIssue(skill, `Warning: Skill ${skill.id} does not have any activation system configured (required).`);
        }
    }

    validateProperty(skill, property, allowed, required = false) {
        const { metadata } = skill;

        if (required && (!metadata[property] || (Array.isArray(metadata[property]) && metadata[property].length === 0))) {
            this.reportIssue(skill, `Warning: Required property '${property}' missing for skill '${skill.id}'.`);
        }

        if (!allowed && metadata[property]) {
            this.reportIssue(skill, `Warning: Property '${property}' is not allowed for skill type ${metadata.skillType} but is defined for skill '${skill.id}'.`);
        }
    }

    validateTrigger(skill, trigger, allowed) {
        const { metadata } = skill;

        if (!allowed && metadata.trigger && metadata.trigger[trigger]) {
            this.reportIssue(skill, `Warning: Trigger '${trigger}' is not allowed for skill type ${metadata.skillType} but is defined for skill '${skill.id}'.`);
        }
    }

    validateFx(skill, fxType, allowed) {
        const { metadata } = skill;

        if (!allowed && metadata.fx && metadata.fx[fxType]) {
            this.reportIssue(skill, `Warning: FX '${fxType}' is not allowed for skill type ${metadata.skillType} but is defined for skill '${skill.id}'.`);
        }
    }

    async applySkill(skill, unit) {
        const { metadata } = skill;

        if (!metadata) {
            this.reportIssue(skill, `No metadata found for skill: ${skill.id}`, true, { aiId: unit?.aiId, teamId: unit?.teamId });
            return;
        }

        if (!metadata.skillType) {
            this.reportIssue(skill, `Skill type not defined for: ${skill.id}, skill will not be applied`, true, { aiId: unit?.aiId, teamId: unit?.teamId });
            return;
        }

        skill._ownerContext = {
            aiId: unit?.aiId || null,
            teamId: unit?.teamId || null
        };

        this.validateActivationSystem(skill);

        const processor = this.skillProcessors[metadata.skillType];
        if (processor) {
            await processor(skill, unit);
        } else {
            this.reportIssue(skill, `Unknown skill type: ${metadata.skillType} for skill: ${skill.id}, skill will not be applied`, true, { aiId: unit?.aiId, teamId: unit?.teamId });
        }
    }
}

export { SkillManager };

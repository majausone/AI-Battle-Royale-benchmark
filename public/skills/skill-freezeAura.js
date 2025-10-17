import { BaseSkill, isPaused, getEnemiesInRange, playSkillStartSound, applyFX, applySkillEffect, getSkillEffect, registerSkill } from '../baseSkill.js';

class FreezeAuraSkill extends BaseSkill {
    constructor() {
        super();
        this.id = "skill-freezeAura";
        this.metadata = {
            name: "Freeze Aura",
            description: "Freezes and slows nearby enemies",
            skillType: "AURA",
            seffects: "seffect-freezeAura",
            
            trigger: {
                onSpawn: true
            },
            
            sounds: {
                start: ["square", 1200, 300, 8, 20, 4000, 12, 0, 0, false, true, 80, 0, 0]
            }
        };
    }

    async apply(unit) {
        super.apply(unit);
    }
}

const skill = new FreezeAuraSkill();
export default skill;
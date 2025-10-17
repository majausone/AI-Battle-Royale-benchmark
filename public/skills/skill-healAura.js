import { BaseSkill, isPaused, getAlliesInRange, playSkillStartSound, applyFX, applySkillEffect, getSkillEffect, registerSkill } from '../baseSkill.js';

class HealAuraSkill extends BaseSkill {
    constructor() {
        super();
        this.id = "skill-healAura";
        this.metadata = {
            name: "Heal Aura",
            description: "Heals nearby allies over time",
            skillType: "AURA", 
            seffects: "seffect-healAura",
            
            trigger: {
                onSpawn: true
            },
            
            sounds: {
                start: ["sine", 600, 600, 3, 40, 1500, 2, 0, 0, false, true, 50, 40, 30]
            }
        };
    }

    async apply(unit) {
        super.apply(unit);
    }
}

const skill = new HealAuraSkill();
export default skill;
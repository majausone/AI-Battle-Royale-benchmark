import { BaseSkill, playSkillStartSound, applySkillEffect, getSkillEffect, registerSkill } from '../baseSkill.js';

class BerserkSkill extends BaseSkill {
    constructor() {
        super();
        this.id = "skill-berserk";
        this.metadata = {
            name: "Berserk",
            description: "Increases damage at low health",
            skillType: "BUFF",
            seffects: "seffect-berserk",
            
            trigger: {
                healthThreshold: 0.5
            },
            
            sounds: {
                start: ["sawtooth", 440, 200, 15, 80, 2000, 8, 0, 0, false, true, 60, 40, 0]
            },
            
            // --- By skill type
        };
    }

    async apply(unit) {
        super.apply(unit);
    }
}

const skill = new BerserkSkill();
export default skill;
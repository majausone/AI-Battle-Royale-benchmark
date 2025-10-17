import { BaseSkill, playSkillStartSound, applySkillEffect, getSkillEffect, registerSkill } from '../baseSkill.js';

class AngrySkill extends BaseSkill {
    constructor() {
        super();
        this.id = "skill-angry-3325";
        this.metadata = {
            name: "Angry",
            description: "Increases damage when attacked",
            skillType: "BUFF",
            seffects: "seffect-angry-3325",
            
            trigger: {
                onGetAttacked: true
            },
            
            sounds: {
                start: ["sawtooth", 440, 300, 18, 85, 2500, 10, 0, 0, false, true, 70, 50, 0]
            },
            
            // --- By skill type
        };
    }

    async apply(unit) {
        super.apply(unit);
    }
}

const skill = new AngrySkill();
export default skill;
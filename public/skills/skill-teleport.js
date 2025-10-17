import { BaseSkill, gameArea, isPaused, playSkillStartSound, registerSkill } from '../baseSkill.js';

class TeleportSkill extends BaseSkill {
    constructor() {
        super();
        this.id = "skill-teleport";
        this.metadata = {
            name: "Teleport",
            description: "Teleports the unit to a random location",
            skillType: "TELEPORT",
            seffects: null,
            
            trigger: {
                interval: 2000,
                chance: 0.5
            },
            
            sounds: {
                start: ["sine", 1600, 150, 20, 50, 4000, 10, 0, 0, false, true, 90, 0, 0]
            },
            
            // --- By skill type
            
            targetSelection: "RANDOM"
        };
    }

    apply(unit) {
        super.apply(unit);
    }
}

const skill = new TeleportSkill();
export default skill;
import { BaseSkill } from '../baseSkill.js';

class KamikazeSkill extends BaseSkill {
    constructor() {
        super();
        this.id = "skill-kamikaze-3809";
        this.metadata = {
            name: "Kamikaze",
            description: "Explota al ser atacado, dañando a los enemigos cercanos",
            skillType: "AURA",
            seffects: "seffect-explosion-3809",
            suicide: true,
            
            trigger: {
                onGetAttacked: true
            },
            
            sounds: {
                start: ["square", 100, 1500, 8, 100, 600, 15, 8, 8, true, false, 0, 0, 0]
            }
        };
    }

    apply(unit) {
        super.apply(unit);
    }
}

const skill = new KamikazeSkill();
export default skill;
import { BaseSkill } from '../baseSkill.js';

class FireballSkill extends BaseSkill {
    constructor() {
        super();
        this.id = "skill-fireball";
        this.metadata = {
            name: "Fireball",
            description: "Launches a fireball that burns enemies over time",
            skillType: "PROJECTILE",
            seffects: "seffect-burn",
            
            trigger: {
                interval: 6000,
                chance: 0.65
            },
            
            sounds: {
                start: ["square", 440, 250, 10, 70, 3000, 6, 3, 3, false, true, 50, 30, 20]
            },
            
            fx: {
                start: "fx-fireballStart",
                impact: "fx-burnStart"
            },
            
            // --- By skill type
            
            target: ["enemies", "allies"],
            
            projectileConfig: {
                speed: 6,
                size: 12,
                color: "#FF4500",
                trailColor: "#FF8C00",
                maxDistance: 350,
                damage: 100,
                count: 1,
                spreadAngle: 0,
                areaEffect: true,
                areaRadius: 80
            }
        };
    }

    apply(unit) {
        super.apply(unit);
    }
}

const skill = new FireballSkill();
export default skill;
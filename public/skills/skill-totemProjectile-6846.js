import { BaseSkill } from '../baseSkill.js';

class TotemProjectileSkill extends BaseSkill {
    constructor() {
        super();
        this.id = "skill-totemProjectile-6846";
        this.metadata = {
            name: "Totem Proyectil",
            description: "Lanza un proyectil que crea un tótem que mejora a los aliados",
            skillType: "PROJECTILE",
            seffects: "seffect-totemField-6846",
            
            trigger: {
                interval: 7000,
                chance: 0.8
            },
            
            sounds: {
                start: ["sine", 440, 300, 5, 50, 2000, 3, 0, 0, false, true, 60, 40, 20]
            },
            
            fx: {
                start: "fx-totemStart-6846",
                impact: "fx-totemImpact-6846"
            },
            
            target: ["allies"],
            
            projectileConfig: {
                speed: 5,
                size: 10,
                color: "#FFFF00",
                trailColor: "#FFFF00",
                maxDistance: 300,
                damage: 0,
                count: 1,
                spreadAngle: 0,
                areaEffect: true,
                areaRadius: 100
            }
        };
    }

    apply(unit) {
        super.apply(unit);
    }
}

const skill = new TotemProjectileSkill();
export default skill;
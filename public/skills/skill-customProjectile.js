import { BaseSkill, playSkillStartSound, applyFX, registerSkill } from '../baseSkill.js';

class CustomProjectileSkill extends BaseSkill {
    constructor() {
        super();
        this.id = "skill-customProjectile";
        this.metadata = {
            name: "Proyectiles Personalizados",
            description: "Lanza proyectiles especiales con efectos únicos",
            skillType: "PROJECTILE",
            seffects: "seffect-projectileImpact",
            
            trigger: {
                interval: 5000,
                chance: 0.7
            },
            
            sounds: {
                start: ["square", 880, 300, 5, 60, 2000, 4, 2, 2, false, true, 60, 40, 20]
            },
            
            // --- By skill type
            
            target: ["enemies"],
            
            projectileConfig: {
                speed: 8,
                size: 12,
                color: "#4682B4",
                trailColor: "#87CEEB",
                maxDistance: 400,
                damage: 10,
                count: 3,
                spreadAngle: 40,
                areaEffect: true,
                areaRadius: 80
            }
        };
    }

    async apply(unit) {
        super.apply(unit);
    }
}

const skill = new CustomProjectileSkill();
export default skill;
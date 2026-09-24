import { Color, ConeGeometry, Entity, Mesh, MeshInstance, StandardMaterial } from 'playcanvas';
import type { AppBase } from 'playcanvas';

type Character = {
    root: Entity;
    animate: (dt: number, speed: number, aiming: boolean) => void;
    setDead: () => void;
    reset: () => void;
    muzzle: Entity;
};

/** Original dimensioned placeholders: 1.78 m adults, forward = -Z, feet = y 0. */
export function createCharacter(app: AppBase, name: string, enemy: boolean): Character {
    const root = new Entity(name);
    const body = new Entity(`${name}-body`);
    root.addChild(body);
    app.root.addChild(root);

    function material(label: string, hex: number): StandardMaterial {
        const result = new StandardMaterial();
        result.name = `${name}-${label}`;
        result.diffuse = new Color((hex >> 16) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
        result.gloss = 8;
        result.update();
        return result;
    }
    const jacket = material('jacket', enemy ? 0x70483d : 0x69776e);
    const denim = material('denim', enemy ? 0x42424a : 0x303e4a);
    const skin = material('skin', enemy ? 0x9a7555 : 0xa67b56);
    const hair = material('hair', 0x252220);
    const shoe = material('boots', 0x28292a);
    const metal = material('pistol', 0x44494b);
    const seam = material('seams', enemy ? 0x462d2b : 0x3f504c);
    const undershirt = material('shirt', 0xb6ad94);
    const amber = material('armband', 0xc4a363);

    function part(
        label: string,
        parent: Entity,
        position: [number, number, number],
        scale: [number, number, number],
        mat: StandardMaterial,
        taper = 0
    ): Entity {
        const entity = new Entity(`${name}-${label}`);
        parent.addChild(entity);
        entity.setLocalPosition(...position);
        entity.setLocalScale(...scale);
        if (taper) {
            const geometry = new ConeGeometry({
                baseRadius: 0.5,
                peakRadius: taper * 0.5,
                height: 1,
                heightSegments: 1,
                capSegments: 6
            });
            entity.addComponent('render', {
                meshInstances: [new MeshInstance(Mesh.fromGeometry(app.graphicsDevice, geometry), mat)],
                castShadows: true,
                receiveShadows: true
            });
        } else {
            entity.addComponent('render', {
                type: 'box',
                material: mat,
                castShadows: true,
                receiveShadows: true
            });
        }
        return entity;
    }
    function pivot(label: string, parent: Entity, x: number, y: number, z: number): Entity {
        const entity = new Entity(`${name}-${label}`);
        parent.addChild(entity);
        entity.setLocalPosition(x, y, z);
        return entity;
    }

    part('hips', body, [0, 0.91, 0], [0.36, 0.23, 0.24], denim, 0.95);
    part('jacket-body', body, [0, 1.17, 0], [0.42, 0.48, 0.29], jacket, 1.22);
    part('shirt-collar', body, [0, 1.4, -0.12], [0.14, 0.1, 0.06], undershirt);
    part('zipper', body, [0, 1.17, -0.146], [0.013, 0.35, 0.011], seam);
    part('left-pocket', body, [-0.13, 1.13, -0.151], [0.09, 0.11, 0.018], seam);
    part('right-pocket', body, [0.13, 1.13, -0.151], [0.09, 0.11, 0.018], seam);
    part('jacket-hem', body, [0, 0.98, 0], [0.415, 0.045, 0.28], seam, 1);
    part('neck', body, [0, 1.46, 0], [0.13, 0.13, 0.14], skin, 1);
    part('head', body, [0, 1.625, 0], [0.215, 0.285, 0.225], skin, 0.95);
    part('hair', body, [0, 1.751, 0.012], [0.225, 0.057, 0.23], hair, 0.88);
    part('hair-back', body, [0, 1.655, 0.097], [0.18, 0.15, 0.035], hair);
    part('nose', body, [0, 1.626, -0.109], [0.044, 0.056, 0.038], skin);
    part('brow-left', body, [-0.049, 1.674, -0.101], [0.037, 0.017, 0.014], hair);
    part('brow-right', body, [0.049, 1.674, -0.101], [0.037, 0.017, 0.014], hair);
    part('ear-left', body, [-0.111, 1.62, 0], [0.023, 0.065, 0.035], skin);
    part('ear-right', body, [0.111, 1.62, 0], [0.023, 0.065, 0.035], skin);

    const legs: Entity[] = [];
    const knees: Entity[] = [];
    const arms: Entity[] = [];
    const elbows: Entity[] = [];
    for (const side of [-1, 1]) {
        const leg = pivot(`leg-${side}`, body, side * 0.106, 0.93, 0);
        part(`thigh-${side}`, leg, [0, -0.2, 0], [0.205, 0.43, 0.23], denim, 1.1);
        const knee = pivot(`knee-${side}`, leg, 0, -0.43, 0);
        part(`shin-${side}`, knee, [0, -0.195, 0], [0.17, 0.38, 0.185], denim, 1.15);
        part(`shoe-${side}`, knee, [0, -0.436, -0.048], [0.181, 0.127, 0.295], shoe);
        legs.push(leg);
        knees.push(knee);

        const arm = pivot(`shoulder-${side}`, body, side * 0.253, 1.366, 0);
        part(`sleeve-${side}`, arm, [side * 0.017, -0.144, 0], [0.175, 0.315, 0.19], jacket, 1.12);
        const elbow = pivot(`elbow-${side}`, arm, side * 0.017, -0.286, 0);
        part(`forearm-${side}`, elbow, [0, -0.113, 0], [0.139, 0.238, 0.15], jacket, 1.12);
        part(`cuff-${side}`, elbow, [0, -0.217, 0], [0.145, 0.04, 0.15], seam, 1);
        part(`hand-${side}`, elbow, [0, -0.279, -0.006], [0.092, 0.122, 0.101], skin, 0.95);
        if (enemy && side === -1) {
            part('crew-armband', arm, [-0.017, -0.145, 0], [0.181, 0.074, 0.2], amber, 1);
        }
        arms.push(arm);
        elbows.push(elbow);
    }

    const weapon = pivot('weapon', elbows[1], 0, -0.27, -0.006);
    part('pistol-slide', weapon, [0, 0.09, -0.11], [0.045, 0.065, 0.245], metal);
    const grip = part('pistol-grip', weapon, [0, 0.006, -0.023], [0.04, 0.117, 0.065], shoe);
    grip.setLocalEulerAngles(-15, 0, 0);
    const muzzle = pivot('muzzle', weapon, 0, 0.1, -0.244);
    let gait = 0;
    let dead = false;
    let aimBlend = 0;
    const animate = (dt: number, speed: number, aiming: boolean): void => {
        if (dead) return;
        const move = Math.min(Math.max(speed / 4.5, 0), 1);
        gait += Math.min(dt, 0.05) * (speed > 0.1 ? 7 + speed * 1.1 : 1.4);
        aimBlend += ((aiming ? 1 : 0) - aimBlend) * Math.min(1, dt * 12);
        const stride = Math.sin(gait) * 28 * move;
        body.setLocalPosition(0, Math.abs(Math.sin(gait)) * 0.026 * move, 0);
        body.setLocalEulerAngles(0, 0, Math.sin(gait) * move * 1.6);
        legs[0].setLocalEulerAngles(stride, 0, -1);
        legs[1].setLocalEulerAngles(-stride, 0, 1);
        knees[0].setLocalEulerAngles(-Math.max(0, -Math.sin(gait)) * move * 34, 0, 0);
        knees[1].setLocalEulerAngles(-Math.max(0, Math.sin(gait)) * move * 34, 0, 0);
        arms[0].setLocalEulerAngles(aimBlend * 20 - stride * 0.6 * (1 - aimBlend), 0, aimBlend * 10);
        arms[1].setLocalEulerAngles(aimBlend * 51 + stride * 0.35 * (1 - aimBlend), 0, aimBlend * 4);
        elbows[0].setLocalEulerAngles(15 + aimBlend * 40, 0, 0);
        elbows[1].setLocalEulerAngles(12 + aimBlend * 32, 0, 0);
        const rightArmPitch = aimBlend * 83 + 12 + stride * 0.35 * (1 - aimBlend);
        weapon.setLocalEulerAngles(-55 * (1 - aimBlend) - rightArmPitch, 0, 0);
    };
    const reset = (): void => {
        dead = false;
        weapon.enabled = true;
        aimBlend = 0;
        gait = 0;
        body.setLocalPosition(0, 0, 0);
        body.setLocalEulerAngles(0, 0, 0);
        animate(0, 0, false);
    };
    reset();
    return {
        root,
        muzzle,
        animate,
        reset,
        setDead: () => {
            dead = true;
            body.setLocalEulerAngles(87, 0, 12);
            body.setLocalPosition(0, 0.19, -0.25);
            arms[0].setLocalEulerAngles(-18, 0, -27);
            arms[1].setLocalEulerAngles(15, 0, 32);
            weapon.enabled = false;
        }
    };
}

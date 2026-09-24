import { Asset, Color, Entity, StandardMaterial, Vec3 } from 'playcanvas';
import type { AppBase, ContainerResource } from 'playcanvas';

import data from './level-data.json';

export type Box = {
    name: string;
    min: Vec3;
    max: Vec3;
};

export type Surface = {
    name: string;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    y: number;
    rise?: number;
};

export type Door = {
    id: string;
    entity: Entity;
    box: Box;
    open: boolean;
};

export type Level = {
    colliders: Box[];
    surfaces: Surface[];
    doors: Door[];
    ledger: Vec3;
    spawn: Vec3;
    exit: Vec3;
    markers: Record<string, Vec3>;
};

/** Authored metres and orientation are retained: +X east, -Z north, +Y up. */
export async function createLevel(app: AppBase): Promise<Level> {
    const asset = new Asset('morrow-two-architecture', 'container', {
        url: '/assets/models/morrow-level.glb'
    });
    app.assets.add(asset);
    await new Promise<void>((resolve, reject) => {
        asset.ready(() => resolve());
        asset.once('error', (error: string) => reject(new Error(error)));
        app.assets.load(asset);
    });
    const visual = (asset.resource as ContainerResource).instantiateRenderEntity({
        castShadows: true,
        receiveShadows: true
    });
    visual.name = 'morrow-two-authored-architecture';
    // The model is authored against the gameplay origin, not grounded by its global
    // terrain AABB. Scale=1, position=0, yaw=0 intentionally preserve all openings.
    app.root.addChild(visual);
    const vector = (values: number[]) => new Vec3(values[0], values[1], values[2]);
    const colliders: Box[] = data.colliders.map((box) => ({
        name: box.name,
        min: vector(box.min),
        max: vector(box.max)
    }));

    const door = new Entity('apartment204-interactive-door');
    const material = new StandardMaterial();
    material.diffuse = new Color(0.29, 0.2, 0.12);
    material.gloss = 0.05;
    material.useMetalness = true;
    material.update();
    door.addComponent('render', { type: 'box', material });
    door.setPosition(vector(data.door.center));
    door.setLocalScale(vector(data.door.size));
    app.root.addChild(door);
    const center = vector(data.door.center);
    const half = vector(data.door.size).mulScalar(0.5);
    const doorBox = {
        name: 'apartment204-interactive-door',
        min: center.clone().sub(half),
        max: center.clone().add(half)
    };
    colliders.push(doorBox);

    for (const definition of data.lights) {
        const light = new Entity(definition.name);
        light.setPosition(vector(definition.position));
        light.addComponent('light', {
            type: 'omni',
            color: new Color(...(definition.color as [number, number, number])),
            intensity: definition.intensity,
            range: definition.range,
            castShadows: false
        });
        app.root.addChild(light);
    }

    return {
        colliders,
        surfaces: data.surfaces,
        doors: [{ id: data.door.id, entity: door, box: doorBox, open: false }],
        ledger: vector(data.ledger),
        spawn: vector(data.spawn),
        exit: vector(data.exit),
        markers: Object.fromEntries(Object.entries(data.markers).map(([name, position]) => [name, vector(position)]))
    };
}

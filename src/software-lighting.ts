import { Color, Entity, Mat4, Mesh, MeshInstance, StandardMaterial, Vec3 } from 'playcanvas';
import type { AppBase, RenderComponent } from 'playcanvas';

import level from './level-data.json';

/** Vertex tint approximation for software WebGL; no occlusion or lightmap bake. */
export function createSoftwareLighting(app: AppBase): (enabled: boolean) => void {
    const saved = new Map<StandardMaterial, { lighting: boolean; vertexColor: boolean; channel: string }>();
    const architecture = new Set<StandardMaterial>();
    const ambient = app.scene.ambientLight.clone();
    let baked = false;

    const bake = () => {
        const root = app.root.findByName('morrow-two-authored-architecture');
        if (!(root instanceof Entity)) return;
        const point = new Vec3();
        const normal = new Vec3();
        const key = new Vec3(-0.4, 0.78, 0.45).normalize();
        for (const component of root.findComponents('render')) {
            const render = component as RenderComponent;
            const full = render.meshInstances.slice();
            const low = full.map((instance) => {
                const source = instance.mesh;
                if (!(instance.material instanceof StandardMaterial) || instance.skinInstance || instance.morphInstance)
                    return instance;
                const positions: number[] = [];
                const normals: number[] = [];
                const count = source.getPositions(positions);
                if (!count || source.getNormals(normals) !== count) return instance;
                const transform = instance.node.getWorldTransform();
                const normalMatrix = new Mat4().copy(transform).invert().transpose();
                const colors = new Float32Array(count * 4);
                for (let i = 0; i < count; i++) {
                    const offset = i * 3;
                    point.set(positions[offset], positions[offset + 1], positions[offset + 2]);
                    transform.transformPoint(point, point);
                    normal.set(normals[offset], normals[offset + 1], normals[offset + 2]);
                    normalMatrix.transformVector(normal, normal).normalize();
                    const inside = Math.abs(point.x) < 15.2 && Math.abs(point.z) < 16.2 && point.y < 6.8;
                    const directional = Math.max(0, normal.dot(key));
                    const base = inside ? 0.42 + 0.1 * directional : 0.43 + 0.32 * directional;
                    let r = base;
                    let g = base * 1.03;
                    let b = base * 1.08;
                    if (inside) {
                        for (const light of level.lights) {
                            // Keep fixtures from illuminating the storey underneath them.
                            if (point.y < 3.3 !== light.position[1] < 3.3) continue;
                            const dx = light.position[0] - point.x;
                            const dy = light.position[1] - point.y;
                            const dz = light.position[2] - point.z;
                            const distance = Math.hypot(dx, dy, dz);
                            if (distance >= light.range) continue;
                            const facing = Math.max(
                                0,
                                (normal.x * dx + normal.y * dy + normal.z * dz) / Math.max(0.01, distance)
                            );
                            const strength =
                                (1 - distance / light.range) ** 2 * light.intensity * (0.35 + facing) * 0.65;
                            r += light.color[0] * strength;
                            g += light.color[1] * strength;
                            b += light.color[2] * strength;
                        }
                    }
                    colors.set([Math.min(1, r), Math.min(1, g), Math.min(1, b), 1], i * 4);
                }
                // A GLB's existing vertex format has no COLOR stream. Rebuild a
                // separate mesh rather than silently dropping UVs by changing it.
                const mesh = new Mesh(app.graphicsDevice);
                for (const element of source.vertexBuffer.format.elements) {
                    if (element.name === 'COLOR') continue;
                    const values: number[] = [];
                    source.getVertexStream(element.name, values);
                    mesh.setVertexStream(
                        element.name,
                        values,
                        element.numComponents,
                        count,
                        element.dataType,
                        element.normalize,
                        element.asInt
                    );
                }
                const indices: number[] = [];
                source.getIndices(indices);
                if (indices.length) mesh.setIndices(indices);
                mesh.setColors(colors);
                mesh.update(source.primitive[0].type, false);
                mesh.aabb.copy(source.aabb);
                Object.assign(mesh.primitive[0], source.primitive[0]);
                const replacement = new MeshInstance(mesh, instance.material, instance.node);
                replacement.castShadow = instance.castShadow;
                replacement.receiveShadow = instance.receiveShadow;
                replacement.cull = instance.cull;
                replacement.visible = instance.visible;
                architecture.add(instance.material);
                return replacement;
            });
            // RenderComponent's setter destroys the old instances. Replace only
            // once; full quality keeps these identical streams and ignores tint.
            render.meshInstances = low;
        }
        baked = true;
    };

    return (enabled: boolean) => {
        if (enabled && !baked) bake();
        // StandardMaterial without direct lighting still multiplies scene ambient.
        // White ambient lets the precomputed vertex tint supply that term once.
        app.scene.ambientLight.copy(enabled ? Color.WHITE : ambient);
        for (const component of app.root.findComponents('render')) {
            for (const instance of (component as RenderComponent).meshInstances) {
                const material = instance.material;
                if (!(material instanceof StandardMaterial)) continue;
                if (!saved.has(material))
                    saved.set(material, {
                        lighting: material.useLighting,
                        vertexColor: material.diffuseVertexColor,
                        channel: material.diffuseVertexColorChannel
                    });
                const original = saved.get(material)!;
                material.useLighting = enabled ? false : original.lighting;
                material.diffuseVertexColor = enabled && architecture.has(material) ? true : original.vertexColor;
                material.diffuseVertexColorChannel = enabled && architecture.has(material) ? 'rgb' : original.channel;
                material.update();
            }
        }
        app.renderNextFrame = true;
    };
}

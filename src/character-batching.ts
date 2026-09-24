import { Color, Entity, Mat4, Mesh, MeshInstance, PRIMITIVE_TRIANGLES, StandardMaterial, Vec3 } from 'playcanvas';

const batchedRoots = new WeakSet<Entity>();

/**
 * Optional one-time optimization for createCharacter's untextured, rigid pieces.
 * Call after construction. Only static leaf renderers are combined, within their
 * existing parent pivot; walking, aiming, death and weapon visibility stay local.
 * Original leaf entities remain in the hierarchy with their renderers disabled.
 */
export function batchCharacter(root: Entity): void {
    if (batchedRoots.has(root)) return;
    batchedRoots.add(root);

    const material = new StandardMaterial();
    material.name = `${root.name}-batched-clothing`;
    material.diffuse = new Color(1, 1, 1);
    material.diffuseVertexColor = true;
    material.diffuseVertexColorChannel = 'rgb';
    material.gloss = 8;
    material.update();
    root.once('destroy', () => material.destroy());

    const position = new Vec3();
    const normal = new Vec3();
    const normalMatrix = new Mat4();

    const combineAtPivot = (parent: Entity): void => {
        const children = parent.children.filter((child): child is Entity => child instanceof Entity);
        for (const child of children) combineAtPivot(child);

        const pieces = children.filter((child) => {
            const render = child.render;
            return (
                child.children.length === 0 &&
                render?.enabled &&
                render.meshInstances.length === 1 &&
                render.meshInstances.every((instance) => {
                    const source = instance.material;
                    return (
                        instance.visible &&
                        !instance.skinInstance &&
                        !instance.morphInstance &&
                        instance.mesh.primitive[0]?.type === PRIMITIVE_TRIANGLES &&
                        source instanceof StandardMaterial &&
                        !source.diffuseMap &&
                        !source.normalMap &&
                        source.opacity === 1
                    );
                })
            );
        });
        if (pieces.length < 2) return;

        const firstRender = pieces[0].render!;
        // This helper targets the current identical opaque character materials.
        // Leave a pivot alone if future art introduces differing render settings.
        if (
            pieces.some(
                (piece) =>
                    piece.render!.castShadows !== firstRender.castShadows ||
                    piece.render!.receiveShadows !== firstRender.receiveShadows ||
                    piece.render!.layers.join(',') !== firstRender.layers.join(',')
            )
        ) {
            return;
        }

        const positions: number[] = [];
        const normals: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];
        for (const piece of pieces) {
            const instance = piece.render!.meshInstances[0];
            const source = instance.mesh;
            const sourcePositions: number[] = [];
            const sourceNormals: number[] = [];
            const sourceIndices: number[] = [];
            const vertexCount = source.getPositions(sourcePositions);
            if (!vertexCount || source.getNormals(sourceNormals) !== vertexCount) return;
            const vertexOffset = positions.length / 3;
            const transform = piece.getLocalTransform();
            normalMatrix.copy(transform).invert().transpose();
            // StandardMaterial linearizes its diffuse uniform; vertex colors are
            // already linear in the shader, so retain that same color space.
            const color = new Color().linear((instance.material as StandardMaterial).diffuse);

            for (let vertex = 0; vertex < vertexCount; vertex++) {
                const offset = vertex * 3;
                position.set(sourcePositions[offset], sourcePositions[offset + 1], sourcePositions[offset + 2]);
                transform.transformPoint(position, position);
                positions.push(position.x, position.y, position.z);
                normal.set(sourceNormals[offset], sourceNormals[offset + 1], sourceNormals[offset + 2]);
                normalMatrix.transformVector(normal, normal).normalize();
                normals.push(normal.x, normal.y, normal.z);
                colors.push(color.r, color.g, color.b, 1);
            }

            const primitive = source.primitive[0];
            if (primitive.indexed) {
                source.getIndices(sourceIndices);
                for (let index = primitive.base; index < primitive.base + primitive.count; index++) {
                    indices.push(sourceIndices[index] + vertexOffset);
                }
            } else {
                for (let vertex = primitive.base; vertex < primitive.base + primitive.count; vertex++) {
                    indices.push(vertex + vertexOffset);
                }
            }
        }

        const mesh = new Mesh(firstRender.meshInstances[0].mesh.device);
        mesh.setPositions(positions);
        mesh.setNormals(normals);
        mesh.setColors(colors);
        mesh.setIndices(indices);
        mesh.update(PRIMITIVE_TRIANGLES);
        const batch = new Entity(`${parent.name}-static-batch`);
        parent.addChild(batch);
        batch.addComponent('render', {
            meshInstances: [new MeshInstance(mesh, material)],
            castShadows: firstRender.castShadows,
            receiveShadows: firstRender.receiveShadows,
            layers: firstRender.layers.slice()
        });
        for (const piece of pieces) piece.render!.enabled = false;
    };

    combineAtPivot(root);
}

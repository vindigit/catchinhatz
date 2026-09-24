import type { Vec3 } from 'playcanvas';

import type { Box, Level } from './level';

/** Shared slab raycast: result is world metres, including hits when starting inside. */
export function rayBox(origin: Vec3, direction: Vec3, box: Box, maximum: number, padding = 0): number | null {
    let near = 0;
    let far = maximum;
    for (const axis of ['x', 'y', 'z'] as const) {
        const min = box.min[axis] - padding;
        const max = box.max[axis] + padding;
        if (Math.abs(direction[axis]) < 0.000001) {
            if (origin[axis] < min || origin[axis] > max) return null;
        } else {
            let a = (min - origin[axis]) / direction[axis];
            let b = (max - origin[axis]) / direction[axis];
            if (a > b) [a, b] = [b, a];
            near = Math.max(near, a);
            far = Math.min(far, b);
            if (near > far) return null;
        }
    }
    return near <= maximum ? near : null;
}

export class WorldCollision {
    level: Level;
    constructor(level: Level) {
        this.level = level;
    }

    active(box: Box): boolean {
        return !this.level.doors.some((door) => door.box === box && door.open);
    }

    ray(origin: Vec3, direction: Vec3, maximum: number, padding = 0): number {
        let distance = maximum;
        for (const box of this.level.colliders) {
            if (!this.active(box)) continue;
            const hit = rayBox(origin, direction, box, distance, padding);
            if (hit !== null) distance = hit;
        }
        // The tread geometry uses smooth support ramps, so camera and shots also
        // intersect their bounded planes. Boxes alone leave a gap below the steps.
        for (const surface of this.level.surfaces) {
            if (!surface.rise) continue;
            const slope = surface.rise / (surface.maxZ - surface.minZ);
            const signed = origin.y - surface.y - slope * (origin.z - surface.minZ);
            const velocity = direction.y - slope * direction.z;
            if (Math.abs(velocity) < 0.000001 || signed * velocity >= 0) continue;
            const offset = Math.sign(signed) * padding * Math.sqrt(1 + slope * slope);
            const hit = Math.max(0, (offset - signed) / velocity);
            const x = origin.x + direction.x * hit;
            const z = origin.z + direction.z * hit;
            if (hit < distance && x >= surface.minX && x <= surface.maxX && z >= surface.minZ && z <= surface.maxZ)
                distance = hit;
        }
        return distance;
    }

    visible(from: Vec3, to: Vec3): boolean {
        const delta = to.clone().sub(from);
        const distance = delta.length();
        if (distance < 0.001) return true;
        return this.ray(from, delta.mulScalar(1 / distance), distance) >= distance - 0.04;
    }

    ground(x: number, z: number, currentY: number): number | null {
        let best: number | null = null;
        let bestScore = Infinity;
        for (const surface of this.level.surfaces) {
            if (x < surface.minX || x > surface.maxX || z < surface.minZ || z > surface.maxZ) continue;
            const y = surface.y + (surface.rise ?? 0) * ((z - surface.minZ) / (surface.maxZ - surface.minZ));
            const difference = Math.abs(y - currentY);
            if (difference > 0.38) continue;
            const score = difference - (surface.rise ? 0.1 : 0);
            if (score < bestScore) {
                bestScore = score;
                best = y;
            }
        }
        return best;
    }

    blocked(x: number, y: number, z: number, radius = 0.3): boolean {
        for (const box of this.level.colliders) {
            if (!this.active(box) || y + 1.72 <= box.min.y || y + 0.14 >= box.max.y) continue;
            const nearestX = Math.max(box.min.x, Math.min(x, box.max.x));
            const nearestZ = Math.max(box.min.z, Math.min(z, box.max.z));
            if ((x - nearestX) ** 2 + (z - nearestZ) ** 2 < radius ** 2) return true;
        }
        return false;
    }

    move(position: Vec3, dx: number, dz: number, radius = 0.3): number {
        const before = position.clone();
        const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.09));
        for (let step = 0; step < count; step++) {
            const x = position.x + dx / count;
            let y = this.ground(x, position.z, position.y);
            if (y !== null && !this.blocked(x, y, position.z, radius)) position.set(x, y, position.z);
            const z = position.z + dz / count;
            y = this.ground(position.x, z, position.y);
            if (y !== null && !this.blocked(position.x, y, z, radius)) position.set(position.x, y, z);
        }
        return before.distance(position);
    }
}

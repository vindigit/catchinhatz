import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

type Position = {
    x: number;
    y: number;
    z: number;
};

type Snapshot = {
    status: 'ready' | 'playing' | 'paused' | 'failed' | 'complete';
    health: number;
    ammo: number;
    reserve: number;
    stage: number;
    ledger: boolean;
    position: Position;
    enemies: { id: string; health: number; position: Position; state: string }[];
    doors: { id: string; open: boolean }[];
    camera: { position: Position; clearance: number };
};

type Debug = {
    snapshot(): Snapshot;
    teleport(x: number, y: number, z: number): void;
    look(yaw: number, pitch: number): void;
    step(dt: number, frames: number): void;
    setInput(input: { forward?: number; right?: number; shoot?: boolean; aim?: boolean; sprint?: boolean }): void;
    interact(): void;
    reload(): void;
    start(): void;
    retry(): void;
    damage(amount: number): void;
    pauseSimulation(value: boolean): void;
};

type GameWindow = Window & { __morrow: Debug };

const state = (page: Page) => page.evaluate(() => (window as GameWindow).__morrow.snapshot());

async function moveTo(page: Page, x: number, z: number, maxFrames = 650) {
    const result = await page.evaluate(
        ({ x, z, maxFrames }) => {
            const game = (window as GameWindow).__morrow;
            let frames = 0;
            let distance = Infinity;
            for (; frames < maxFrames; frames++) {
                const current = game.snapshot();
                const dx = x - current.position.x;
                const dz = z - current.position.z;
                distance = Math.hypot(dx, dz);
                if (distance < 0.22 || current.status !== 'playing') break;
                game.look(Math.atan2(dx, -dz), 0);
                game.setInput({ forward: 1, right: 0, shoot: false, aim: false, sprint: false });
                game.step(1 / 60, 1);
            }
            game.setInput({ forward: 0, right: 0, shoot: false, aim: false, sprint: false });
            return { distance, frames, snapshot: game.snapshot() };
        },
        { x, z, maxFrames }
    );
    if (result.snapshot.status !== 'complete') {
        expect(
            result.distance,
            `Reach (${x}, ${z}), ended at ${JSON.stringify(result.snapshot.position)}`
        ).toBeLessThan(0.3);
    }
    return result.snapshot;
}

async function defeat(page: Page, id: string) {
    const result = await page.evaluate((id) => {
        const game = (window as GameWindow).__morrow;
        for (let frame = 0; frame < 240; frame++) {
            const current = game.snapshot();
            const enemy = current.enemies.find((candidate) => candidate.id === id);
            if (!enemy || enemy.health <= 0 || current.status !== 'playing') break;
            const dx = enemy.position.x - current.position.x;
            const dz = enemy.position.z - current.position.z;
            game.look(Math.atan2(dx, -dz), 0);
            game.setInput({ forward: 0, right: 0, shoot: true, aim: true, sprint: false });
            if (current.ammo === 0) game.reload();
            game.step(1 / 60, 1);
        }
        game.setInput({ forward: 0, right: 0, shoot: false, aim: false, sprint: false });
        return game.snapshot();
    }, id);
    expect(result.status, `Survive fight with ${id}`).toBe('playing');
    expect(result.enemies.find((enemy) => enemy.id === id)?.health, `Defeat ${id} by firing`).toBeLessThanOrEqual(0);
    return result;
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as Window & { __morrow?: unknown }).__morrow));
    await page.evaluate(() => {
        const game = (window as GameWindow).__morrow;
        game.pauseSimulation(true);
        game.start();
    });
});

test('failure and retry reset combat, objective, enemies, doors and spawn', async ({ page }) => {
    const initial = await state(page);
    await page.evaluate(() => {
        const game = (window as GameWindow).__morrow;
        game.teleport(0, 0, 12);
        game.step(1 / 60, 1);
        game.setInput({ shoot: true });
        game.step(1 / 60, 1);
        game.setInput({ shoot: false });
        game.damage(100);
    });
    expect((await state(page)).status).toBe('failed');
    await page.evaluate(() => (window as GameWindow).__morrow.retry());
    const retried = await state(page);
    expect(retried.status).toBe('playing');
    expect(retried.health).toBe(initial.health);
    expect(retried.ammo).toBe(initial.ammo);
    expect(retried.reserve).toBe(initial.reserve);
    expect(retried.stage).toBe(0);
    expect(retried.ledger).toBe(false);
    expect(retried.position).toEqual(initial.position);
    expect(retried.enemies.map(({ id, health }) => ({ id, health }))).toEqual(
        initial.enemies.map(({ id, health }) => ({ id, health }))
    );
    expect(retried.doors).toEqual(initial.doors);
});

test('rear exit rejects an unfinished encounter', async ({ page }) => {
    await page.evaluate(() => {
        const game = (window as GameWindow).__morrow;
        game.teleport(0, 0, -18);
        game.interact();
        game.step(1 / 60, 2);
    });
    const current = await state(page);
    expect(current.status).toBe('playing');
    expect(current.stage).toBeLessThan(5);
    expect(current.ledger).toBe(false);
});

test('both stairwells change elevation continuously under movement input', async ({ page }) => {
    await page.evaluate(() => (window as GameWindow).__morrow.teleport(-6, 0, 5.6));
    const aMiddle = await moveTo(page, -6, 0);
    expect(aMiddle.position.y).toBeGreaterThan(1);
    expect(aMiddle.position.y).toBeLessThan(2.5);
    const aTop = await moveTo(page, -6, -6);
    expect(aTop.position.y).toBeCloseTo(3.4, 1);
    await page.evaluate(() => (window as GameWindow).__morrow.teleport(6, 3.4, -5.6));
    const bMiddle = await moveTo(page, 6, 0);
    expect(bMiddle.position.y).toBeGreaterThan(1);
    expect(bMiddle.position.y).toBeLessThan(2.5);
    const bBottom = await moveTo(page, 6, 6);
    expect(bBottom.position.y).toBeCloseTo(0, 1);
});

test('solid facade blocks movement and camera stays out of the wall', async ({ page }) => {
    await page.evaluate(() => {
        const game = (window as GameWindow).__morrow;
        game.teleport(8, 0, 19);
        game.look(0, 0);
        game.setInput({ forward: 1 });
        game.step(1 / 60, 180);
        game.setInput({ forward: 0 });
    });
    const blocked = await state(page);
    expect(blocked.position.z).toBeGreaterThan(16);
    expect(blocked.position.z).toBeLessThan(19);
    expect(blocked.camera.clearance).toBeGreaterThan(0);
});

test('orbiting and pitching the camera at mid-stair stays above the stair surface', async ({ page }) => {
    const samples = await page.evaluate(() => {
        const game = (window as GameWindow).__morrow;
        game.teleport(-6, 1.7, 0);
        const samples: Snapshot['camera'][] = [];
        for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
            for (const pitch of [-0.55, 0, 0.7]) {
                game.look(yaw, pitch);
                samples.push(game.snapshot().camera);
            }
        }
        return samples;
    });
    for (const camera of samples) {
        expect(camera.clearance).toBeGreaterThan(0.1);
        const { x, y, z } = camera.position;
        if (x >= -7.82 && x <= -4.18 && z >= -5 && z <= 5) {
            const stairHeight = 3.4 - (3.4 * (z + 5)) / 10;
            expect(y, `Camera ${JSON.stringify(camera.position)} above stair ${stairHeight}`).toBeGreaterThan(
                stairHeight + 0.04
            );
        }
    }
});

test('apartment door blocks movement and gunfire until opened', async ({ page }) => {
    const before = await state(page);
    await page.evaluate(() => {
        const game = (window as GameWindow).__morrow;
        game.teleport(6, 3.4, -7.5);
        game.look(0, 0);
        game.setInput({ forward: 1, shoot: false, aim: false });
        game.step(1 / 60, 90);
        game.setInput({ forward: 0, shoot: false, aim: false });
    });
    const blocked = await state(page);
    expect(blocked.position.z).toBeGreaterThan(-9);
    await page.evaluate(() => {
        const game = (window as GameWindow).__morrow;
        game.teleport(4, 3.4, -7);
        for (let frame = 0; frame < 50; frame++) {
            const current = game.snapshot();
            const enemy = current.enemies.find((candidate) => candidate.id === 'apartment-guard')!;
            game.look(Math.atan2(enemy.position.x - current.position.x, current.position.z - enemy.position.z), 0);
            game.setInput({ shoot: true, aim: true });
            game.step(1 / 60, 1);
        }
        game.setInput({ shoot: false, aim: false });
    });
    const fired = await state(page);
    expect(fired.ammo).toBeLessThan(before.ammo);
    expect(fired.enemies.find((enemy) => enemy.id === 'apartment-guard')?.health).toBe(
        before.enemies.find((enemy) => enemy.id === 'apartment-guard')?.health
    );
    await page.evaluate(() => {
        const game = (window as GameWindow).__morrow;
        game.teleport(6, 3.4, -7.5);
        game.interact();
    });
    await moveTo(page, 6, -10.5);
    expect((await state(page)).doors.find((door) => door.id === 'apartment204')?.open).toBe(true);
});

test('walk the complete clearing route, recover ledger, descend Stair B and extract', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await moveTo(page, 0, 12);
    await defeat(page, 'lobby-guard');
    await moveTo(page, -6, 7);
    await moveTo(page, -6, -7.5);
    expect((await state(page)).stage).toBeGreaterThanOrEqual(2);
    await defeat(page, 'corridor-guard');
    await moveTo(page, 6, -7.5);
    const corridorImage = await page.screenshot({ path: testInfo.outputPath('level-two-corridor.png') });
    await testInfo.attach('level-two-corridor', { body: corridorImage, contentType: 'image/png' });
    await page.evaluate(() => (window as GameWindow).__morrow.interact());
    await moveTo(page, 6, -10.5);
    await defeat(page, 'apartment-guard');
    await moveTo(page, 10, -10.9);
    await page.evaluate(() => (window as GameWindow).__morrow.interact());
    expect((await state(page)).ledger).toBe(true);
    const apartmentImage = await page.screenshot({ path: testInfo.outputPath('apartment-ledger.png') });
    await testInfo.attach('apartment-ledger', { body: apartmentImage, contentType: 'image/png' });
    const spent = await state(page);
    await page.evaluate(() => {
        const game = (window as GameWindow).__morrow;
        game.reload();
        game.step(1 / 60, 90);
    });
    const reloaded = await state(page);
    expect(reloaded.ammo).toBe(12);
    expect(reloaded.reserve).toBe(spent.reserve - (12 - spent.ammo));
    await moveTo(page, 6, -10.5);
    await moveTo(page, 6, -7.5);
    await moveTo(page, 6, 6);
    expect((await state(page)).position.y).toBeCloseTo(0, 1);
    await moveTo(page, 10, 6);
    await moveTo(page, 10, 1);
    await defeat(page, 'service-guard');
    await moveTo(page, 10, -12);
    await moveTo(page, 0, -12);
    await moveTo(page, 0, -20);
    const completed = await state(page);
    expect(completed.status).toBe('complete');
    expect(completed.enemies.every((enemy) => enemy.health <= 0)).toBe(true);
    expect(completed.ledger).toBe(true);
    expect(completed.health).toBeGreaterThan(0);
    expect(completed.position.z).toBeLessThan(-17);
    await testInfo.attach('completion-state', {
        body: JSON.stringify(completed, null, 2),
        contentType: 'application/json'
    });
    const finishImage = await page.screenshot({ path: testInfo.outputPath('encounter-complete.png') });
    await testInfo.attach('encounter-complete', { body: finishImage, contentType: 'image/png' });
    await page.getByTestId('retry-game').click();
    const replay = await state(page);
    expect(replay.status).toBe('playing');
    expect(replay.health).toBe(100);
    expect(replay.ammo).toBe(12);
    expect(replay.reserve).toBe(96);
    expect(replay.stage).toBe(0);
    expect(replay.ledger).toBe(false);
    expect(replay.position).toEqual({ x: 0, y: 0, z: 21 });
    expect(replay.enemies.every((enemy) => enemy.health === 68)).toBe(true);
    expect(replay.doors.every((door) => !door.open)).toBe(true);
    expect(pageErrors).toEqual([]);
});

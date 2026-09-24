import {
    AppBase,
    AppOptions,
    BinaryHandler,
    BLEND_NORMAL,
    CameraComponentSystem,
    CameraFrame,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    RenderComponentSystem,
    RenderHandler,
    RESOLUTION_AUTO,
    StandardMaterial,
    TextureHandler,
    TONEMAP_ACES,
    Vec3,
    WebglGraphicsDevice,
    createGraphicsDevice
} from 'playcanvas';

import { EncounterAudio } from './audio';
import { createCharacter } from './character';
import { batchCharacter } from './character-batching';
import { Hud } from './hud';
import type { HudState } from './hud';
import { createLevel } from './level';
import { rayBox, WorldCollision } from './physics';
import { createSoftwareLighting } from './software-lighting';
import './starter.css';

type Input = { forward: number; right: number; shoot: boolean; aim: boolean; sprint: boolean };
type Character = ReturnType<typeof createCharacter>;
type Enemy = {
    id: string;
    actor: Character;
    position: Vec3;
    home: Vec3;
    health: number;
    state: 'patrol' | 'searching' | 'aiming' | 'firing' | 'staggered' | 'dead';
    alert: number;
    cooldown: number;
    stagger: number;
    patrol: number;
    windup: number;
    zone: [number, number, number, number];
};
const canvas = document.getElementById('application-canvas') as HTMLCanvasElement;
const loading = document.createElement('div');
loading.className = 'boot-message';
loading.textContent = 'MORROW TWO / Opening the south entrance…';
document.body.appendChild(loading);
try {
    await boot();
    loading.remove();
} catch (error) {
    loading.textContent = 'Morrow Two could not start. Reload to try again.';
    console.error(error);
}

async function boot() {
    const device = await createGraphicsDevice(canvas, {
        deviceTypes: ['webgl2'],
        antialias: false,
        powerPreference: 'high-performance'
    });
    const renderer = device instanceof WebglGraphicsDevice ? String(device.unmaskedRenderer) : 'unknown';
    let performanceMode = /swiftshader|llvmpipe|warp|microsoft basic|software/i.test(renderer);
    const options = new AppOptions();
    options.graphicsDevice = device;
    options.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
    options.resourceHandlers = [ContainerHandler, TextureHandler, BinaryHandler, RenderHandler];
    const app = new AppBase(canvas);
    app.init(options);
    // This small scene uses a fixed, short forward-light list. PlayCanvas cannot
    // re-enable clustered lighting after disabling it, so choose once at boot.
    app.scene.clusteredLightingEnabled = false;
    // Cap the internal raster budget independently of the crisp DOM interface.
    app.graphicsDevice.maxPixelRatio = 1;
    app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(RESOLUTION_AUTO);
    app.scene.ambientLight = new Color(0.34, 0.36, 0.4);
    app.scene.fog.type = 'linear';
    app.scene.fog.color = new Color(0.095, 0.115, 0.13);
    app.scene.fog.start = 24;
    app.scene.fog.end = 105;
    app.start();
    const level = await createLevel(app);
    const world = new WorldCollision(level);
    const player = createCharacter(app, 'bell-ward-runner', false);
    batchCharacter(player.root);
    const camera = new Entity('shoulder-camera');
    camera.addComponent('camera', {
        clearColor: new Color(0.095, 0.115, 0.13),
        nearClip: 0.045,
        farClip: 180,
        fov: 65,
        toneMapping: TONEMAP_ACES
    });
    app.root.addChild(camera);
    const frame = new CameraFrame(app, camera.camera!);
    frame.rendering.toneMapping = TONEMAP_ACES;
    frame.bloom.intensity = 0.025;
    frame.bloom.blurLevel = 4;
    frame.vignette.intensity = 0.18;
    frame.update();
    const moon = new Entity('clouded-moon');
    moon.addComponent('light', {
        type: 'directional',
        color: new Color(0.6, 0.68, 0.78),
        intensity: 0.85,
        castShadows: true,
        shadowDistance: 45,
        shadowResolution: 1024,
        shadowBias: 0.2,
        normalOffsetBias: 0.04
    });
    moon.setEulerAngles(48, -32, 0);
    app.root.addChild(moon);
    const practicals = app.root.children.filter(
        (entity): entity is Entity => entity instanceof Entity && entity.light?.type === 'omni'
    );
    const audio = new EncounterAudio();
    const keys = new Set<string>();
    let mouseShoot = false;
    let mouseAim = false;
    let touchForward = 0;
    let touchRight = 0;
    let touchShoot = false;
    let touchAim = false;
    let touchSprint = false;
    let debugInput: Partial<Input> = {};
    let simulationPaused = false;
    let status: HudState['status'] = 'ready';
    let position = level.spawn.clone();
    let health = 100;
    let ammo = 12;
    let reserve = 96;
    let reloadTime = 0;
    let shotTime = 0;
    let elapsed = 0;
    let stage = 0;
    let ledger = false;
    let yaw = 0;
    let pitch = 0.06;
    let shoulder = 1;
    let cameraDistance = 2.8;
    let mapVisible = false;
    let footsteps = 0;
    let noiseTime = 0;
    let triggerHeld = false;
    let uiClock = 0;
    let prompt = '';
    const tracers: { entity: Entity; remaining: number }[] = [];
    const enemies: Enemy[] = [];
    const enemyDefinitions: [string, number, number, number, [number, number, number, number]][] = [
        ['lobby-guard', -3.8, 0, 9, [-7, 4, 7.5, 12.5]],
        ['corridor-guard', -0.8, 3.4, -7.2, [-3, 3.5, -8.3, -6.1]],
        ['apartment-guard', 10.8, 3.4, -13, [8, 11.5, -13.8, -10.2]],
        ['service-guard', 10.5, 0, -6.5, [9, 11.5, -10, -3.5]]
    ];
    for (const [id, x, y, z, zone] of enemyDefinitions) {
        const actor = createCharacter(app, id, true);
        batchCharacter(actor.root);
        enemies.push({
            id,
            actor,
            position: new Vec3(x, y, z),
            home: new Vec3(x, y, z),
            zone,
            health: 68,
            state: 'patrol',
            alert: 0,
            cooldown: 0,
            stagger: 0,
            patrol: 0,
            windup: 0
        });
    }
    const contactMaterial = new StandardMaterial();
    contactMaterial.diffuse = new Color(0.015, 0.018, 0.016);
    contactMaterial.useLighting = false;
    contactMaterial.opacity = 0.25;
    contactMaterial.blendType = BLEND_NORMAL;
    contactMaterial.depthWrite = false;
    contactMaterial.update();
    const contactShadows = [player, ...enemies.map((enemy) => enemy.actor)].map((actor) => {
        const shadow = new Entity(`${actor.root.name}-contact`);
        shadow.addComponent('render', { type: 'cylinder', material: contactMaterial, castShadows: false });
        shadow.setLocalScale(0.66, 0.002, 0.46);
        shadow.setLocalPosition(0, 0.02, 0);
        actor.root.addChild(shadow);
        return shadow;
    });
    function resize() {
        device.maxPixelRatio = Math.min(
            1,
            (performanceMode ? 270 : 900) / window.innerHeight,
            (performanceMode ? 480 : 1600) / window.innerWidth
        );
        app.resizeCanvas();
        app.renderNextFrame = true;
    }
    const softwareLighting = createSoftwareLighting(app);
    function configureQuality() {
        frame.enabled = !performanceMode;
        moon.light!.castShadows = !performanceMode;
        moon.enabled = !performanceMode;
        for (const light of practicals) light.enabled = !performanceMode;
        for (const shadow of contactShadows) shadow.enabled = performanceMode;
        canvas.style.imageRendering = performanceMode ? 'pixelated' : 'auto';
        softwareLighting(performanceMode);
        resize();
    }
    const tracerMaterial = new StandardMaterial();
    tracerMaterial.diffuse = new Color(1, 0.7, 0.32);
    tracerMaterial.emissive = new Color(1, 0.58, 0.18);
    tracerMaterial.useLighting = false;
    tracerMaterial.update();
    const targetMaterial = new StandardMaterial();
    targetMaterial.emissive = new Color(0.5, 0.65, 0.36);
    targetMaterial.diffuse = new Color(0.25, 0.5, 0.26);
    targetMaterial.update();
    const objective = new Entity('ledger-interaction-marker');
    objective.addComponent('render', { type: 'box', material: targetMaterial });
    objective.setLocalScale(0.24, 0.06, 0.32);
    objective.setPosition(level.ledger);
    app.root.addChild(objective);
    configureQuality();

    const hud = new Hud({
        start: () => start(true),
        retry: () => {
            reset();
            start(true);
        },
        resume: () => start(true)
    });
    function requestCapture() {
        const request = canvas.requestPointerLock();
        if (request)
            void request.catch(() => hud.notify('Mouse capture unavailable. Use arrow keys to look, F to fire.'));
    }
    function start(capture = false) {
        if (status === 'failed' || status === 'complete') reset();
        status = 'playing';
        app.autoRender = !simulationPaused;
        app.renderNextFrame = true;
        if (capture) {
            audio.enable();
            requestCapture();
        }
        updateHud();
    }
    function pause() {
        if (status !== 'playing') return;
        status = 'paused';
        app.autoRender = false;
        app.renderNextFrame = true;
        mapVisible = false;
        hud.setMap(false);
        clearInput();
        if (document.pointerLockElement) document.exitPointerLock();
        updateHud();
    }
    function clearInput() {
        keys.clear();
        mouseShoot = false;
        mouseAim = false;
        touchForward = 0;
        touchRight = 0;
        touchShoot = false;
        touchAim = false;
        touchSprint = false;
        triggerHeld = false;
        debugInput = {};
    }
    function reset() {
        status = 'ready';
        app.autoRender = false;
        app.renderNextFrame = true;
        if (document.pointerLockElement) document.exitPointerLock();
        clearInput();
        position = level.spawn.clone();
        health = 100;
        ammo = 12;
        reserve = 96;
        reloadTime = 0;
        shotTime = 0;
        elapsed = 0;
        stage = 0;
        ledger = false;
        yaw = 0;
        pitch = 0.06;
        shoulder = 1;
        footsteps = 0;
        noiseTime = 0;
        cameraDistance = 2.8;
        uiClock = 0;
        mapVisible = false;
        hud.setMap(false);
        objective.enabled = true;
        player.reset();
        for (const enemy of enemies) {
            enemy.position.copy(enemy.home);
            enemy.health = 68;
            enemy.state = 'patrol';
            enemy.alert = 0;
            enemy.cooldown = 0;
            enemy.stagger = 0;
            enemy.patrol = 0;
            enemy.windup = 0;
            enemy.actor.reset();
            enemy.actor.root.setPosition(enemy.position);
            enemy.actor.root.setEulerAngles(0, 180, 0);
        }
        for (const door of level.doors) {
            door.open = false;
            door.entity.enabled = true;
        }
        for (const tracer of tracers) tracer.entity.destroy();
        tracers.length = 0;
        player.root.setPosition(position);
        updateCamera(1, false);
        updateHud();
    }
    function input(): Input {
        return {
            forward: touchForward || Number(keys.has('KeyW')) - Number(keys.has('KeyS')),
            right: touchRight || Number(keys.has('KeyD')) - Number(keys.has('KeyA')),
            shoot: touchShoot || mouseShoot || keys.has('KeyF'),
            aim: touchAim || mouseAim,
            sprint: touchSprint || keys.has('ShiftLeft') || keys.has('ShiftRight'),
            ...debugInput
        };
    }
    function hostiles() {
        return enemies.filter((enemy) => enemy.health > 0).length;
    }
    function location() {
        if (position.z > 16) return 'SOUTH APPROACH';
        if (position.z < -16) return 'NORTH SERVICE YARD';
        if (Math.abs(position.x + 6) < 2 && position.z > -5.2 && position.z < 5.3) return 'STAIR A';
        if (Math.abs(position.x - 6) < 2 && position.z > -5.2 && position.z < 5.3) return 'STAIR B';
        if (position.y > 3) return position.z < -9 ? 'LEVEL 2 / APARTMENT 204' : 'LEVEL 2 / RESIDENTIAL';
        return position.z < 5 ? 'GROUND / SERVICE HALL' : 'GROUND / SOUTH LOBBY';
    }
    function objectiveText() {
        if (stage === 0) return 'Enter Morrow Two through the south lobby';
        if (stage === 1) return 'Take Stair A to Level 2';
        if (stage === 2) return 'Recover the ledger from Apartment 204';
        if (stage === 3) return 'Descend Stair B to the ground floor';
        if (stage === 4)
            return hostiles()
                ? `Clear the crew • ${hostiles()} remaining. Reach the north exit`
                : 'Leave through the north service exit';
        return 'Ledger secured. Morrow Two cleared.';
    }
    function nearbyDoor() {
        return level.doors.find((door) => {
            const centre = door.box.min.clone().add(door.box.max).mulScalar(0.5);
            return (
                Math.abs(position.y + 0.9 - centre.y) < 1.2 &&
                Math.hypot(position.x - centre.x, position.z - centre.z) < 2.25
            );
        });
    }
    function interact() {
        if (status !== 'playing') return;
        if (
            !ledger &&
            position.distance(level.ledger) < 2 &&
            world.visible(position.clone().add(new Vec3(0, 1.2, 0)), level.ledger.clone().add(new Vec3(0, 0.1, 0)))
        ) {
            if (stage < 2) {
                hud.notify('Use Stair A to establish the route first.');
                return;
            }
            ledger = true;
            stage = 3;
            objective.enabled = false;
            audio.interact();
            hud.notify('Ledger secured. Stair B leads back down.');
        } else {
            const door = nearbyDoor();
            if (door) {
                if (
                    door.open &&
                    [position, ...enemies.filter((e) => e.health > 0).map((e) => e.position)].some(
                        (p) =>
                            p.x > door.box.min.x - 0.4 &&
                            p.x < door.box.max.x + 0.4 &&
                            p.z > door.box.min.z - 0.4 &&
                            p.z < door.box.max.z + 0.4 &&
                            Math.abs(p.y - door.box.min.y) < 1
                    )
                ) {
                    hud.notify('Step clear of the doorway to close it.');
                    return;
                }
                door.open = !door.open;
                door.entity.enabled = !door.open;
                audio.interact();
            }
        }
        updateHud();
    }
    function reload() {
        if (status !== 'playing' || reloadTime > 0 || ammo === 12 || reserve === 0) return;
        reloadTime = 1.25;
        audio.reload();
        updateHud();
    }
    function hurt(amount: number) {
        if (status !== 'playing') return;
        health = Math.max(0, health - amount);
        hud.flashDamage();
        audio.hurt();
        if (health === 0) {
            status = 'failed';
            app.autoRender = false;
            app.renderNextFrame = true;
            clearInput();
            player.setDead();
            if (document.pointerLockElement) document.exitPointerLock();
        }
        updateHud();
    }
    function tracer(from: Vec3, to: Vec3) {
        const entity = new Entity('shot-tracer');
        entity.addComponent('render', { type: 'box', material: tracerMaterial, castShadows: false });
        entity.setPosition(from.clone().add(to).mulScalar(0.5));
        entity.lookAt(to);
        entity.setLocalScale(0.017, 0.017, Math.max(0.03, from.distance(to)));
        app.root.addChild(entity);
        tracers.push({ entity, remaining: 0.055 });
    }
    function fire(aiming: boolean) {
        if (shotTime > 0 || reloadTime > 0) return;
        if (!ammo) {
            if (!triggerHeld) {
                hud.notify('Magazine empty • R to reload');
                audio.reload();
            }
            return;
        }
        ammo--;
        shotTime = 0.23;
        noiseTime = 1.6;
        audio.shot();
        const origin = camera.getPosition().clone();
        const direction = camera.forward.clone();
        // Small assistance cone remains constrained by solid-world line of sight.
        if (aiming) {
            let nearestAngle = 0.004;
            for (const enemy of enemies) {
                if (enemy.health <= 0) continue;
                const target = enemy.position.clone().add(new Vec3(0, 1.2, 0));
                const toward = target.clone().sub(origin).normalize();
                const angle = 1 - toward.dot(direction);
                if (angle < nearestAngle && world.visible(origin, target)) {
                    nearestAngle = angle;
                    direction.copy(toward);
                }
            }
        }
        let distance = world.ray(origin, direction, 55);
        let victim: Enemy | null = null;
        for (const enemy of enemies) {
            if (enemy.health <= 0) continue;
            const box = {
                name: enemy.id,
                min: enemy.position.clone().add(new Vec3(-0.4, 0.22, -0.4)),
                max: enemy.position.clone().add(new Vec3(0.4, 1.8, 0.4))
            };
            const hit = rayBox(origin, direction, box, distance);
            if (hit !== null) {
                distance = hit;
                victim = enemy;
            }
        }
        let target = origin.clone().add(direction.clone().mulScalar(distance));
        const muzzle = player.muzzle.getPosition().clone();
        const muzzleRay = target.clone().sub(muzzle);
        const muzzleLength = muzzleRay.length();
        muzzleRay.normalize();
        const muzzleHit = world.ray(muzzle, muzzleRay, muzzleLength);
        if (muzzleHit < muzzleLength - 0.08) {
            victim = null;
            target = muzzle.add(muzzleRay.mulScalar(muzzleHit));
        }
        if (victim) {
            victim.health = Math.max(0, victim.health - 34);
            victim.stagger = 0.42;
            victim.alert = 6;
            victim.state = victim.health ? 'staggered' : 'dead';
            hud.hit(victim.health === 0);
            if (!victim.health) victim.actor.setDead();
        }
        tracer(player.muzzle.getPosition().clone(), target);
        pitch = Math.max(-0.55, pitch - 0.008);
        updateHud();
    }
    function updateEnemy(enemy: Enemy, dt: number) {
        if (enemy.health <= 0) return;
        enemy.cooldown = Math.max(0, enemy.cooldown - dt);
        enemy.stagger = Math.max(0, enemy.stagger - dt);
        enemy.alert = Math.max(0, enemy.alert - dt);
        const eye = enemy.position.clone().add(new Vec3(0, 1.4, 0));
        const target = position.clone().add(new Vec3(0, 1.1, 0));
        const distance = eye.distance(target);
        const vertical = Math.abs(enemy.position.y - position.y);
        const toPlayer = target.clone().sub(eye).normalize();
        const facing = enemy.actor.root.forward.dot(toPlayer);
        const seen =
            distance < 18 &&
            vertical < 2.2 &&
            (enemy.alert > 0 || facing > -0.2 || distance < 5) &&
            world.visible(eye, target);
        if (seen || (noiseTime > 0 && distance < 15 && vertical < 2)) enemy.alert = 5;
        let moved = 0;
        if (enemy.stagger > 0) {
            enemy.state = 'staggered';
            enemy.windup = 0;
        } else if (seen) {
            enemy.state = 'aiming';
            const angle = Math.atan2(position.x - enemy.position.x, -(position.z - enemy.position.z));
            enemy.actor.root.setEulerAngles(0, (-angle * 180) / Math.PI, 0);
            if (distance > 8) {
                const dx = toPlayer.x * dt * 1.15;
                const dz = toPlayer.z * dt * 1.15;
                if (inZone(enemy, enemy.position.x + dx, enemy.position.z + dz))
                    moved = world.move(enemy.position, dx, dz, 0.28);
            }
            enemy.windup += dt;
            if (enemy.cooldown === 0 && enemy.windup > 0.95) {
                enemy.state = 'firing';
                enemy.cooldown = 1.45;
                enemy.windup = 0;
                audio.shot(true);
                tracer(enemy.actor.muzzle.getPosition().clone(), target);
                if (world.visible(eye, target)) hurt(input().sprint ? 7 : 12);
            }
        } else {
            enemy.windup = 0;
            enemy.state = enemy.alert > 0 ? 'searching' : 'patrol';
            enemy.patrol += dt;
            const waypoint = enemy.home
                .clone()
                .add(new Vec3(Math.sin(enemy.patrol * 0.34) * 1.1, 0, Math.sin(enemy.patrol * 0.22) * 0.55));
            const delta = waypoint.sub(enemy.position);
            if (
                delta.length() > 0.12 &&
                inZone(enemy, enemy.position.x + delta.x * dt, enemy.position.z + delta.z * dt)
            ) {
                const angle = Math.atan2(delta.x, -delta.z);
                enemy.actor.root.setEulerAngles(0, (-angle * 180) / Math.PI, 0);
                delta.normalize().mulScalar(dt * 0.5);
                moved = world.move(enemy.position, delta.x, delta.z, 0.28);
            }
        }
        enemy.actor.root.setPosition(enemy.position);
        enemy.actor.animate(dt, moved / dt, seen);
    }
    function inZone(enemy: Enemy, x: number, z: number) {
        return x >= enemy.zone[0] && x <= enemy.zone[1] && z >= enemy.zone[2] && z <= enemy.zone[3];
    }
    function updateRoute() {
        if (stage === 0 && position.z < 14 && position.z > 5 && Math.abs(position.x) < 8 && position.y < 0.5) {
            stage = 1;
            hud.notify('Elevators out. Stair A is west of the core.');
        }
        if (stage === 1 && position.x < -4 && position.y > 3.1 && position.z < -5) {
            stage = 2;
            hud.notify('Level 2. Apartment 204 is across the north corridor.');
        }
        if (stage === 3 && position.x > 4 && position.x < 8 && position.y < 0.3 && position.z > 4.5 && position.z < 7) {
            stage = 4;
            hud.notify('Head east around the stairwell, then north to the service exit.');
        }
        if (position.distance(level.exit) < 2.6 && stage === 4 && ledger && hostiles() === 0) {
            stage = 5;
            status = 'complete';
            app.autoRender = false;
            app.renderNextFrame = true;
            clearInput();
            audio.complete();
            if (document.pointerLockElement) document.exitPointerLock();
        }
    }
    function updateCamera(dt: number, aiming: boolean) {
        const pivot = position.clone().add(new Vec3(0, 1.45, 0));
        const direction = new Vec3(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
        const right = new Vec3(Math.cos(yaw), 0, Math.sin(yaw));
        const boom = direction
            .clone()
            .mulScalar(aiming ? -1.65 : -2.85)
            .add(right.mulScalar(shoulder * (aiming ? 0.42 : 0.48)));
        const desired = boom.length();
        boom.normalize();
        const allowed = Math.max(0.12, world.ray(pivot, boom, desired, 0.18) - 0.06);
        cameraDistance = allowed < cameraDistance ? allowed : Math.min(allowed, cameraDistance + dt * 5);
        camera.setPosition(pivot.clone().add(boom.mulScalar(cameraDistance)));
        camera.lookAt(pivot.clone().add(direction.mulScalar(30)));
        camera.camera!.fov = aiming ? 56 : 65;
        if (status !== 'failed') player.root.enabled = cameraDistance > 0.65;
    }
    function updateHud() {
        const door = nearbyDoor();
        prompt =
            !ledger && position.distance(level.ledger) < 2
                ? '[E] Recover ledger'
                : door
                  ? `[E] ${door.open ? 'Close' : 'Open'} ${door.id === 'apartment204' ? 'Apartment 204' : door.id.replaceAll('-', ' ')}`
                  : '';
        if (position.distance(level.exit) < 3 && stage < 4)
            prompt = 'Recover the ledger and complete the stair route first';
        if (position.distance(level.exit) < 3 && stage === 4 && hostiles())
            prompt = 'The crew is still active • clear remaining hostiles';
        hud.update({
            status,
            health,
            ammo,
            reserve,
            reloading: reloadTime > 0,
            objective: objectiveText(),
            stage,
            hostiles: hostiles(),
            prompt,
            location: location(),
            elapsed,
            position,
            heading: (yaw * 180) / Math.PI
        });
    }
    function tick(dt: number) {
        if (status !== 'playing') return;
        dt = Math.min(0.05, Math.max(0.001, dt));
        elapsed += dt;
        const controls = input();
        shotTime = Math.max(0, shotTime - dt);
        noiseTime = Math.max(0, noiseTime - dt);
        if (reloadTime > 0) {
            reloadTime = Math.max(0, reloadTime - dt);
            if (reloadTime === 0) {
                const loaded = Math.min(12 - ammo, reserve);
                ammo += loaded;
                reserve -= loaded;
                audio.reload();
            }
        }
        yaw += (Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'))) * dt * 1.9;
        pitch = Math.max(
            -0.55,
            Math.min(0.8, pitch + (Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp'))) * dt * 1.2)
        );
        let forward = controls.forward;
        let right = controls.right;
        const magnitude = Math.hypot(forward, right);
        if (magnitude > 1) {
            forward /= magnitude;
            right /= magnitude;
        }
        const speed = controls.aim ? 2.25 : controls.sprint ? 5.3 : 3.65;
        const moved = world.move(
            position,
            (Math.sin(yaw) * forward + Math.cos(yaw) * right) * speed * dt,
            (-Math.cos(yaw) * forward + Math.sin(yaw) * right) * speed * dt
        );
        player.root.setPosition(position);
        if (moved > 0.001 || controls.aim || controls.shoot) {
            const heading = controls.aim || controls.shoot ? yaw : yaw + Math.atan2(right, forward);
            player.root.setEulerAngles(0, (-heading * 180) / Math.PI, 0);
        }
        player.animate(dt, moved / dt, controls.aim || controls.shoot);
        footsteps += moved;
        if (footsteps > 1.6) {
            footsteps = 0;
            audio.footstep();
        }
        updateCamera(dt, controls.aim);
        if (controls.shoot) fire(controls.aim);
        triggerHeld = controls.shoot;
        for (const enemy of enemies) {
            if (status === 'playing') updateEnemy(enemy, dt);
        }
        for (let i = tracers.length - 1; i >= 0; i--) {
            tracers[i].remaining -= dt;
            if (tracers[i].remaining <= 0) {
                tracers[i].entity.destroy();
                tracers.splice(i, 1);
            }
        }
        updateRoute();
        uiClock += dt;
        if (uiClock > 0.06 || status !== 'playing') {
            uiClock = 0;
            updateHud();
        }
    }
    const abort = new AbortController();
    const eventOptions = { signal: abort.signal };
    let lastPointerType = 'mouse';
    let lookPointerId: number | null = null;
    let lookX = 0;
    let lookY = 0;

    function wireTouchControls() {
        const stick = document.querySelector<HTMLElement>('[data-testid="touch-stick"]');
        const knob = stick?.querySelector<HTMLElement>('span');
        const setStick = (event: PointerEvent) => {
            if (!stick || !knob) return;
            const bounds = stick.getBoundingClientRect();
            const radius = bounds.width * 0.34;
            const dx = event.clientX - (bounds.left + bounds.width / 2);
            const dy = event.clientY - (bounds.top + bounds.height / 2);
            const length = Math.hypot(dx, dy);
            const scale = length > radius ? radius / length : 1;
            const x = dx * scale;
            const y = dy * scale;
            touchRight = x / radius;
            touchForward = -y / radius;
            knob.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        };
        const clearStick = () => {
            touchForward = 0;
            touchRight = 0;
            if (knob) knob.style.transform = 'translate3d(0, 0, 0)';
        };
        stick?.addEventListener(
            'pointerdown',
            (event) => {
                event.preventDefault();
                try {
                    stick.setPointerCapture(event.pointerId);
                } catch {
                    /* synthetic mobile test events */
                }
                setStick(event);
            },
            eventOptions
        );
        stick?.addEventListener(
            'pointermove',
            (event) => {
                if (stick.hasPointerCapture(event.pointerId)) setStick(event);
            },
            eventOptions
        );
        stick?.addEventListener('pointerup', clearStick, eventOptions);
        stick?.addEventListener('pointercancel', clearStick, eventOptions);

        const hold = (selector: string, setter: (value: boolean) => void) => {
            const button = document.querySelector<HTMLElement>(selector);
            button?.addEventListener(
                'pointerdown',
                (event) => {
                    event.preventDefault();
                    try {
                        button.setPointerCapture(event.pointerId);
                    } catch {
                        /* synthetic mobile test events */
                    }
                    setter(true);
                    button.classList.add('active');
                },
                eventOptions
            );
            const release = () => {
                setter(false);
                button?.classList.remove('active');
            };
            button?.addEventListener('pointerup', release, eventOptions);
            button?.addEventListener('pointercancel', release, eventOptions);
        };
        hold('[data-testid="touch-fire"]', (value) => {
            touchShoot = value;
        });
        hold('[data-testid="touch-aim"]', (value) => {
            touchAim = value;
        });
        const press = (selector: string, action: () => void) => {
            document.querySelector<HTMLElement>(selector)?.addEventListener(
                'pointerup',
                (event) => {
                    event.preventDefault();
                    action();
                },
                eventOptions
            );
        };
        press('[data-testid="touch-interact"]', interact);
        press('[data-testid="touch-reload"]', reload);
        press('[data-testid="touch-map"]', () => {
            if (status !== 'playing') return;
            mapVisible = !mapVisible;
            hud.setMap(mapVisible);
            app.renderNextFrame = true;
        });
        press('[data-testid="touch-pause"]', pause);

        canvas.addEventListener(
            'pointerdown',
            (event) => {
                lastPointerType = event.pointerType;
                if (event.pointerType !== 'touch' || status !== 'playing') return;
                lookPointerId = event.pointerId;
                lookX = event.clientX;
                lookY = event.clientY;
                try {
                    canvas.setPointerCapture(event.pointerId);
                } catch {
                    /* synthetic mobile test events */
                }
            },
            eventOptions
        );
        canvas.addEventListener(
            'pointermove',
            (event) => {
                if (event.pointerId !== lookPointerId || event.pointerType !== 'touch') return;
                yaw += (event.clientX - lookX) * 0.006;
                pitch = Math.max(-0.55, Math.min(0.8, pitch + (event.clientY - lookY) * 0.004));
                lookX = event.clientX;
                lookY = event.clientY;
            },
            eventOptions
        );
        const endLook = (event: PointerEvent) => {
            if (event.pointerId === lookPointerId) lookPointerId = null;
        };
        canvas.addEventListener('pointerup', endLook, eventOptions);
        canvas.addEventListener('pointercancel', endLook, eventOptions);
    }
    wireTouchControls();
    window.addEventListener(
        'keydown',
        (event) => {
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code))
                event.preventDefault();
            if (event.repeat) return;
            if (event.code === 'Escape') {
                pause();
                return;
            }
            if (event.code === 'Enter') {
                if (status === 'failed' || status === 'complete') {
                    reset();
                    start(true);
                } else if (status !== 'playing') start(true);
                return;
            }
            keys.add(event.code);
            if (status !== 'playing') return;
            if (event.code === 'KeyE') interact();
            if (event.code === 'KeyR') reload();
            if (event.code === 'KeyQ') shoulder *= -1;
            if (event.code === 'KeyP') {
                performanceMode = !performanceMode;
                configureQuality();
                hud.notify(performanceMode ? 'Performance visuals • P to switch' : 'Full visuals • P to switch');
            }
            if (event.code === 'KeyM') {
                mapVisible = !mapVisible;
                hud.setMap(mapVisible);
            }
        },
        eventOptions
    );
    window.addEventListener('keyup', (event) => keys.delete(event.code), eventOptions);
    canvas.addEventListener(
        'click',
        () => {
            if (status === 'playing' && lastPointerType !== 'touch' && !document.pointerLockElement) requestCapture();
        },
        eventOptions
    );
    canvas.addEventListener(
        'mousedown',
        (event) => {
            if (status !== 'playing') return;
            if (event.button === 0 && document.pointerLockElement) mouseShoot = true;
            if (event.button === 2) mouseAim = true;
        },
        eventOptions
    );
    window.addEventListener(
        'mouseup',
        (event) => {
            if (event.button === 0) mouseShoot = false;
            if (event.button === 2) mouseAim = false;
        },
        eventOptions
    );
    canvas.addEventListener('contextmenu', (event) => event.preventDefault(), eventOptions);
    window.addEventListener(
        'mousemove',
        (event) => {
            if (status !== 'playing' || document.pointerLockElement !== canvas) return;
            yaw += event.movementX * 0.0022;
            pitch = Math.max(-0.55, Math.min(0.8, pitch + event.movementY * 0.0018));
        },
        eventOptions
    );
    document.addEventListener(
        'pointerlockchange',
        () => {
            if (!document.pointerLockElement && status === 'playing') pause();
        },
        eventOptions
    );
    window.addEventListener('blur', pause, eventOptions);
    document.addEventListener(
        'visibilitychange',
        () => {
            if (document.hidden) pause();
        },
        eventOptions
    );
    window.addEventListener('resize', resize, eventOptions);
    const onUpdate = (dt: number) => {
        if (!simulationPaused) tick(dt);
    };
    app.on('update', onUpdate);
    reset();
    if (import.meta.env.DEV) {
        const snapshot = () => ({
            status,
            health,
            ammo,
            reserve,
            stage,
            ledger,
            elapsed,
            reloadTime,
            position: { x: position.x, y: position.y, z: position.z },
            yaw,
            pitch,
            location: location(),
            enemies: enemies.map((enemy) => ({
                id: enemy.id,
                health: enemy.health,
                state: enemy.state,
                position: { x: enemy.position.x, y: enemy.position.y, z: enemy.position.z },
                windup: enemy.windup
            })),
            doors: level.doors.map((door) => ({ id: door.id, open: door.open, min: door.box.min, max: door.box.max })),
            camera: { position: camera.getPosition().clone(), clearance: cameraDistance },
            render: {
                renderer,
                performanceMode,
                width: canvas.width,
                height: canvas.height,
                ratio: device.maxPixelRatio,
                drawCalls: app.stats.drawCalls.total
            },
            geometry: { colliders: level.colliders.length, surfaces: level.surfaces.length }
        });
        Object.assign(window, {
            __morrow: {
                snapshot,
                quality: (low: boolean) => {
                    performanceMode = low;
                    configureQuality();
                },
                pauseSimulation: (value: boolean) => {
                    simulationPaused = value;
                    app.autoRender = status === 'playing' && !value;
                    app.renderNextFrame = true;
                },
                teleport: (x: number, y: number, z: number) => {
                    position.set(x, y, z);
                    player.root.setPosition(position);
                    updateCamera(1, input().aim);
                    updateHud();
                    app.renderNextFrame = true;
                },
                look: (angle: number, tilt = 0) => {
                    yaw = angle;
                    pitch = tilt;
                    updateCamera(1, input().aim);
                    app.renderNextFrame = true;
                },
                setInput: (value: Partial<Input>) => {
                    debugInput = { forward: 0, right: 0, shoot: false, aim: false, sprint: false, ...value };
                },
                step: (dt = 1 / 60, frames = 1) => {
                    for (let i = 0; i < frames; i++) tick(dt);
                    updateHud();
                    app.renderNextFrame = true;
                    return snapshot();
                },
                interact,
                reload,
                start: () => start(false),
                retry: () => {
                    reset();
                    start(false);
                },
                damage: hurt,
                visible: (a: [number, number, number], b: [number, number, number]) =>
                    world.visible(new Vec3(...a), new Vec3(...b))
            }
        });
    }
    if (import.meta.hot)
        import.meta.hot.dispose(() => {
            abort.abort();
            app.off('update', onUpdate);
            audio.destroy();
            frame.destroy();
            app.destroy();
            document.querySelectorAll('.morrow-ui').forEach((element) => element.remove());
        });
}

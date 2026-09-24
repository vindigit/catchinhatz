export type HudState = {
    status: 'ready' | 'playing' | 'paused' | 'failed' | 'complete';
    health: number;
    ammo: number;
    reserve: number;
    reloading: boolean;
    objective: string;
    stage: number;
    hostiles: number;
    prompt: string;
    location: string;
    elapsed: number;
    position: { x: number; y: number; z: number };
    heading: number;
};

type HudCallbacks = { start: () => void; retry: () => void; resume: () => void };

const routeLabels = ['South lobby', 'Stair A', 'Apartment 204', 'Stair B', 'Service exit'];
const controls = `<span><kbd>W A S D</kbd> Move</span><span><kbd>MOUSE</kbd> Look</span><span><kbd>LMB / F</kbd> Fire</span><span><kbd>RMB</kbd> Aim</span><span><kbd>R</kbd> Reload</span><span><kbd>E</kbd> Interact</span><span><kbd>SHIFT</kbd> Sprint</span><span><kbd>Q</kbd> Shoulder</span><span><kbd>M</kbd> Route map</span><span><kbd>P</kbd> Visual quality</span><span><kbd>ESC</kbd> Pause</span>`;

/** DOM view only. Encounter progression and input remain owned by the game. */
export class Hud {
    private readonly root: HTMLDivElement;
    private readonly elements: Record<string, HTMLElement> = {};
    private lastStatus = '';
    private lastStage = -1;
    private damageTimer = 0;
    private hitTimer = 0;
    private toastTimer = 0;
    private mapVisible = false;

    constructor(callbacks: HudCallbacks) {
        this.root = document.createElement('div');
        this.root.className = 'morrow-ui';
        this.root.dataset.status = 'ready';
        this.root.innerHTML = `
            <div class="film-grain" aria-hidden="true"></div>
            <div class="damage-flash" data-ui="damage" aria-hidden="true"></div>
            <section class="play-hud" data-ui="play-hud" aria-label="Encounter status">
                <header class="mission-panel">
                    <div class="micro-label"><span class="live-dot"></span> MORROW TWO <span class="mission-divider">/</span> <span data-ui="location">SOUTH APPROACH</span></div>
                    <div class="objective" data-ui="objective" data-testid="objective">Enter the south lobby.</div>
                    <div class="route-progress" data-ui="route">${routeLabels.map((label, index) => `<span data-stage="${index}" title="${label}"></span>`).join('')}<b data-ui="stage-name">01 / SOUTH LOBBY</b></div>
                </header>
                <aside class="district-panel"><span>BELL WARD</span><b>00:47</b><small>CALDER · NORTH ↑</small></aside>
                <div class="reticle" data-ui="reticle" data-testid="crosshair" aria-hidden="true"><i></i><i></i><i></i><i></i><b></b></div>
                <div class="hit-marker" data-ui="hit" aria-hidden="true">×</div>
                <div class="interaction" data-ui="prompt" data-testid="interaction-prompt" role="status"></div>
                <div class="notification" data-ui="notification" role="status"></div>
                <footer class="vitals">
                    <div class="micro-label">CONDITION <strong data-ui="health" data-testid="health">100</strong></div>
                    <div class="health-track"><span data-ui="health-bar"></span></div>
                    <div class="vitals-meta"><span data-ui="hostiles" data-testid="hostiles">4 HOSTILES</span><span data-ui="timer">00:00</span></div>
                </footer>
                <div class="weapon-panel"><div class="micro-label" data-ui="weapon-state">9MM / SEMI-AUTO</div><div class="ammo"><strong data-ui="ammo" data-testid="ammo">12</strong><span>/</span><span data-ui="reserve">72</span></div><div class="ammo-caption" data-ui="reload">R RELOAD</div></div>
                <div class="bottom-controls"><span><kbd>M</kbd> MAP</span><span><kbd>E</kbd> INTERACT</span><span><kbd>ESC</kbd> PAUSE</span></div>
                <div class="mobile-controls" data-ui="mobile-controls" aria-label="Touch controls">
                    <div class="touch-stick" data-ui="touch-stick" data-testid="touch-stick"><span></span></div>
                    <div class="touch-actions">
                        <button class="touch-button touch-map" data-ui="touch-map" data-testid="touch-map" type="button">MAP</button>
                        <button class="touch-button touch-pause" data-ui="touch-pause" data-testid="touch-pause" type="button">Ⅱ</button>
                        <button class="touch-button touch-reload" data-ui="touch-reload" data-testid="touch-reload" type="button">R</button>
                        <button class="touch-button touch-interact" data-ui="touch-interact" data-testid="touch-interact" type="button">E</button>
                        <button class="touch-button touch-aim" data-ui="touch-aim" data-testid="touch-aim" type="button">AIM</button>
                        <button class="touch-button touch-fire" data-ui="touch-fire" data-testid="touch-fire" type="button">FIRE</button>
                    </div>
                    <div class="touch-look-hint" data-ui="touch-look-hint">DRAG RIGHT SIDE TO LOOK</div>
                </div>
            </section>
            <section class="menu-screen" data-ui="menu" data-testid="game-menu" aria-label="Encounter menu">
                <div class="menu-top"><span>BELL WARD <i> / </i> CALDER</span><span>RESIDENTIAL CLEARANCE <i> / </i> 01</span></div>
                <div class="menu-content">
                    <div class="eyebrow" data-ui="menu-eyebrow">MORROW EXTENSION · 00:47</div>
                    <h1 data-ui="menu-title">MORROW<span>TWO<span class="title-period">.</span></span></h1>
                    <div class="menu-rule"></div>
                    <div class="menu-subtitle" data-ui="menu-subtitle">THIRTEEN FLOORS. ONE WAY THROUGH.</div>
                    <p class="menu-description" data-ui="menu-description">Recover the ledger in Apartment 204. Clear the crew. Leave through the north service exit.</p>
                    <div class="menu-stats" data-ui="menu-stats"></div>
                    <button class="primary-action" data-ui="start" data-testid="start-game">ENTER MORROW TWO <span>↗</span></button>
                    <button class="primary-action" data-ui="resume" data-testid="resume-game" hidden>RESUME ENCOUNTER <span>↗</span></button>
                    <button class="primary-action" data-ui="retry" data-testid="retry-game" hidden>RETRY ENCOUNTER <span>↗</span></button>
                    <p class="menu-hint" data-ui="menu-hint">Click to enter · Headphones recommended</p>
                </div>
                <div class="menu-route"><div class="micro-label">THE ROUTE <span>01 — 05</span></div><ol>${routeLabels.map((label, index) => `<li><span>0${index + 1}</span>${label}</li>`).join('')}</ol></div>
                <div class="menu-controls">${controls}<small>Arrow keys also look. Click the game to capture the mouse. Enter resumes.</small></div>
                <div class="menu-bottom"><span>FIRST PLAYABLE ENCOUNTER</span><span>SOUTH ENTRANCE <i>→</i> NORTH SERVICE EXIT</span></div>
            </section>
            <aside class="route-map" data-ui="map" data-testid="route-map" hidden>
                <header><div><div class="micro-label">MORROW TWO</div><h2 data-ui="map-title">GROUND FLOOR</h2></div><span><kbd>M</kbd> CLOSE</span></header>
                <svg viewBox="0 0 300 390" role="img" aria-label="Conceptual route map. North service exit is above the tower, south entrance below. Stair A is west of the central elevator core, Stair B east.">
                    <defs><pattern id="map-grid" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M14 0H0V14" fill="none" stroke="#b4b6a3" stroke-opacity=".07"/></pattern><pattern id="map-core" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6L6 0" stroke="#d2c8ae" stroke-opacity=".2"/></pattern></defs>
                    <rect x="0" y="0" width="300" height="390" fill="url(#map-grid)"/>
                    <path d="M258 45V18m-5 8 5-8 5 8" stroke="#d4cbb3" fill="none"/><text x="258" y="12" text-anchor="middle" class="map-label">N</text>
                    <path d="M73 63H227V91H255V259H227V287H73V259H45V91H73Z" fill="#323b39" stroke="#acb2a0" stroke-width="2"/>
                    <path d="M91 125H209V224H91Z" fill="#6e7565" fill-opacity=".2" stroke="#aab39b" stroke-width="1"/>
                    <rect x="129" y="140" width="42" height="70" fill="url(#map-core)" stroke="#788078"/>
                    <path d="M150 148V201" stroke="#788078"/><text x="150" y="171" class="map-tiny" text-anchor="middle">LIFT</text><text x="150" y="183" class="map-tiny" text-anchor="middle">CORE</text>
                    <rect x="94" y="140" width="28" height="70" fill="#88554a" stroke="#d59877"/><path d="M98 150H118m-20 8H118m-20 8H118m-20 8H118m-20 8H118m-20 8H118m-20 8H118" stroke="#bc806a"/><text x="108" y="134" class="map-label" text-anchor="middle">A</text>
                    <rect x="178" y="140" width="28" height="70" fill="#405c63" stroke="#8baab0"/><path d="M182 150H202m-20 8H202m-20 8H202m-20 8H202m-20 8H202m-20 8H202m-20 8H202" stroke="#7c9a9f"/><text x="192" y="134" class="map-label" text-anchor="middle">B</text>
                    <g data-ui="map-apartment"><rect x="164" y="70" width="77" height="42" fill="#7e6941" stroke="#d0ac63"/><path d="M183 112h18" stroke="#e5d8b5" stroke-width="4"/><text x="202" y="93" text-anchor="middle" class="map-label">204</text></g>
                    <g data-ui="map-ground"><text x="150" y="258" text-anchor="middle" class="map-label">LOBBY</text><text x="150" y="95" text-anchor="middle" class="map-tiny">MAIL / SERVICE</text></g>
                    <text x="150" y="323" text-anchor="middle" class="map-label">SOUTH ENTRANCE</text><path d="M142 287h16" stroke="#d4cbb3" stroke-width="4"/>
                    <text x="150" y="35" text-anchor="middle" class="map-label">NORTH / SERVICE</text><path d="M142 63h16" stroke="#d4cbb3" stroke-width="4"/>
                    <circle data-ui="map-target" cx="150" cy="258" r="8" fill="none" stroke="#e6b663" stroke-width="2"/>
                    <g data-ui="map-player" transform="translate(150 322)"><circle r="10" fill="#0c1314" fill-opacity=".7"/><path d="M0-9L6 6 0 3-6 6Z" fill="#ece6cc" stroke="#152222" stroke-width="1.5"/></g>
                    <text x="150" y="365" class="map-tiny" text-anchor="middle">CONCEPTUAL PLAN · NOT TO CONSTRUCTION SCALE</text>
                </svg>
                <footer><span><i class="map-key player-key"></i> YOU</span><span><i class="map-key target-key"></i> OBJECTIVE</span></footer>
            </aside>`;
        document.body.appendChild(this.root);
        for (const element of this.root.querySelectorAll<HTMLElement>('[data-ui]')) {
            this.elements[element.dataset.ui!] = element;
        }
        this.elements.start.addEventListener('click', callbacks.start);
        this.elements.retry.addEventListener('click', callbacks.retry);
        this.elements.resume.addEventListener('click', callbacks.resume);
    }

    update(data: HudState): void {
        const el = this.elements;
        const health = Math.max(0, Math.ceil(data.health));
        el.health.textContent = `${health}`;
        el['health-bar'].style.width = `${Math.min(health, 100)}%`;
        el['health-bar'].classList.toggle('critical', health <= 30);
        el.ammo.textContent = `${data.ammo}`.padStart(2, '0');
        el.reserve.textContent = `${data.reserve}`;
        el['weapon-state'].textContent = data.reloading ? 'CHANGING MAGAZINE' : '9MM / SEMI-AUTO';
        el.reload.textContent = data.reloading ? 'RELOADING…' : data.ammo === 0 ? 'EMPTY · R TO RELOAD' : 'R RELOAD';
        el.reload.classList.toggle('empty', data.ammo === 0);
        el.objective.textContent = data.objective;
        el.location.textContent = data.location.toUpperCase();
        el.hostiles.textContent = `${data.hostiles} HOSTILE${data.hostiles === 1 ? '' : 'S'} REMAINING`;
        el.timer.textContent = this.formatTime(data.elapsed);
        el.prompt.textContent = data.prompt;
        el.prompt.hidden = !data.prompt || data.status !== 'playing';
        if (data.stage !== this.lastStage) {
            this.lastStage = data.stage;
            el['stage-name'].textContent =
                data.stage >= 5
                    ? 'ROUTE COMPLETE'
                    : `0${data.stage + 1} / ${routeLabels[Math.min(data.stage, 4)].toUpperCase()}`;
            for (const segment of el.route.querySelectorAll<HTMLElement>('[data-stage]')) {
                const stage = Number(segment.dataset.stage);
                segment.classList.toggle('done', stage < data.stage);
                segment.classList.toggle('current', stage === data.stage);
            }
        }
        if (this.mapVisible) {
            const upstairs = data.position.y > 1.8;
            el['map-title'].textContent = upstairs ? 'LEVEL 2 / RESIDENTIAL' : 'GROUND FLOOR';
            el['map-apartment'].style.visibility = upstairs ? 'visible' : 'hidden';
            el['map-ground'].style.visibility = upstairs ? 'hidden' : 'visible';
            el['map-player'].setAttribute(
                'transform',
                `translate(${150 + data.position.x * 7} ${175 + data.position.z * 7}) rotate(${data.heading})`
            );
            const targets = [
                [150, 258],
                [108, 175],
                [202, 91],
                [192, 175],
                [150, 49],
                [150, 49]
            ];
            const target = targets[Math.min(5, Math.max(0, data.stage))];
            el['map-target'].setAttribute('cx', `${target[0]}`);
            el['map-target'].setAttribute('cy', `${target[1]}`);
        }
        if (data.status !== this.lastStatus) {
            this.lastStatus = data.status;
            this.root.dataset.status = data.status;
            el.menu.hidden = data.status === 'playing';
            el['play-hud'].hidden = data.status === 'ready';
            el.start.hidden = data.status !== 'ready';
            el.resume.hidden = data.status !== 'paused';
            el.retry.hidden = data.status !== 'failed' && data.status !== 'complete';
            el['menu-stats'].hidden = data.status === 'ready' || data.status === 'paused';
            if (data.status !== 'playing') this.setMap(false);
            const copy = {
                ready: [
                    'MORROW EXTENSION · 00:47',
                    'MORROW<span>TWO<span class="title-period">.</span></span>',
                    'THIRTEEN FLOORS. ONE WAY THROUGH.',
                    'Recover the ledger in Apartment 204. Clear the crew. Leave through the north service exit.',
                    'Click to enter · Headphones recommended'
                ],
                paused: [
                    'ENCOUNTER PAUSED',
                    'HOLD<span>POSITION.</span>',
                    'THE TOWER CAN WAIT.',
                    data.objective,
                    'Enter to resume · Click to capture the mouse'
                ],
                failed: [
                    'SIGNAL LOST',
                    'DOWN<span>IN BELL WARD.</span>',
                    'THE CREW STILL HOLDS MORROW TWO.',
                    'Reload before a push. Aim around doorways and use the stair landings for cover.',
                    'Retry starts a fresh encounter at the south entrance'
                ],
                complete: [
                    'ENCOUNTER COMPLETE',
                    'LEDGER<span>SECURED.</span>',
                    'MORROW TWO IS CLEAR.',
                    'You recovered the ledger, cleared the crew, and reached the north service exit.',
                    'The rest of Bell Ward can wait.'
                ],
                playing: ['', '', '', '', '']
            }[data.status];
            el['menu-eyebrow'].textContent = copy[0];
            el['menu-title'].innerHTML = copy[1];
            el['menu-subtitle'].textContent = copy[2];
            el['menu-description'].textContent = copy[3];
            el['menu-hint'].textContent = copy[4];
            el['menu-stats'].textContent =
                `${this.formatTime(data.elapsed)} ELAPSED   /   ${Math.max(0, 4 - data.hostiles)} OF 4 HOSTILES CLEARED`;
            el.retry.innerHTML = `${data.status === 'complete' ? 'PLAY AGAIN' : 'RETRY ENCOUNTER'} <span>↗</span>`;
        }
    }

    flashDamage(): void {
        clearTimeout(this.damageTimer);
        this.elements.damage.classList.add('active');
        this.damageTimer = window.setTimeout(() => this.elements.damage.classList.remove('active'), 260);
    }

    hit(kill = false): void {
        clearTimeout(this.hitTimer);
        this.elements.hit.classList.add('active');
        this.elements.hit.classList.toggle('kill', kill);
        this.hitTimer = window.setTimeout(() => this.elements.hit.classList.remove('active'), kill ? 280 : 140);
    }

    notify(message: string): void {
        clearTimeout(this.toastTimer);
        this.elements.notification.textContent = message;
        this.elements.notification.classList.add('visible');
        this.toastTimer = window.setTimeout(() => this.elements.notification.classList.remove('visible'), 3000);
    }

    setMap(visible: boolean): void {
        this.mapVisible = visible;
        this.elements.map.hidden = !visible;
    }

    private formatTime(seconds: number): string {
        const time = Math.max(0, Math.floor(seconds));
        return `${Math.floor(time / 60)}`.padStart(2, '0') + ':' + `${time % 60}`.padStart(2, '0');
    }
}

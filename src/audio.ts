/** Original synthesized placeholder effects; no downloaded audio. */
export class EncounterAudio {
    context: AudioContext | null = null;
    master: GainNode | null = null;
    enable() {
        if (!this.context) {
            this.context = new AudioContext();
            this.master = this.context.createGain();
            this.master.gain.value = 0.16;
            this.master.connect(this.context.destination);
        }
        void this.context.resume();
    }
    tone(
        frequency: number,
        duration: number,
        volume: number,
        endFrequency = frequency,
        type: OscillatorType = 'triangle'
    ) {
        const context = this.context;
        if (!context || !this.master) return;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, context.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(10, endFrequency), context.currentTime + duration);
        gain.gain.setValueAtTime(volume, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
        oscillator.connect(gain);
        gain.connect(this.master);
        oscillator.start();
        oscillator.stop(context.currentTime + duration);
        oscillator.onended = () => {
            oscillator.disconnect();
            gain.disconnect();
        };
    }
    shot(enemy = false) {
        this.tone(enemy ? 145 : 195, 0.14, enemy ? 0.8 : 1.6, 35, 'sawtooth');
        this.tone(1900, 0.045, 0.35, 80, 'square');
    }
    footstep() {
        this.tone(95, 0.05, 0.25, 45);
    }
    reload() {
        this.tone(690, 0.07, 0.5, 320, 'square');
    }
    interact() {
        this.tone(540, 0.1, 0.4, 900);
    }
    hurt() {
        this.tone(90, 0.22, 1, 40, 'sawtooth');
    }
    complete() {
        this.tone(440, 0.7, 0.6, 880);
    }
    destroy() {
        void this.context?.close();
    }
}

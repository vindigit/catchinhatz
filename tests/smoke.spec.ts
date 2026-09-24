import { expect, test } from '@playwright/test';

test('Morrow Two opens a rendered encounter and accepts keyboard movement', async ({ page }, testInfo) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as Window & { __morrow?: unknown }).__morrow));
    await expect(page.getByTestId('start-game')).toBeVisible();
    const canvas = page.locator('#application-canvas');
    await expect(canvas).toBeVisible();
    await expect
        .poll(async () =>
            canvas.evaluate((element) => {
                const gameCanvas = element as HTMLCanvasElement;
                return gameCanvas.width > 0 && gameCanvas.height > 0;
            })
        )
        .toBe(true);

    const briefing = await page.screenshot({ path: testInfo.outputPath('briefing.png') });
    await testInfo.attach('briefing', { body: briefing, contentType: 'image/png' });

    const initial = await page.evaluate(() => {
        const debug = (
            window as Window & {
                __morrow: { snapshot(): { position: { z: number } } };
            }
        ).__morrow;
        return debug.snapshot();
    });
    await page.getByTestId('start-game').click();
    await canvas.click();
    const performanceSample = await page.evaluate(async () => {
        const gameCanvas = document.querySelector<HTMLCanvasElement>('#application-canvas')!;
        const gl = gameCanvas.getContext('webgl2')!;
        const rendererExtension = gl.getExtension('WEBGL_debug_renderer_info');
        const renderer = rendererExtension
            ? String(gl.getParameter(rendererExtension.UNMASKED_RENDERER_WEBGL))
            : String(gl.getParameter(gl.RENDERER));
        const intervals: number[] = [];
        await new Promise<void>((resolve) => {
            let previous = 0;
            let began = 0;
            const sample = (now: number) => {
                if (!began) began = now;
                if (previous) intervals.push(now - previous);
                previous = now;
                if (now - began >= 1200) resolve();
                else requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
        });
        const meanFrameMs = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
        const render = (window as Window & { __morrow: { snapshot(): { render: unknown } } }).__morrow.snapshot()
            .render;
        return { renderer, meanFrameMs, framesPerSecond: 1000 / meanFrameMs, samples: intervals.length, render };
    });
    console.log('Morrow render performance', JSON.stringify(performanceSample));
    await testInfo.attach('render-performance', {
        body: JSON.stringify(performanceSample, null, 2),
        contentType: 'application/json'
    });

    await page.keyboard.down('w');
    await page.waitForTimeout(450);
    await page.keyboard.up('w');
    const moved = await page.evaluate(
        () =>
            (window as Window & { __morrow: { snapshot(): { position: { z: number } } } }).__morrow.snapshot().position
                .z
    );
    expect(moved).toBeLessThan(initial.position.z - 0.3);
    await page.keyboard.press('m');
    await expect(page.getByTestId('route-map')).toBeVisible();
    await page.keyboard.press('m');
    await expect(page.getByTestId('route-map')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('resume-game')).toBeVisible();
    await page.getByTestId('resume-game').click();
    await expect(page.getByTestId('resume-game')).toBeHidden();
    const screenshot = await page.screenshot({ path: testInfo.outputPath('south-entrance.png') });
    await testInfo.attach('south-entrance', { body: screenshot, contentType: 'image/png' });

    const originalQuality = await page.evaluate(() => {
        const game = (
            window as Window & {
                __morrow: {
                    pauseSimulation(value: boolean): void;
                    snapshot(): { render: { performanceMode: boolean } };
                };
            }
        ).__morrow;
        game.pauseSimulation(true);
        return game.snapshot().render.performanceMode;
    });
    await page.keyboard.press('p');
    const toggledQuality = await page.evaluate(
        () =>
            (
                window as Window & { __morrow: { snapshot(): { render: { performanceMode: boolean } } } }
            ).__morrow.snapshot().render.performanceMode
    );
    expect(toggledQuality).toBe(!originalQuality);
    const alternateQuality = await page.screenshot({ path: testInfo.outputPath('quality-alternate.png') });
    await testInfo.attach('quality-alternate', { body: alternateQuality, contentType: 'image/png' });
    await page.keyboard.press('p');
    const restoredQuality = await page.evaluate(
        () =>
            (
                window as Window & { __morrow: { snapshot(): { render: { performanceMode: boolean } } } }
            ).__morrow.snapshot().render.performanceMode
    );
    expect(restoredQuality).toBe(originalQuality);
    const restoredImage = await page.screenshot({ path: testInfo.outputPath('quality-restored.png') });
    await testInfo.attach('quality-restored', { body: restoredImage, contentType: 'image/png' });

    expect(pageErrors).toEqual([]);
});

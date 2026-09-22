import { expect, test } from '@playwright/test';

test('third-person starter opens a rendered, interactive scene', async ({ page }, testInfo) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/');
    await expect(page.getByText('Third-Person Controller')).toBeVisible();
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

    await canvas.click();
    await page.keyboard.down('w');
    await page.waitForTimeout(300);
    await page.keyboard.up('w');
    const screenshot = await page.screenshot({ path: testInfo.outputPath('starter.png') });
    await testInfo.attach('third-person-starter', { body: screenshot, contentType: 'image/png' });

    expect(pageErrors).toEqual([]);
});

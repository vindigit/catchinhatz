import { expect, test } from '@playwright/test';

test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    launchOptions: { args: ['--use-angle=swiftshader'] }
});

test('mobile touch controls move, look and expose encounter actions', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as Window & { __morrow?: unknown }).__morrow), undefined, {
        timeout: 120_000
    });
    await expect(page.getByTestId('start-game')).toBeVisible();

    await page.getByTestId('start-game').tap();
    await expect(page.getByTestId('touch-stick')).toBeVisible();
    await expect(page.getByTestId('touch-fire')).toBeVisible();
    await expect(page.getByTestId('touch-aim')).toBeVisible();
    await expect(page.getByTestId('touch-interact')).toBeVisible();

    const before = await page.evaluate(() =>
        (window as Window & { __morrow: { snapshot(): { position: { z: number } } } }).__morrow.snapshot()
    );
    const stick = page.getByTestId('touch-stick');
    const box = await stick.boundingBox();
    expect(box).not.toBeNull();
    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;
    await page.mouse.move(centerX, centerY);
    await stick.dispatchEvent('pointerdown', {
        pointerId: 11,
        pointerType: 'touch',
        clientX: centerX,
        clientY: centerY - box!.height * 0.25,
        bubbles: true
    });
    await page.waitForTimeout(450);
    await stick.dispatchEvent('pointerup', { pointerId: 11, pointerType: 'touch', bubbles: true });
    const after = await page.evaluate(() =>
        (window as Window & { __morrow: { snapshot(): { position: { z: number } } } }).__morrow.snapshot()
    );
    expect(after.position.z).toBeLessThan(before.position.z - 0.15);

    await page.getByTestId('touch-fire').dispatchEvent('pointerdown', {
        pointerId: 12,
        pointerType: 'touch',
        bubbles: true
    });
    await page.waitForTimeout(80);
    await page.getByTestId('touch-fire').dispatchEvent('pointerup', {
        pointerId: 12,
        pointerType: 'touch',
        bubbles: true
    });
    await expect(page.getByTestId('ammo')).not.toHaveText('12');
    await page.getByTestId('touch-pause').tap();
    await expect(page.getByTestId('resume-game')).toBeVisible();
    expect(errors).toEqual([]);
});

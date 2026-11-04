import { expect, type Page } from '@playwright/test';

export async function selectExercise(page: Page, name: string) {
  await page.getByRole('button', { name: `Select ${name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Add exercises (1)', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Close exercise picker', exact: true }),
  ).toHaveCount(0);
}

export async function minimizeWorkout(page: Page) {
  const handle = page.getByTestId('workout-pull-handle');
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  if (!box) throw new Error('Workout pull handle is not visible');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 100, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Resume workout', exact: true })).toBeVisible();
  await expect(page.getByTestId('workout-pull-handle')).toHaveCount(0);
}

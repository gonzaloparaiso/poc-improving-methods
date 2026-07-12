import { test, expect } from '@playwright/test'

async function loginConPlan(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.evaluate(async () => {
    localStorage.clear(); sessionStorage.clear()
    await new Promise<void>(r => { const q = indexedDB.deleteDatabase('im_store'); q.onsuccess = q.onerror = q.onblocked = () => r() })
  })
  await page.goto('/login')
  await page.getByPlaceholder('correo@ejemplo.com').fill('conplan@test.com')
  await page.locator('input[autocomplete="current-password"]').fill('plan123')
  await page.getByRole('button', { name: /Entrar a mi entrenamiento/i }).click()
  await expect(page.getByRole('button', { name: 'Día', exact: true })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }) // escritorio: vista Semana visible
})

test('el menú Exportar solo ofrece PDF y Excel (sin Aimharder/Wodbuster)', async ({ page }) => {
  await loginConPlan(page)
  await page.getByRole('button', { name: 'Exportar' }).click()
  await expect(page.getByText('PDF', { exact: true })).toBeVisible()
  await expect(page.getByText('Excel', { exact: true })).toBeVisible()
  await expect(page.getByText('Aimharder')).toHaveCount(0)
  await expect(page.getByText('Wodbuster')).toHaveCount(0)
})

test('copiar una sesión para Aimharder pone el texto en el portapapeles', async ({ page }) => {
  await loginConPlan(page)
  await page.getByRole('button', { name: 'WOD del día' }).click()

  await expect(page.getByText('Descripción', { exact: true })).toBeVisible()
  const btnAimharder = page.getByRole('button', { name: 'Copiar para Aimharder' })
  const btnWodbuster = page.getByRole('button', { name: 'Copiar para Wodbuster' })
  await expect(btnAimharder).toBeVisible()
  await expect(btnWodbuster).toBeVisible()

  await btnAimharder.click()
  await expect(page.getByText('¡Copiado!')).toBeVisible()

  const texto = await page.evaluate(() => navigator.clipboard.readText())
  expect(texto).toContain('WOD del día')
  expect(texto).toContain("⏱ AMRAP 12'")
  expect(texto).toContain('Sentadilla')
})

test('copiar una sesión para Wodbuster pone el texto en el portapapeles', async ({ page }) => {
  await loginConPlan(page)
  await page.getByRole('button', { name: 'WOD del día' }).click()

  await page.getByRole('button', { name: 'Copiar para Wodbuster' }).click()
  await expect(page.getByText('¡Copiado!')).toBeVisible()

  const texto = await page.evaluate(() => navigator.clipboard.readText())
  expect(texto).toContain('Sentadilla')
})

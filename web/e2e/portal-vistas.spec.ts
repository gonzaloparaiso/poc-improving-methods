import { test, expect, type Page } from '@playwright/test'

async function loginConPlan(page: Page) {
  await page.goto('/login')
  await page.evaluate(async () => {
    localStorage.clear(); sessionStorage.clear()
    await new Promise<void>(r => { const q = indexedDB.deleteDatabase('im_store'); q.onsuccess = q.onerror = q.onblocked = () => r() })
  })
  await page.goto('/login')
  await page.getByPlaceholder('correo@ejemplo.com').fill('conplan@test.com')
  await page.locator('input[autocomplete="current-password"]').fill('plan123')
  await page.getByRole('button', { name: /Entrar a mi entrenamiento/i }).click()
  // El portal con plan muestra el selector de vista (botón "Día")
  await expect(page.getByRole('button', { name: 'Día', exact: true })).toBeVisible()
}

test('en MÓVIL solo está la vista Día + aviso de escritorio', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await loginConPlan(page)
  await expect(page.getByRole('button', { name: 'Día', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Semana', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Todas', exact: true })).toHaveCount(0)
  await expect(page.getByText(/disponible desde un ordenador/i)).toBeVisible()
})

test('en ESCRITORIO están las 3 vistas y no el aviso', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await loginConPlan(page)
  await expect(page.getByRole('button', { name: 'Semana', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Todas', exact: true })).toBeVisible()
  await expect(page.getByText(/disponible desde un ordenador/i)).toHaveCount(0)
})

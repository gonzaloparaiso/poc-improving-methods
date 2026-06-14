import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/admin/login')
  await page.evaluate(async () => {
    localStorage.clear(); sessionStorage.clear()
    await new Promise<void>(r => { const q = indexedDB.deleteDatabase('im_store'); q.onsuccess = q.onerror = q.onblocked = () => r() })
  })
})

test('/admin redirige al login de staff', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/login$/)
})

test('el admin inicia sesión y entra al panel bajo /admin', async ({ page }) => {
  await page.goto('/admin/login')
  await page.locator('input[type="text"]').first().fill('admin')
  await page.locator('input[autocomplete="current-password"]').fill('admin123')
  await page.getByRole('button', { name: /Entrar/i }).click()
  await expect(page).toHaveURL(/\/admin\/clientes$/)
  // La navegación del panel apunta a rutas /admin/...
  await expect(page.locator('nav a[href="/admin/planificacion"]')).toBeVisible()
})

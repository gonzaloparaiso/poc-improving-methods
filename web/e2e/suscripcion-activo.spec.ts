import { test, expect, type Page } from '@playwright/test'

async function loginAdmin(page: Page) {
  await page.goto('/admin/login')
  await page.evaluate(async () => {
    localStorage.clear(); sessionStorage.clear()
    await new Promise<void>(r => { const q = indexedDB.deleteDatabase('im_store'); q.onsuccess = q.onerror = q.onblocked = () => r() })
  })
  await page.goto('/admin/login')
  await page.locator('input[type="text"]').first().fill('a@a.com')
  await page.locator('input[autocomplete="current-password"]').fill('admin123')
  await page.getByRole('button', { name: /Entrar/i }).click()
  await expect(page).toHaveURL(/\/admin\/clientes$/)
}

test('suscripciones: se puede desactivar una suscripción sin clientes asignados desde la lista', async ({ page }) => {
  await loginAdmin(page)
  await page.goto('/admin/suscripciones')
  await page.getByRole('button', { name: 'Nueva suscripción' }).first().click()
  await page.getByPlaceholder('Ej: CrossFit Mensual').fill('Plan Activo E2E')
  await page.getByRole('button', { name: 'Crear suscripción' }).click()

  const fila = page.locator('tr', { hasText: 'Plan Activo E2E' })
  await expect(fila).toBeVisible()
  await expect(fila.getByRole('button', { name: '✓ Activa' })).toBeVisible()

  await fila.getByRole('button', { name: '✓ Activa' }).click()
  await expect(fila.getByRole('button', { name: '✗ Inactiva' })).toBeVisible()
})

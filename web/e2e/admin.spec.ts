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

async function loginAdmin(page) {
  await page.goto('/admin/login')
  await page.locator('input[type="text"]').first().fill('admin')
  await page.locator('input[autocomplete="current-password"]').fill('admin123')
  await page.getByRole('button', { name: /Entrar/i }).click()
  await expect(page).toHaveURL(/\/admin\/clientes$/)
}

test('el admin inicia sesión y entra al panel bajo /admin', async ({ page }) => {
  await loginAdmin(page)
  // La navegación del panel apunta a rutas /admin/...
  await expect(page.locator('nav a[href="/admin/planificacion"]')).toBeVisible()
})

test('el admin crea un usuario desde el panel y aparece en la lista', async ({ page }) => {
  await loginAdmin(page)
  await page.goto('/admin/administracion')
  await page.getByRole('button', { name: /Nuevo usuario/i }).click()
  await page.getByPlaceholder('Nombre', { exact: true }).fill('Laura')
  await page.getByPlaceholder('correo@ejemplo.com').fill('laura@test.com')
  await page.getByPlaceholder('nombre_usuario').fill('laura')
  const pwds = page.locator('input[type="password"]')
  await pwds.nth(0).fill('laura1234')
  await pwds.nth(1).fill('laura1234')
  await page.getByRole('button', { name: /Crear usuario/i }).click()
  // Tras crearse (POST /api/users + refresh), aparece en la tabla
  await expect(page.getByText('@laura')).toBeVisible()
})

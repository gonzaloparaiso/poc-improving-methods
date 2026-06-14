import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Estado limpio: sin sesión ni caché entre tests
  await page.goto('/login')
  await page.evaluate(async () => {
    localStorage.clear(); sessionStorage.clear()
    await new Promise<void>(r => { const q = indexedDB.deleteDatabase('im_store'); q.onsuccess = q.onerror = q.onblocked = () => r() })
  })
})

test('la raíz lleva al login de clientes', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Mi Entrenamiento' })).toBeVisible()
})

test('el cliente inicia sesión y entra a su portal', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('correo@ejemplo.com').fill('cliente@test.com')
  await page.locator('input[autocomplete="current-password"]').fill('cli123')
  await page.getByRole('button', { name: /Entrar a mi entrenamiento/i }).click()
  // Cliente sembrado sin planificación → estado vacío del portal
  await expect(page.getByText('Aún no tienes planificación')).toBeVisible()
})

test('el campo de contraseña se puede mostrar y ocultar', async ({ page }) => {
  await page.goto('/login')
  const pwd = page.locator('input[autocomplete="current-password"]')
  await pwd.fill('secreto')
  await expect(pwd).toHaveAttribute('type', 'password')
  await pwd.locator('xpath=following-sibling::button').click()
  await expect(pwd).toHaveAttribute('type', 'text')
})

test('"¿Olvidaste tu contraseña?" muestra la confirmación de envío', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: /olvidado tu contraseña/i }).click()
  await page.getByPlaceholder('correo@ejemplo.com').fill('cliente@test.com')
  await page.getByRole('button', { name: /Enviar enlace/i }).click()
  await expect(page.getByText('Revisa tu correo')).toBeVisible()
})

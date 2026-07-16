import { test, expect, type Page } from '@playwright/test'

async function loginCliente(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.evaluate(async () => {
    localStorage.clear(); sessionStorage.clear()
    await new Promise<void>(r => { const q = indexedDB.deleteDatabase('im_store'); q.onsuccess = q.onerror = q.onblocked = () => r() })
  })
  await page.goto('/login')
  await page.getByPlaceholder('correo@ejemplo.com').fill(email)
  await page.locator('input[autocomplete="current-password"]').fill(password)
  await page.getByRole('button', { name: /Entrar a mi entrenamiento/i }).click()
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
})

test('cliente con programa + "Basic" combinados ve tanto su calendario como la pestaña Contenido', async ({ page }) => {
  await loginCliente(page, 'conplan@test.com', 'plan123')
  await expect(page.getByRole('button', { name: 'Día', exact: true })).toBeVisible()
  const tabContenido = page.getByRole('button', { name: 'Contenido', exact: true })
  await expect(tabContenido).toBeVisible()

  await tabContenido.click()
  await expect(page.getByText('Respiración', { exact: true })).toBeVisible()
  // La sección renderiza a la vez la cuadrícula (escritorio) y la lista
  // (móvil); en este viewport de escritorio la cuadrícula es la visible.
  // getByRole('heading', ...) evita la sugerencia "Es probable que te guste" (un <p>, no heading)
  await expect(page.getByRole('heading', { name: 'Respiración diafragmática' }).first()).toBeVisible()

  // abrir el detalle de una respiración
  await page.getByRole('heading', { name: 'Respiración diafragmática' }).first().click()
  await expect(page.getByRole('button', { name: 'Cerrar' })).toBeVisible()
})

test('cliente con SOLO "Basic" (sin programa real) entra directo a Contenido, sin pantalla de "sin planificación"', async ({ page }) => {
  await loginCliente(page, 'basic@test.com', 'basic123')
  await expect(page.getByText('Aún no tienes planificación')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Respiración diafragmática' }).first()).toBeVisible()
})

import { test, expect, type Page } from '@playwright/test'

async function loginAdmin(page: Page) {
  await page.goto('/admin/login')
  await page.evaluate(async () => {
    localStorage.clear(); sessionStorage.clear()
    await new Promise<void>(r => { const q = indexedDB.deleteDatabase('im_store'); q.onsuccess = q.onerror = q.onblocked = () => r() })
  })
  await page.goto('/admin/login')
  await page.locator('input[type="text"]').first().fill('admin')
  await page.locator('input[autocomplete="current-password"]').fill('admin123')
  await page.getByRole('button', { name: /Entrar/i }).click()
  await expect(page).toHaveURL(/\/admin\/clientes$/)
}

test('no se puede crear un Programa llamado "Basic" (nombre reservado, sin distinguir mayúsculas)', async ({ page }) => {
  await loginAdmin(page)
  await page.goto('/admin/planificacion')
  await page.getByRole('button', { name: 'Nuevo programa' }).first().click()
  await page.getByPlaceholder('Ej: CrossFit Q1 2025').fill('BASIC')
  await page.getByRole('button', { name: 'Crear programa' }).click()
  await expect(page.getByText('nombre reservado')).toBeVisible()
  // el modal sigue abierto (no se creó ni se cerró)
  await expect(page.getByPlaceholder('Ej: CrossFit Q1 2025')).toBeVisible()
})

test('"Basic" aparece como opción en el selector de programas de una suscripción, combinable con un programa real y sin fecha propia', async ({ page }) => {
  await loginAdmin(page)
  await page.goto('/admin/suscripciones')
  await page.getByRole('button', { name: 'Nueva suscripción' }).first().click()
  await page.getByPlaceholder('Ej: CrossFit Mensual').fill('Plan combinado E2E')

  // Añadir "Basic" (con la lista vacía hay dos botones equivalentes: el del
  // encabezado y el de "+ Añadir programa" del estado vacío)
  await page.getByRole('button', { name: 'Añadir' }).first().click()
  await page.locator('select').first().selectOption({ label: 'Basic — Respiración y Movilidad' })
  // No debe pedir fecha para Basic
  await expect(page.getByText('Da acceso inmediato a Respiración y Movilidad')).toBeVisible()
  await expect(page.getByText('Lunes de inicio')).toHaveCount(0)

  // Añadir el programa real también (combinable)
  await page.getByRole('button', { name: 'Añadir' }).click()
  await page.locator('select').nth(1).selectOption({ label: 'Programa Test' })
  await expect(page.getByText('Lunes de inicio *')).toBeVisible()

  await page.getByRole('button', { name: 'Crear suscripción' }).click()
  const fila = page.locator('tr', { hasText: 'Plan combinado E2E' })
  await expect(fila).toBeVisible()
  // La tabla duplica el contenido en versión móvil/escritorio (la versión de
  // escritorio, visible en este viewport, es la última en el DOM)
  await expect(fila.getByText('Basic', { exact: true }).last()).toBeVisible()
  await expect(fila.getByText('Programa Test', { exact: true }).last()).toBeVisible()
})

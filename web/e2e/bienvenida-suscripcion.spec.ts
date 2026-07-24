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

test('mensaje de bienvenida: se edita en su propia modal, con vista previa, y persiste al reabrir', async ({ page }) => {
  await loginAdmin(page)
  await page.goto('/admin/suscripciones')
  await page.getByRole('button', { name: 'Nueva suscripción' }).first().click()
  await page.getByPlaceholder('Ej: CrossFit Mensual').fill('Plan Bienvenida E2E')
  await page.getByRole('button', { name: 'Crear suscripción' }).click()
  await expect(page.locator('tr', { hasText: 'Plan Bienvenida E2E' })).toBeVisible()

  // Abrir la modal de bienvenida desde la fila (icono de sobre, primer botón de acciones)
  const fila = page.locator('tr', { hasText: 'Plan Bienvenida E2E' })
  await fila.getByTitle('Mensaje de bienvenida').click()
  await expect(page.getByText('Mensaje de bienvenida')).toBeVisible()
  await expect(page.getByText('Plan Bienvenida E2E').first()).toBeVisible()

  // Tab Email: el contentEditable ya trae el texto por defecto
  await expect(page.locator('[contenteditable="true"]')).toContainText('¡bienvenido/a a Training Norte!')
  // La vista previa refleja el mismo texto
  await expect(page.getByText('Vista previa').first()).toBeVisible()

  // Editar el texto de WhatsApp y guardar
  await page.getByRole('button', { name: 'WhatsApp' }).click()
  const textarea = page.locator('textarea').first()
  await textarea.fill('Hola{nombre}, mensaje de prueba E2E para WhatsApp')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Mensaje de bienvenida')).toHaveCount(0)

  // Reabrir y comprobar que el cambio persistió
  await fila.getByTitle('Mensaje de bienvenida').click()
  await page.getByRole('button', { name: 'WhatsApp' }).click()
  await expect(page.locator('textarea').first()).toHaveValue('Hola{nombre}, mensaje de prueba E2E para WhatsApp')
  // El botón de enviar prueba de WhatsApp está deshabilitado (aún sin Whapi)
  await expect(page.getByRole('button', { name: 'Enviar prueba' }).last()).toBeDisabled()
})

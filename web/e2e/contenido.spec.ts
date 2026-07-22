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

test.beforeEach(async ({ page }) => {
  await loginAdmin(page)
  await page.locator('nav a[href="/admin/contenido"]').click()
  await expect(page).toHaveURL(/\/admin\/contenido$/)
})

test('la sección Contenido tiene las pestañas Respiración y Movilidad', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Respiración', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Movilidad', exact: true })).toBeVisible()
})

test('Respiración muestra las 5 respiraciones de ejemplo', async ({ page }) => {
  await expect(page.getByText('5 elementos')).toBeVisible()
  await expect(page.getByText('Respiración diafragmática')).toBeVisible()
  await expect(page.getByText('Respiración 4-7-8')).toBeVisible()
  await expect(page.getByText('Respiración de caja (Box Breathing)')).toBeVisible()
})

test('Movilidad empieza vacía', async ({ page }) => {
  await page.getByRole('button', { name: 'Movilidad', exact: true }).click()
  await expect(page.getByText('Sin ejercicios de movilidad')).toBeVisible()
})

test('crear, editar y eliminar un elemento de Movilidad', async ({ page }) => {
  await page.getByRole('button', { name: 'Movilidad', exact: true }).click()

  // Crear (hay dos botones "Nueva movilidad": el del header y el del estado vacío)
  await page.getByRole('button', { name: 'Nueva movilidad' }).first().click()
  await page.getByPlaceholder('Ej: Movilidad').fill('Movilidad de cadera')
  await page.locator('textarea').fill('Circunducciones de cadera antes del WOD')
  const tagInput = page.locator('input[placeholder="Escribe y pulsa Enter…"]')
  await tagInput.fill('calentamiento')
  await tagInput.press('Enter')
  await page.getByRole('button', { name: 'Crear' }).click()

  await expect(page.getByText('Movilidad de cadera')).toBeVisible()
  await expect(page.getByText('calentamiento')).toBeVisible()
  await expect(page.getByText('1 elemento')).toBeVisible()

  // Editar
  await page.getByTitle('Editar').click()
  const tituloInput = page.locator('input[type="text"]').first()
  await tituloInput.fill('Movilidad de cadera y tobillo')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Movilidad de cadera y tobillo')).toBeVisible()

  // Eliminar (el icono de la tarjeta y el botón del diálogo comparten
  // nombre accesible "Eliminar"; el del diálogo es el último en el DOM)
  await page.getByTitle('Eliminar').click()
  await page.getByRole('button', { name: 'Eliminar', exact: true }).last().click()
  await expect(page.getByText('Sin ejercicios de movilidad')).toBeVisible()
})

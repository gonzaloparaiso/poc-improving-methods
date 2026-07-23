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
  await expect(page.getByRole('button', { name: 'Día', exact: true })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
})

test('vista Día: el calendario continúa (vacío) más allá del fin del programa, sin quedarse bloqueado', async ({ page }) => {
  await loginConPlan(page)
  await page.getByRole('button', { name: 'Día', exact: true }).click()

  const fechaHeading = page.locator('h2.capitalize')
  const fechaInicial = await fechaHeading.textContent()

  const siguiente = page.locator('button:has(svg path[d^="M9 5l7 7"])')
  // El programa sembrado solo cubre la semana actual (7 días): avanzamos 10 para
  // salir de esa semana y comprobar que el calendario sigue generando días.
  for (let i = 0; i < 10; i++) {
    await siguiente.click()
  }

  const fechaFinal = await fechaHeading.textContent()
  expect(fechaFinal).not.toBe(fechaInicial)
  // El día virtual no tiene bloques → debe verse como día de descanso, no un error
  await expect(page.getByText('Día de descanso')).toBeVisible()
  // La flecha de avanzar sigue activa (el calendario no se "acaba")
  await expect(siguiente).toBeEnabled()
})

test('vista Día: "HOY" se marca en blanco, no en el amarillo de los programas', async ({ page }) => {
  await loginConPlan(page)
  await page.getByRole('button', { name: 'Día', exact: true }).click()
  const hoy = page.getByText('HOY', { exact: true })
  await expect(hoy).toBeVisible()
  await expect(hoy).toHaveCSS('background-color', 'rgb(255, 255, 255)')
})

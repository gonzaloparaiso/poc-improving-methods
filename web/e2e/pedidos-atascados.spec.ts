import { test, expect, type Page } from '@playwright/test'
import crypto from 'node:crypto'

const WH_SECRET = 'e2e-wh-secret'   // debe coincidir con web/e2e/api-server.mjs

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

/** Simula un webhook de WooCommerce firmado, igual que lo manda la tienda de verdad. */
async function enviarWebhook(page: Page, body: unknown, topic: string) {
  const raw = JSON.stringify(body)
  const firma = crypto.createHmac('sha256', WH_SECRET).update(raw, 'utf8').digest('base64')
  const res = await page.request.post('http://127.0.0.1:3001/api/wc/webhook/tn', {
    headers: { 'Content-Type': 'application/json', 'x-wc-webhook-topic': topic, 'x-wc-webhook-signature': firma },
    data: raw,
  })
  expect(res.ok()).toBeTruthy()
}

test('pedidos atascados: un pago sin confirmar sale en la lista y el admin puede darle acceso a mano', async ({ page }) => {
  await loginAdmin(page)

  // El catálogo de e2e trae "Plan Test"; le ponemos su ID de WooCommerce para que el pedido lo encuentre
  await page.goto('/admin/suscripciones')
  const filaPlan = page.locator('tr', { hasText: 'Plan Test' })
  await filaPlan.getByTitle('Editar suscripción').click()
  await page.getByPlaceholder('Ej: 27984 (opcional)').fill('61234')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()

  // Entra una compra que el banco deja "en espera": el cliente se queda sin acceso
  await enviarWebhook(page, {
    id: 778899, status: 'on-hold', created_via: 'checkout', total: '30.00', currency: 'EUR',
    billing: { email: 'atascado@e2e.com', first_name: 'Ana', last_name: 'Atascada', phone: '600111222' },
    line_items: [{ product_id: 61234, name: 'Plan Test' }],
  }, 'order.created')

  // Aparece en la pestaña de atascados, con su contador
  await page.goto('/admin/suscripciones')
  await expect(page.getByRole('button', { name: /Pedidos atascados/ })).toContainText('1')
  await page.getByRole('button', { name: /Pedidos atascados/ }).click()

  const tarjeta = page.locator('.card', { hasText: 'atascado@e2e.com' })
  await expect(tarjeta).toBeVisible()
  await expect(tarjeta).toContainText('Ana Atascada')
  await expect(tarjeta).toContainText('#778899')
  await expect(tarjeta).toContainText('En espera')
  await expect(tarjeta).toContainText('Plan Test')

  // El admin confirma en la tienda que sí está pagado y le da acceso
  await tarjeta.getByRole('button', { name: 'Ya está pagado' }).click()
  await page.getByRole('button', { name: 'Sí, dar acceso' }).click()

  await expect(page.getByText('Nada atascado')).toBeVisible()

  // Y el cliente existe ya en el panel
  await page.goto('/admin/clientes')
  await expect(page.getByText('atascado@e2e.com').first()).toBeVisible()
})

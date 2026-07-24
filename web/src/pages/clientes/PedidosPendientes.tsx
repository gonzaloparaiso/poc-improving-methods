import { useState, useEffect, useCallback } from 'react'
import { type PedidoPendiente } from '../../types'
import { apiPedidosPendientes, apiProcesarPedidoPendiente, apiDescartarPedidoPendiente, refreshFromServer } from '../../lib/storage'
import ConfirmDialog from '../../components/ConfirmDialog'
import { usePermisos } from '../../hooks/usePermisos'

function haceCuanto(ms: number): string {
  const dias = Math.floor((Date.now() - ms) / 86400000)
  if (dias >= 1) return `hace ${dias} día${dias !== 1 ? 's' : ''}`
  const horas = Math.floor((Date.now() - ms) / 3600000)
  if (horas >= 1) return `hace ${horas} h`
  return 'hace un momento'
}

/** Estado del pedido tal cual lo manda WooCommerce, en cristiano. */
const ESTADO_WC: Record<string, string> = {
  pending: 'Pendiente de pago',
  'on-hold': 'En espera (transferencia)',
  failed: 'Pago fallido',
  cancelled: 'Cancelado',
  processing: 'En proceso',
  refunded: 'Reembolsado',
}

export default function PedidosPendientes() {
  const { puede } = usePermisos()
  const [pedidos, setPedidos] = useState<PedidoPendiente[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<{ pedido: PedidoPendiente; accion: 'procesar' | 'descartar' } | null>(null)

  const cargar = useCallback(async () => {
    try {
      setPedidos(await apiPedidosPendientes())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los pedidos')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  const ejecutar = async () => {
    if (!confirmar) return
    const { pedido, accion } = confirmar
    setConfirmar(null)
    setTrabajando(pedido.wcOrderId)
    try {
      if (accion === 'procesar') {
        await apiProcesarPedidoPendiente(pedido.wcOrderId)
        await refreshFromServer()   // el alta crea cliente/suscripción: refrescamos el panel
      } else {
        await apiDescartarPedidoPendiente(pedido.wcOrderId)
      }
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la operación')
    } finally {
      setTrabajando(null)
    }
  }

  if (cargando) {
    return <p className="text-tn-muted text-sm">Cargando pedidos...</p>
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-white">Pedidos atascados</h2>
        <p className="text-tn-muted text-sm mt-1">
          {pedidos.length === 0
            ? 'Compras cuyo pago nunca llegó a confirmarse'
            : `${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''} sin resolver`}
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
      )}

      {pedidos.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 px-8 text-center">
          <div className="w-16 h-16 bg-green-400/10 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-white font-bold text-lg mb-2">Nada atascado</h3>
          <p className="text-tn-muted text-sm max-w-md">
            Todas las compras que han entrado se han dado de alta correctamente. Si un pago tarda en
            confirmarse, el pedido aparecerá aquí hasta que la tienda avise de que ya está pagado.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-tn-yellow/5 border border-tn-yellow/20 rounded-xl p-4">
            <p className="text-tn-yellow/80 text-xs leading-relaxed">
              Estos clientes pagaron (o intentaron pagar) y se han quedado sin acceso porque la tienda
              nunca confirmó el cobro. Compruébalo en WooCommerce: si el pedido está realmente pagado,
              usa <span className="font-semibold">"Ya está pagado"</span> para darle el acceso.
            </p>
          </div>

          <div className="space-y-3">
            {pedidos.map(p => (
              <div key={p.wcOrderId} className="card p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-semibold text-sm">{p.nombre || 'Sin nombre'}</p>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-400/10 text-red-400">
                        {ESTADO_WC[p.status] ?? p.status ?? 'Desconocido'}
                      </span>
                      {p.origen && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-tn-yellow/10 text-tn-yellow">
                          {p.origen.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-tn-muted text-xs mt-1">{p.email || 'Sin email'}{p.telefono ? ` · ${p.telefono}` : ''}</p>

                    <div className="mt-3 flex items-center gap-4 flex-wrap text-xs">
                      <span className="text-tn-muted">
                        Pedido <span className="text-white font-medium">#{p.wcOrderId}</span>
                      </span>
                      {p.total != null && (
                        <span className="text-white font-semibold">{p.total} {p.moneda || '€'}</span>
                      )}
                      <span className="text-tn-muted">{haceCuanto(p.creadoEn)}</span>
                    </div>

                    <div className="mt-2">
                      {p.productoPortal ? (
                        <p className="text-tn-muted text-xs">
                          Suscripción: <span className="text-white">{p.productoPortal.nombre}</span>
                          {!p.productoPortal.activo && (
                            <span className="text-red-400 ml-2">· desactivada, no se podrá dar de alta</span>
                          )}
                        </p>
                      ) : (
                        <p className="text-red-400 text-xs">
                          El producto de este pedido no está en el catálogo
                          {p.lineas[0]?.productId ? ` (ID de WooCommerce ${p.lineas[0].productId})` : ''} — añádelo antes de darlo de alta.
                        </p>
                      )}
                    </div>
                  </div>

                  {puede('suscripciones', 'editar') && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setConfirmar({ pedido: p, accion: 'procesar' })}
                        disabled={trabajando === p.wcOrderId || !p.productoPortal}
                        className="btn-primary text-sm py-2 px-4 disabled:opacity-40 disabled:cursor-not-allowed">
                        {trabajando === p.wcOrderId ? '...' : 'Ya está pagado'}
                      </button>
                      <button
                        onClick={() => setConfirmar({ pedido: p, accion: 'descartar' })}
                        disabled={trabajando === p.wcOrderId}
                        className="btn-secondary text-sm py-2 px-4 disabled:opacity-40">
                        Descartar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {confirmar?.accion === 'procesar' && (
        <ConfirmDialog
          title="Dar acceso a este cliente"
          description={`Se dará de alta a ${confirmar.pedido.nombre || confirmar.pedido.email} con la suscripción "${confirmar.pedido.productoPortal?.nombre}" y se le enviará la bienvenida. Asegúrate antes de que el pedido #${confirmar.pedido.wcOrderId} está realmente pagado en WooCommerce.`}
          confirmLabel="Sí, dar acceso"
          onConfirm={ejecutar}
          onCancel={() => setConfirmar(null)}
        />
      )}
      {confirmar?.accion === 'descartar' && (
        <ConfirmDialog
          title="Descartar pedido"
          description={`El pedido #${confirmar.pedido.wcOrderId} dejará de aparecer en esta lista. No se borra: queda registrado por si hay que consultarlo más adelante.`}
          confirmLabel="Descartar"
          onConfirm={ejecutar}
          onCancel={() => setConfirmar(null)}
        />
      )}
    </div>
  )
}

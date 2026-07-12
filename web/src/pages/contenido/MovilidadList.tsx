import { useContenido } from '../../context/ContenidoContext'
import ContenidoList from './ContenidoList'

export default function MovilidadList() {
  const { movilidad, crearMovilidad, editarMovilidad, borrarMovilidad } = useContenido()

  return (
    <ContenidoList
      items={movilidad}
      onCrear={crearMovilidad}
      onEditar={editarMovilidad}
      onBorrar={borrarMovilidad}
      titulo="Movilidad"
      nuevoLabel="Nueva movilidad"
      emptyTitulo="Sin ejercicios de movilidad"
      emptyDescripcion="Crea rutinas de movilidad con su explicación, audio o vídeo, para que tus clientes las practiquen."
      icon={(
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
        </svg>
      )}
    />
  )
}

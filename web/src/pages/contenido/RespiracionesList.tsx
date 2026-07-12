import { useContenido } from '../../context/ContenidoContext'
import ContenidoList from './ContenidoList'

export default function RespiracionesList() {
  const { respiraciones, crearRespiracion, editarRespiracion, borrarRespiracion } = useContenido()

  return (
    <ContenidoList
      items={respiraciones}
      onCrear={crearRespiracion}
      onEditar={editarRespiracion}
      onBorrar={borrarRespiracion}
      titulo="Respiración"
      nuevoLabel="Nueva respiración"
      emptyTitulo="Sin respiraciones"
      emptyDescripcion="Crea técnicas de respiración con su explicación, audio o vídeo, para que tus clientes las practiquen."
      icon={(
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2" />
        </svg>
      )}
    />
  )
}

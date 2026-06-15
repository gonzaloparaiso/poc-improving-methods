// Reproductor de vídeo embebido. Detecta YouTube/Vimeo (iframe) o vídeo
// directo (mp4/webm, p.ej. URLs de Google Cloud Storage) → <video> nativo.

interface Props {
  url: string
  poster?: string
  title?: string
  className?: string
}

export function youtubeOrVimeoEmbed(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([^&?\s]+)/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vm = url.match(/vimeo\.com\/(\d+)/)
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`
  return null
}

export default function VideoPlayer({ url, poster, title, className = '' }: Props) {
  if (!url) return null
  const embed = youtubeOrVimeoEmbed(url)

  if (embed) {
    return (
      <div className={`relative bg-black rounded-lg overflow-hidden ${className}`} style={{ paddingBottom: '56.25%' }}>
        <iframe
          src={embed}
          className="absolute inset-0 w-full h-full"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          title={title || 'Vídeo'}
        />
      </div>
    )
  }

  // Vídeo directo (mp4/webm/GCS): se reproduce en línea, no se descarga.
  return (
    <video
      src={url}
      poster={poster || undefined}
      controls
      preload="metadata"
      playsInline
      className={`w-full rounded-lg bg-black max-h-[60vh] ${className}`}
    >
      Tu navegador no puede reproducir este vídeo.
    </video>
  )
}

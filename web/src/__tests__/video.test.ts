import { describe, it, expect } from 'vitest'
import { youtubeOrVimeoEmbed } from '../components/VideoPlayer'

describe('youtubeOrVimeoEmbed', () => {
  it('convierte URLs de YouTube (watch) a embed', () => {
    expect(youtubeOrVimeoEmbed('https://www.youtube.com/watch?v=abc123')).toBe('https://www.youtube.com/embed/abc123')
  })
  it('convierte enlaces cortos youtu.be', () => {
    expect(youtubeOrVimeoEmbed('https://youtu.be/XYZ987')).toBe('https://www.youtube.com/embed/XYZ987')
  })
  it('convierte URLs de Vimeo a player', () => {
    expect(youtubeOrVimeoEmbed('https://vimeo.com/123456789')).toBe('https://player.vimeo.com/video/123456789')
  })
  it('devuelve null para vídeos directos (mp4 de GCS) → se usará <video>', () => {
    expect(youtubeOrVimeoEmbed('https://storage.googleapis.com/tataki-media/exercises/x.mp4')).toBeNull()
  })
})

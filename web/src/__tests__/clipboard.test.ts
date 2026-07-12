import { describe, it, expect, vi, afterEach } from 'vitest'
import { copiarAlPortapapeles } from '../lib/clipboard'

describe('copiarAlPortapapeles', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('usa navigator.clipboard.writeText cuando está disponible', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const ok = await copiarAlPortapapeles('hola mundo')

    expect(ok).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hola mundo')
  })

  it('cae al fallback de textarea si clipboard.writeText falla', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no permitido')) },
    })
    const textarea = { value: '', style: {} as Record<string, string>, focus: vi.fn(), select: vi.fn() }
    const execCommand = vi.fn(() => true)
    const removeChild = vi.fn()
    vi.stubGlobal('document', {
      createElement: vi.fn(() => textarea),
      body: { appendChild: vi.fn(), removeChild },
      execCommand,
    })

    const ok = await copiarAlPortapapeles('adiós')

    expect(ok).toBe(true)
    expect(textarea.value).toBe('adiós')
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(removeChild).toHaveBeenCalledWith(textarea)
  })

  it('devuelve false si tanto la Clipboard API como el fallback fallan', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no permitido')) },
    })
    vi.stubGlobal('document', {
      createElement: vi.fn(() => { throw new Error('sin DOM') }),
    })

    const ok = await copiarAlPortapapeles('x')

    expect(ok).toBe(false)
  })
})

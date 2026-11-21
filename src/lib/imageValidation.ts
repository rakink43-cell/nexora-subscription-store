const MAX_IMAGE_BYTES = 4 * 1024 * 1024

/**
 * Validate the browser-reported image type against the file's actual signature.
 * This is a client-side safety/quality check, not a replacement for storage
 * authorization or server-side validation.
 */
export async function validateStoreImage(file: File): Promise<void> {
  if (file.size <= 0) throw new Error('Image file is empty.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image must be smaller than 4 MB.')
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) throw new Error('Please choose a JPG, PNG or WEBP image.')

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const png = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'

  const matchesType =
    (file.type === 'image/jpeg' && jpeg) ||
    (file.type === 'image/png' && png) ||
    (file.type === 'image/webp' && webp)
  if (!matchesType) throw new Error('The file content does not match a valid JPG, PNG or WEBP image.')
}

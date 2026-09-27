import assert from 'node:assert'
import { test } from 'node:test'

// config.js lee el entorno al importarse: se fija antes de cargar r2.js.
process.env.R2_ACCOUNT_ID = 'account'
process.env.R2_ACCESS_KEY_ID = 'key'
process.env.R2_SECRET_ACCESS_KEY = 'secret'
process.env.R2_BUCKET = 'bucket'
process.env.R2_PUBLIC_URL = 'https://photos.example.com/'

const { storage } = await import('../utils/r2.js')

test('the upload url is signed and pins the content type', async () => {
  const url = new URL(await storage.presignPut('listings/1/abc', 'image/webp'))

  assert.strictEqual(url.origin, 'https://account.r2.cloudflarestorage.com')
  assert.strictEqual(url.pathname, '/bucket/listings/1/abc')
  assert.strictEqual(url.searchParams.get('X-Amz-Expires'), '300')
  assert.ok(url.searchParams.get('X-Amz-Signature'))
  // Sin content-type firmado, se podría subir cualquier tipo con esta URL.
  assert.match(url.searchParams.get('X-Amz-SignedHeaders'), /content-type/)
})

test('the public url does not double the slash', () => {
  assert.strictEqual(storage.publicUrl('listings/1/abc'), 'https://photos.example.com/listings/1/abc')
})

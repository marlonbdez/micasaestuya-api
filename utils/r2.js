import { AwsClient } from 'aws4fetch'
import {
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
} from './config.js'

const UPLOAD_URL_SECONDS = 300

// Se crea al usarlo: sin credenciales de R2 la api arranca igual (tests, local).
let client
const getClient = () => {
  client ??= new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto'
  })
  return client
}

const objectUrl = (key) => `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`

const check = (response, action) => {
  if (!response.ok) throw new Error(`R2 ${action} failed with ${response.status}`)
}

// Es un objeto y no funciones sueltas para que los tests puedan sustituirlo.
export const storage = {
  // URL temporal para que el navegador suba el fichero directo a R2. El
  // Content-Type queda firmado (`allHeaders`): subir otro tipo da 403.
  async presignPut (key, contentType) {
    const request = new Request(`${objectUrl(key)}?X-Amz-Expires=${UPLOAD_URL_SECONDS}`, {
      method: 'PUT',
      headers: { 'Content-Type': contentType }
    })
    const signed = await getClient().sign(request, { aws: { signQuery: true, allHeaders: true } })
    return signed.url
  },

  // { contentType, size } o null si no existe.
  async head (key) {
    const response = await getClient().fetch(objectUrl(key), { method: 'HEAD' })
    if (response.status === 404) return null
    check(response, 'HEAD')
    return {
      contentType: response.headers.get('content-type'),
      size: Number(response.headers.get('content-length'))
    }
  },

  async remove (key) {
    const response = await getClient().fetch(objectUrl(key), { method: 'DELETE' })
    if (response.status !== 404) check(response, 'DELETE')
  },

  publicUrl: (key) => `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`
}

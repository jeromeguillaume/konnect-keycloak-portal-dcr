/**
 * Integration test against a LIVE Keycloak instance.
 *
 * This is the regression test for the IAT-exhaustion bug: it drives the real
 * bridge code (no mocked axios) and registers several clients in a row using
 * only the `kong-sa` service-account credentials. With the previous
 * implementation the create path used a consumable Initial Access Token (IAT)
 * and would start returning 401 once its Count was exhausted; with the fix it
 * mints a fresh service-account token per call and can create clients
 * indefinitely.
 *
 * It is NOT run by `npm test`. Provision Keycloak and run it via:
 *   npm run test:integration
 * (see test/integration/run.sh). The suite skips itself if the live Keycloak
 * environment variables are not present, so it is safe in any environment.
 */
import { FastifyInstance } from 'fastify'
import { init } from './app'
import { ApplicationPayload } from './schemas/ApplicationPayload'

const live = Boolean(process.env.KEYCLOAK_CLIENT_SECRET && process.env.KEYCLOAK_DOMAIN)
const describeLive = live ? describe : describe.skip

if (!live) {
  // eslint-disable-next-line no-console
  console.warn('[integration] skipping live Keycloak tests: KEYCLOAK_DOMAIN / KEYCLOAK_CLIENT_SECRET not set')
}

describeLive('DCR bridge against a live Keycloak', () => {
  let app: FastifyInstance
  const apiKey = (process.env.KONG_API_TOKENS ?? '').split(',')[0]
  const createdClientIds: string[] = []

  const basePayload = (name: string): ApplicationPayload => ({
    redirect_uris: ['https://example.com/callback'],
    client_name: name,
    grant_types: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_method: 'client_secret_post',
    application_description: 'integration test client',
    portal_id: '426ac0a7-aeb6-4043-a404-c4bfe24f2705',
    organization_id: '426ac0a7-aeb6-4043-a404-c4bfe24f2706'
  })

  const create = async (name: string) =>
    app.inject({
      method: 'POST',
      url: '/',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
      payload: basePayload(name)
    })

  beforeAll(async () => {
    // init() builds a real axios client pointed at KEYCLOAK_DOMAIN.
    app = await init()
  })

  afterAll(async () => {
    // Best-effort cleanup of anything we created but did not already delete.
    for (const id of createdClientIds) {
      await app.inject({
        method: 'DELETE',
        url: `/${id}`,
        headers: { 'X-API-KEY': apiKey }
      }).catch(() => undefined)
    }
    await app.close()
  })

  it('registers multiple clients in a row with only the kong-sa credentials (no IAT)', async () => {
    const N = 5
    const ids = new Set<string>()

    for (let i = 0; i < N; i++) {
      const resp = await create(`it-repeat-${Date.now()}-${i}`)
      expect(resp.statusCode).toEqual(201)

      const body = JSON.parse(resp.body)
      expect(body.client_id).toBeTruthy()
      expect(body.client_secret).toBeTruthy()
      createdClientIds.push(body.client_id)
      ids.add(body.client_id)
    }

    // Every call succeeded and produced a distinct client — the behaviour an
    // exhausted/expired IAT could not deliver.
    expect(ids.size).toEqual(N)
  })

  it('supports the full create -> delete round-trip via the bridge', async () => {
    const createResp = await create(`it-roundtrip-${Date.now()}`)
    expect(createResp.statusCode).toEqual(201)
    const { client_id: clientId } = JSON.parse(createResp.body)
    expect(clientId).toBeTruthy()

    const deleteResp = await app.inject({
      method: 'DELETE',
      url: `/${clientId}`,
      headers: { 'X-API-KEY': apiKey }
    })
    expect(deleteResp.statusCode).toEqual(204)
  })

  it('rejects a create with a wrong API key without calling Keycloak', async () => {
    const resp = await app.inject({
      method: 'POST',
      url: '/',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': 'definitely-wrong' },
      payload: basePayload('should-not-be-created')
    })
    expect(resp.statusCode).toEqual(401)
  })
})

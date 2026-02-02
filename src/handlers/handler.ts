import type { FastifyInstance, FastifyReply, FastifyRequest, RegisterOptions } from 'fastify'
import type { ApplicationResponse } from '../schemas/ApplicationResponse'
import type { ApplicationPayload } from '../schemas/ApplicationPayload'

import { ApplicationPayloadSchema } from '../schemas/ApplicationPayload'
import { EventHookSchema } from '../schemas/EventHook'

import { Buffer } from 'node:buffer';

function getAdminDomain(domain: string): string {
  return domain.replace('/realms/', '/admin/realms/')
}

/**
 * DCRHandlers registers the fastify plugin for Konnect DCR handlers in the fastify instance
 * it implements all the required routes and also protects the endpoints for with the `x-api-key` header
 */
export function DCRHandlers (fastify: FastifyInstance, _: RegisterOptions, next: (err?: Error) => void): void {
  fastify.addHook('preHandler', (request, reply, done) => {
    const apiKey = request.headers['x-api-key'] as string

    if (!apiKey || !fastify.config.KONG_API_TOKENS.includes(apiKey)) {
      reply.code(401).send({ error: 'Wrong API-Key', error_description: 'wrong x-api-key header' })
    } else {
      done()
    }
  })

  //---------------------------------------
  // Create a new 'client' / 'Application'
  //---------------------------------------
  fastify.route({
    url: '/',
    method: 'POST',
    schema: {
      body: ApplicationPayloadSchema
    },
    handler: async function (request: FastifyRequest<{ Body: ApplicationPayload }>, reply: FastifyReply): Promise<FastifyReply> {
      const grantTypes: string[] = []
      const responseTypes: string[] = []

      console.log("Request from Konnect, url='%s /%s', headers=%j, body=%j", request.method, request.url, request.headers, request.body)

      if (request.body.grant_types.includes('client_credentials') || request.body.grant_types.includes('bearer')) {
        grantTypes.push('client_credentials')
        responseTypes.push('token')
      }

      responseTypes.length = 0
      responseTypes.push('code')
      responseTypes.push('id_token')
      responseTypes.push('token')
      const payloadKeycloak = {
        client_name: request.body.client_name,
        redirect_uris: request.body.redirect_uris,
        response_types: responseTypes,
        grant_types: request.body.grant_types,
        // JEG token_endpoint_auth_method: request.body.token_endpoint_auth_method,
        application_type: 'service'
      }

      const headers = getHeaders(fastify.config.KEYCLOAK_CR_INITIAL_AT)
      const url = 'clients-registrations/openid-connect'
      console.log("Keycloak request, url='POST /%s', headers=%j, body=%j", url, headers, payloadKeycloak)
      const response = await fastify.httpClient.post(
        url,
        payloadKeycloak,
        { headers }
      )
      console.log("Keycloak response, code=%d, data=%j", response.status, response.data)
      const application: ApplicationResponse = {
        client_id: response.data.client_id,
        client_id_issued_at: response.data.client_id_issued_at,
        client_secret: response.data.client_secret,
        client_secret_expires_at: response.data.client_secret_expires_at
      }
      return reply.code(201).send(application)
    }
  })

  //-----------------------------------
  // Delete a 'client' / 'Application'
  //-----------------------------------
  fastify.route({
    url: '/:application_id',
    method: 'DELETE',
    handler: async function (request: FastifyRequest<{ Params: { application_id: string } }>, reply: FastifyReply): Promise<FastifyReply> {
      const accessToken = await getAccessToken(fastify, fastify.config.KEYCLOAK_CLIENT_ID, fastify.config.KEYCLOAK_CLIENT_SECRET)
      const headers = getHeaders(accessToken)
      const url = `clients-registrations/default/${request.params.application_id}`
      console.log("Keycloak request, url='DELETE %s', headers=%j", url, headers)
      const response = await fastify.httpClient.delete(
        url,
        { headers }
      )
      console.log("Keycloak response, code=%d, data=%j", response.status, response.data)
      return reply.code(204).send()
    }
  })

  //-----------------------------------------------------------
  // Refresh the 'client_secret' of a 'client' / 'Application'
  //-----------------------------------------------------------
  fastify.route({
    url: '/:application_id/new-secret',
    method: 'POST',
    handler: async function (request: FastifyRequest<{ Params: { application_id: string } }>, reply: FastifyReply): Promise<FastifyReply> {
      const accessToken = await getAccessToken(fastify, fastify.config.KEYCLOAK_CLIENT_ID, fastify.config.KEYCLOAK_CLIENT_SECRET)
      const headers = getHeaders(accessToken)
      let url = `clients/${request.params.application_id}/client-secret`

      console.log("Keycloak request, url='POST %s', headers=%j", url, headers)
      // Call the POST '/client-secret' which regenerates the secret
      let response = await fastify.httpClient.post(
        new URL(url,getAdminDomain(fastify.config.KEYCLOAK_DOMAIN)).toString(),
        {},
        { headers }
      )
      console.log("Keycloak response, code=%d, data=%j", response.status, response.data)

      // Call the GET '/client-secret' which gets the secret
      url = `clients/${request.params.application_id}/client-secret`
      console.log("Keycloak request, url='POST %s', headers=%j", url, headers)
      response = await fastify.httpClient.get(
        new URL(url,getAdminDomain(fastify.config.KEYCLOAK_DOMAIN)).toString(),
        { headers }
      )
      console.log("Keycloak response, code=%d, data=%j", response.status, response.data)

      return reply.code(200).send({
        client_id: request.params.application_id,
        client_secret: response.data.value
      })
    }
  })

  fastify.route({
    url: '/:application_id/event-hook',
    method: 'POST',
    schema: {
      body: EventHookSchema
    },
    handler: async function (request: FastifyRequest<{ Params: { application_id: string }, Body: { EventHook } }>, reply: FastifyReply): Promise<FastifyReply> {
      var url = `/${request.params.application_id}/event-hook`
      console.log("Keycloak request, url='POST /%s', body=%j", url, request.body)
      return reply.code(200).send()
    }
  })

  next()
}

/**
 * Generates the required HTTP Headers to communicate with Okta Api
 * @param token Okta DCR token
 * @returns http headers
 */
function getHeaders (token: string) {
  return {
    Authorization: 'Bearer ' + token,
    accept: 'application/json',
    'Content-Type': 'application/json'
  }
}

//-----------------------------------------------------------------------
// Add the 'Authorization: Basic base64(client_id:client_secret)' header
//-----------------------------------------------------------------------
function getAuthBasicHeaders (client_id: string, client_secret: string) {
  var data = client_id + ':' + client_secret
  var buff = Buffer.from(data)
  var base64data = buff.toString('base64')
  return {
    Authorization: 'Basic ' + base64data,
    accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded;'
  }
}

//-----------------------------------------------------------------------------
// Request on Keycloak an Authorization Header for the client_id:client_secret
//-----------------------------------------------------------------------------
async function getAccessToken (fastify: FastifyInstance, client_id: string, client_secret: string) {
  const headers = getAuthBasicHeaders (client_id, client_secret)
  const response = await fastify.httpClient.post(
    'protocol/openid-connect/token',
    {grant_type: "client_credentials"},
    { headers }
  )
  console.log(response.data)
  return response.data.access_token
}

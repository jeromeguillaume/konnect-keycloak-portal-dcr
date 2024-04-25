# Konnect Portal DCR Handler for keycloak
This repository is an implementation of an HTTP DCR bridge to enable [Dynamic Client Registration](https://docs.konghq.com/konnect/dev-portal/applications/dynamic-client-registration/) integration between the [Konnect Dev Portal](https://docs.konghq.com/konnect/dev-portal/) and Keycloak. The HTTP DCR bridge acts as a proxy and translation layer between Keycloak and DCR applications made in the Konnect Dev Portal.

This repository is forked from https://github.com/Kong/konnect-portal-dcr-handler. Please read the [README.md](https://github.com/Kong/konnect-portal-dcr-handler?tab=readme-ov-file) of this repo.

The HTTP DCR bridge is deployed as a serverless solution on AWS Lambda and it's based on a  lightweight [fastify](https://fastify.dev/) Node.js server.

## Prerequisites
### Git clone
Do a git clone of this repository

### Yarn
Install Yarn [^1.22.x](https://classic.yarnpkg.com/lang/en/docs/install)


### Keycloak configuration
1) Create an `Initial Access Token` for managing (from Konnect Dev Portal) the Application creation and **store the Initial AT**
![Alt text](/images/1-keycloak-Client-Registration-Initial-AT.png?raw=true "Client Registration Initial Access Token")

2) Create a `client`, called it for instance `kong-sa`, for managing (from Konnect Dev Portal) the application  deletion and the refresh token action. 
The properties are:
  - Client Protocol = `openid-connect`
  - Access Type = `confidential`
  - Service Accounts = `Enabled`
  - OAuth 2.0 Device Authorization Grant = `Enabled`
  - Valid Redirect URIs = `http//*` and `https://*`

  **Click on Save**

3) Open the `kong-sa` client, select `Service Account Roles` tab, select in `Client Roles` the `realm-management` and assign roles: 
      - `create-client`, 
      - `manage-clients`,
      - `query-clients`, 
      - `view-clients`
![Alt text](/images/2-keycloak-kong-sa.png?raw=true "kong-sa - Client Service Account")

### Lambda function
1) Create the Function
  - Connect to the AWS Console
  - Select the proper region (for instance `eu-central-1`)
  - Create a Lambda function with:
    - name =`konnect-portal-dcr-keycloak`
    - runtime = `Node.js 20.x`
    - Advanced settings / Enable function URL = `enabled`

**Click on Create function**

2) Open the Function
  - Change `Code` / `Runtime settings`: handler = `lambda.handler`
  - Change `Configuration`/`General configuration`: timeout = `10s`
  - Open `Configuration`/`Environment variables` and Edit:
    - KEYCLOAK_CLIENT_ID = `kong-sa`
    - KEYCLOAK_CLIENT_SECRET = `<kong-sa-client_secret-to-be-replaced>`
    - KEYCLOAK_CR_INITIAL_AT = `<initial_at-to-be-replaced>` (see step#1 - Keycloak configuration)
    - KEYCLOAK_DOMAIN = `<keycloak-domain-to-be-replaced>` (example: https://sso.apim.eu:8443/auth/realms/Jerome/)
    - KONG_API_TOKENS = `<your_Konnect_API_Key_value>` Put a random strong key value

**Click on Save**

See the Bridge Function URL (here: https://3w7r6pdhh6rgn7iia7sqotrdxm0hrspz.lambda-url.eu-west-3.on.aws/)
![Alt text](/images/3-AWS-Lambda-function.png?raw=true "AWS Lambda - creation")

### Konnect Gateway Service configuration
1) Have a Kong Konnect account
  - You can Start a Free trial at: [konghq.com](https://konghq.com/products/kong-konnect/register)
2) Login to konnect
3) Select Gateway Manager menu and open your `Gateway Manager`
4) Create a new `httpbin` Gateway Service with:
  - Name = `httpbin`
  - Upstream URL = `http://httpbin.apim.eu`

**Click on Save**

5) Create a new `httpbin` Route to the Gateway Service with:
  - Name = `httpbin`
  - Path = `/httpbin`

**Click on Save**


### Konnect Dev Portal configuration
1) Login to konnect
2) Select Dev Portal / Application Auth menu, select DCR Providers tab, click on `+ New DCR Provider` and configure with:
  - Name = `DCR Keycloak`
  - Issuer URL = `<keycloak-domain-to-be-replaced>`
  - Provider Type = `HTTP`
  - DCR Base URL = `<Bridge_Function_url-to-be-replaced>`
  - API Key = `<your_Konnect_API_Key_value>` Put the same vlue defined above
  
**Click on Save**
![Alt text](/images/4a-Konnect-New-DCR-Provider.png?raw=true "Konnect Dev Portal configuration - New DCR Provider")

3) Select Dev Portal / Application Auth menu, click on `+ New Auth Strategy` and configure with:
  - Name = `Auth DCR Keycloak`
  - Display Name = `Auth DCR Keycloak`
  - Auth Type = `DCR`
  - DCR Provider = `DCR Keycloak`
  - Scopes = `openid`
  - Credential Claims = `clientId`
  - Auth Method = `bearer` and `client_credentials`
    
**Click on Save**

![Alt text](/images/4b-Konnect-New-Auth.png?raw=true "Konnect Dev Portal configuration - New Auth Strategy")

4) Select API Products menu, click on `+ API Product` and configure with:
  - Product Name = `Httpbin`

**Click on Save**
![Alt text](/images/4c-Konnect-New-API-Product.png?raw=true "Konnect Dev Portal configuration - New API Product")
5) Select Product Versions menu, click on `+ New Version` and configure with:
  - Product Version Name = `v1`

**Click on Save**

6) Link with a Gateway Service by cicking on `+ Link`:
  - Select Control Plane = `Your Control Plane` stands for `Gateway Manager`
  - Gateway Service = `httpbin`

**Click on Save**

7) Update the `unpublished` Status to `published` and check `Publish API Product`

**Click on Save**

8) Update the `disabled` App Registration to `enabled` with:
  - Auth Strategy = `Auth DCR Keycloak`
  - App Registration Enabled
  
**Click on Save**
![Alt text](/images/4d-Konnect-App-Registration.png?raw=true "Konnect Dev Portal configuration - Edit App Registration")

### S3 Bucket
- Create a S3 bucket and call it for instance `konnect-portal-dcr-keycloak`
- The purpose of this bucket is to store the source code of the DCR Handler and to push it in the AWS Lambda Function
- **You don't need to upload** the `ambda-dcr-http.zip` manually: it will be done automatically by the CI workfow
![Alt text](/images/4-AWS-S3-bucket.png?raw=true "AWS S3 bucket")

## Test locally the DCR Handler

Install dependencies
```sh
yarn install --frozen-lockfile
```

Update the `.env` file as explained for Lambda Function

Start local instance
```sh
yarn start
```

The fastify server is started by default on port 3000

1) Create a new Application
- Request: `<DCR_token-to-be-replaced>`, `<portal_id-to-be-replaced>`, `<organization_id-to-be-replaced>` have to be replaced by their proper value. Go on Konnect / Dev Portal to get `portal_id` and `organization_id`
```sh
http POST :3000/ redirect_uris=http://localhost \
    x-api-key:<DCR_token-to-be-replaced> \
    client_name=jegvscode1 \
    application_description=\
    grant_types\[\]=authorization_code \
    grant_types\[\]=refresh_token \
    grant_types\[\]=implicit \
    token_endpoint_auth_method=client_secret_jwt \
    portal_id=<portal_id-to-be-replaced> \
    organization_id=<organization_id-to-be-replaced>
```
- Response:
```sh
HTTP/1.1 201 Created
...
{
    "client_id": "f54b9dc4-ee16-4a99-bfc9-4107ae73d6a4",
    "client_id_issued_at": 1705399806,
    "client_secret": "istHTAPMMFLRDPT83dPfDCHOZH7cLV6V",
    "client_secret_expires_at": 0
}
```
Check on Keycloak the creation of this new `client`

2) Refresh a `client_secret` of an Application
- Request:
```sh
http POST :3000/f54b9dc4-ee16-4a99-bfc9-4107ae73d6a4/new-secret x-api-key:<DCR_token-to-be-replaced>
```
- Response:
```sh
HTTP/1.1 200 OK
...
{
    "client_id": "f54b9dc4-ee16-4a99-bfc9-4107ae73d6a4",
    "client_secret": "JJrUI01URnL863GRyTIIsdFeTrkDVbMj"
}
```
Check on Keycloak the value of the new `client_secret`

3) Delete an Application
- Request:
```sh
http DELETE :3000/f54b9dc4-ee16-4a99-bfc9-4107ae73d6a4 x-api-key:<DCR_token-to-be-replaced>
```
- Response:
```sh
HTTP/1.1 204 No Content
```
Check on Keycloak the deletion of this `client`

## Deploy the DCR Handler to the Lambda Function
- The Git Workflow [ci.yml](.github/workflows/ci.yml) pushes the DCR Handler code in the Lambda Function.
- Prepare and start a `self-hosted` Github Runner: open with the browser your Github repo and select Settings / Actions / Runners and click on `New self-hosted runner` 
- Create Environment secrets: select Settings / Secrets and variables / Environment secrets with:
  - AWS_ROLE_NAME: `<function_arn-to-be-replaced>` (example: `arn:aws:lambda:eu-west-3:162225303348:function:konnect-portal-dcr-keycloak`)
  - BUCKET_NAME: `konnect-portal-dcr-keycloak`
  - FUNCTION_NAME: `konnect-portal-dcr-keycloak`
![Alt text](/images/5-Github-Environment-secrets.png?raw=true "GitHub - Environment secrets")
- Connect to AWS cli (for the `self-hosted` runner)
```sh
aws sso login
```
- Do a Commit & Push of your repo, check in GitHub the green status of your CI workflow

## Test from Konnect Dev Portal the DCR Handler
1) Login to Konnect Dev Portal
2) Click on `My Apps` under your profile name
3) Click on `New App`
![Alt text](/images/6-Konnect-DevPortal-NewApp.png?raw=true "Konnect Dev Portal - New App")
4) Click on `Create`
![Alt text](/images/7-Konnect-DevPortal-NewApp.png?raw=true "Konnect Dev Portal - New client_id/client_secret")
5) Go on Keycloak and check the new Client
![Alt text](/images/8-Keycloak-NewClient.png?raw=true "Keycloak - New client")
6) Go on Catalog, Select a Service and Register it to the new App
7) Test access 
- Request:
```sh
http -a 1d2d6ea6-b409-4583-a0f1-8413d8603359:pW1qkzutE6czuO78oTL2GRSkEq8HL05l :8000/myhttpbin/anything
```
- Response:
```sh
HTTP/1.1 200 OK
...
{
    "args": {},
    "data": "",
    "files": {},
    "form": {},
    "headers": {
        "Accept": "*/*",
        "Authorization": "Bearer ABCDEF...."
    },
    "json": null,
    "method": "GET",
    "url": "https://localhost/anything"
}
```
8) Test the Refresh secret
- Select `My App`
- Select `Refresh secret` menu
![Alt text](/images/9-Konnect-Refresh-secret.png?raw=true "Konnect Dev Portal - Refresh secret")
9) Go on Keycloak and check the new value of `client_secret` value`
![Alt text](/images/10-Keycloak-Secret.png?raw=true "Keycloak - Refresh secret")
10) Delete the App
- Select `My App`
- Select `Delete`
![Alt text](/images/11-Konnect-DevPortal-DeleteApp.png?raw=true "Konnect Dev Portal - Delete App")
11) Go on Keycloak and check that the client is no longer present
![Alt text](/images/12-Keycloak-AppDeleted.png?raw=true "Keycloak - Deleted App")

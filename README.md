# Konnect Portal DCR Handler for keycloak

## Introduction
This repository is an implementation of an HTTP DCR bridge to enable [Dynamic Client Registration](https://developer.konghq.com/dev-portal/dynamic-client-registration/#configure-a-custom-idp-for-dynamic-client-registration) integration between the [Konnect Dev Portal](https://developer.konghq.com/dev-portal/) and Keycloak. The HTTP DCR bridge acts as a proxy and translation layer between Keycloak and DCR applications made in the Konnect Dev Portal.

The HTTP DCR bridge can be built and deployed in 3 ways:
  1) As **plugins** on Kong Gateway (Serverless/Dedicated Cloud Gateway/self-hosted)
  2) As a Serverless solution on **AWS Lambda**
  3) As a **Container** deployed on Docker / Kubernetes / OpenShift

Select the best option in regards your technical environment

---
**Index Table**:
1. [Introduction](#introduction)
2. [Prerequisites for all deployments](#prerequisites-for-all-deployments)
3. [Kong Gateway plugins (as an HTTP DCR Bridge)](#kong-gateway-plugins-as-an-http-dcr-bridge)
4. [AWS Lambda (as an HTTP DCR Bridge)](#aws-lambda-as-an-http-dcr-bridge)
5. [Container (as an HTTP DCR Bridge)](#container-as-an-http-dcr-bridge)
6. [Konnect configuration](#konnect-configuration)
7. [Test the Bridge from Konnect Dev Portal](#test-the-bridge-from-konnect-dev-portal)
8. [Other material](#other-material)

## Prerequisites for all deployments

### Httpie
Install [Httpie](https://httpie.io/cli)

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

**Click on Save**
![Alt text](/images/2-keycloak-kong-sa.png?raw=true "kong-sa - Client Service Account")

## Kong Gateway plugins (as an HTTP DCR Bridge)

### Prerequisites

#### Git clone
Git clone this repository
```shell
git clone https://github.com/jeromeguillaume/konnect-keycloak-portal-dcr.git
```

#### Choose a Kong Gateway deployment
Choose a type of Kong Gateway from this list:
1) Serverless: [Doc](https://developer.konghq.com/gateway/topology-hosting-options/#serverless-gateways)
2) Dedicated Cloud Gateway: [Doc](https://developer.konghq.com/gateway/topology-hosting-options/#dedicated-cloud-gateways)
3) Self-hosted: [Doc](https://developer.konghq.com/gateway/install/)

Select the best option in regards your technical environment. The Gateway self-hosted deployment needs to be reachable by Konnect by using a public IP or public FQDN. For the rest of the document **we use a Serverless Kong Gateway**

#### Install decK
See installation [doc](https://developer.konghq.com/deck/?tab=windows#install-deck)

### Deploy the bridge (plugins) on a Serverless Kong Gateway
1) Have a Kong Konnect account
    - You can Start a Free trial at: [konghq.com](https://konghq.com/products/kong-konnect/register)
2) Login to [konnect](https://cloud.konghq.com)
3) Select the `API Gateway` / `Gateways` menu
4) Create a new Serverless Gateway
    - Menu `New` / `+ New API Gateway`
    - Select Serverless with:
      -  Gateway name: `DCR Bridge`
5) Apply the deck configuration:
    - Open a termninal
    - Set the environment variables:
    ```shell
    export DECK_KEYCLOAK_CR_INITIAL_AT=<initial_at-to-be-replaced> #see step#1 - Keycloak configuration
    export DECK_KEYCLOAK_CLIENT_ID=kong-sa
    export DECK_KEYCLOAK_CLIENT_SECRET=<kong-sa-client_secret-to-be-replaced>
    export DECK_KEYCLOAK_REALM=<realm_to_be_replaced> # Example: Jerome
    export DECK_KEYCLOAK_DOMAIN=<keyclocak_domain_to_be_replaced>   # Example: https://sso.apim.eu:8443 (without /auth/realms/Jerome/)
    export DECK_KONG_API_TOKENS=<your_Konnect_API_Key_value>
    ```
    - Execute the deck command:
    ```shell
    cd ./kong-gw
    deck gateway sync --konnect-token $KONNECT_TOKEN --konnect-addr https://eu.api.konghq.com --konnect-control-plane-name "DCR Bridge" --select-tag keycloak-dcr kong-keycloak-dcr.yaml
    ```
  6) Get the `<Bridge_Function_url-to-be-replaced>` used below in the document
    - Get the proxy URL of the Serverless Gateway:
      - Select the `API Gateway` / `Gateways` menu
      - Copy your Proxy URL (for example: `https://kong-85c543c6b2euehaj7.kongcloud.dev`)
      - Add `/dcr/keycloak` to your bridge path. So for instance, the Bridge Function URL related to `<Bridge_Function_url-to-be-replaced>` is `https://kong-85c543c6b2euehaj7.kongcloud.dev/dcr/keycloak`

    
## AWS Lambda (as an HTTP DCR Bridge)

### Prerequisites
This repository is forked from https://github.com/Kong/konnect-portal-dcr-handler. Please read the [README.md](https://github.com/Kong/konnect-portal-dcr-handler?tab=readme-ov-file) of this repo. 

The HTTP DCR bridge is based on a lightweight [fastify](https://fastify.dev/) Node.js server

#### Fork this repository
Fork this repository

#### Git clone (your forked repository)
Do a git clone of your forked repository
```shell
git clone https://github.com/<**YOUR_NAME**>/konnect-keycloak-portal-dcr.git
```

#### Yarn
Install Yarn [^1.22.x](https://classic.yarnpkg.com/lang/en/docs/install)

### Build the AWS Lambda
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

    See the Bridge Function URL related to `<Bridge_Function_url-to-be-replaced>` (here: https://3w7r6pdhh6rgn7iia7sqotrdxm0hrspz.lambda-url.eu-west-3.on.aws/)
    ![Alt text](/images/3-AWS-Lambda-function.png?raw=true "AWS Lambda - creation")

3) AWS S3 Bucket
    - Create a S3 bucket and call it for instance `konnect-portal-dcr-keycloak`
    - The purpose of this bucket is to store the source code of the DCR Handler and to push it in the AWS Lambda Function
    - **You don't need to upload** the `ambda-dcr-http.zip` manually: it will be done automatically by the CI workfow
![Alt text](/images/4-AWS-S3-bucket.png?raw=true "AWS S3 bucket")

### Optional: test locally the HTTP DCR Bridge
if you don't want to test locally the Bridge you can skip this section and go to [Deploy the bridge on AWS Lambda Function](#Deploy_the_bridge_on_AWS_Lambda_Function)

The fastify server is started by default on port 3000

#### Locally deploy on the computer OS
1) Install dependencies
```shell
yarn install --frozen-lockfile
```

2) Create an `.env` file at the root of this project, get the following content and **replace the strings enclosed by < >**:
```shell
KEYCLOAK_CR_INITIAL_AT=<initial_at-to-be-replaced>
KEYCLOAK_CLIENT_ID=kong-sa
KEYCLOAK_CLIENT_SECRET=<kong-sa-client_secret-to-be-replaced>
# example: https://sso.apim.eu:8443/auth/realms/Jerome/
KEYCLOAK_DOMAIN=<keycloak-domain-to-be-replaced>
KONG_API_TOKENS=<your_Konnect_API_Key_value>
```

3) Start local instance
```shell
yarn start
```

#### Test locally
1) Create a new Application
  - Request: replace `<your_Konnect_API_Key_value>`, `<portal_id-to-be-replaced>`, `<organization_id-to-be-replaced>` by their proper value. Go on Konnect / Dev Portal to get `portal_id` and `organization_id`
  ```shell
  http POST :3000/ redirect_uris=http://localhost \
      x-api-key:<your_Konnect_API_Key_value> \
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
  ```shell
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
```shell
http POST :3000/f54b9dc4-ee16-4a99-bfc9-4107ae73d6a4/new-secret x-api-key:<your_Konnect_API_Key_value>
```
- Response:
```shell
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
```shell
http DELETE :3000/f54b9dc4-ee16-4a99-bfc9-4107ae73d6a4 x-api-key:<your_Konnect_API_Key_value>
```
- Response:
```shell
HTTP/1.1 204 No Content
```
Check on Keycloak the deletion of this `client`

### Deploy the bridge on AWS Lambda Function
- The Git Workflow [ci.yml](.github/workflows/ci.yml) pushes the DCR Handler code in the Lambda Function.
- Prepare and start a `self-hosted` Github Runner: open with the browser your Github repo and select Settings / Actions / Runners and click on `New self-hosted runner` 
- Create Environment secrets: select Settings / Secrets and variables / Environment secrets with:
  - Environment: `dev` with those variables:
    - AWS_ROLE_NAME: `<function_arn-to-be-replaced>` (example: `arn:aws:lambda:eu-west-3:162225303348:function:konnect-portal-dcr-keycloak`)
    - BUCKET_NAME: `konnect-portal-dcr-keycloak`
    - FUNCTION_NAME: `konnect-portal-dcr-keycloak`
![Alt text](/images/5-Github-Environment-secrets.png?raw=true "GitHub - Environment secrets")
- Connect to AWS cli (for the `self-hosted` runner)
```shell
aws sso login
```
- Do a Commit & Push of your repo, check in GitHub the green status of your CI workflow

## Container (as an HTTP DCR Bridge)
If you want to build a Docker image (for the HTTP DCR bridge) for enabling a Kubernetes/OpenShift deployment, install [Docker](https://docs.docker.com/engine/install/)

### Prerequisites
See prerequisites of [AWS Lambda](#prerequisites-1)

### Build the Docker image
- Build and Push the Docker image for linux/arm64 and linux/amd64
```shell
cd konnect-keycloak-portal-dcr
docker buildx create --use --platform=linux/amd64,linux/arm64 --name multi-platform-builder
docker buildx build --push --platform linux/amd64,linux/arm64 --tag jeromeguillaume/konnect-keycloak-portal-dcr:1.2 .
```

### Optional: test locally the HTTP DCR Bridge
if you don't want to test locally the Bridge you can skip this section and go to [Deploy the HTTP DCR Bridge](#deploy-the-http-dcr-bridge)

The fastify server is started by default on port 3000

#### Test locally
- See AWS Lambda [test locally](#test-locally)

#### Deploy locally on the computer OS
- Start HTTP DCR Bridge on Docker
```shell
docker run -p 3000:3000 -d \
--name konnect-keycloak-portal-dcr \
--platform linux/amd64 \
-e "KEYCLOAK_CR_INITIAL_AT=<initial_at-to-be-replaced>" \
-e "KEYCLOAK_CLIENT_ID=kong-sa" \
-e "KEYCLOAK_CLIENT_SECRET=<kong-sa-client_secret-to-be-replaced>" \
-e "KEYCLOAK_DOMAIN=<keycloak-domain-to-be-replaced>" \
-e "KONG_API_TOKENS=<your_Konnect_API_Key_value>" \
jeromeguillaume/konnect-keycloak-portal-dcr:1.2
```

### Deploy the Bridge on Kubernetes / OpenShift with the Docker image
1) Create an `.env` file at the root of this project
  - See [Test locally the HTTP DCR Bridge](#optional-test-locally-the-http-dcr-bridge) for having the content

2) Create the Secret
```shell
cd konnect-keycloak-portal-dcr
```
```shell
kubectl create secret generic sec-konnect-keycloak-portal-dcr --from-env-file=.env
```

3) Create the Deployment and Service (as a LoadBlancer)
See [konnect-keycloak-portal-dcr.yaml](kubernetes/konnect-keycloak-portal-dcr.yaml)
```shell
kubectl create -f kubernetes/konnect-keycloak-portal-dcr.yaml
```

The results should look like this:
```
deployment.apps/konnect-portal-dcr-keycloak created
service/svc-konnect-portal-dcr-keycloak created
```
**Keep in mind that the Bridge listens on HTTP an not HTTPS. The bridge has to be secured by the Kong Gateway**

4) Get the URL of the Bridge
```shell
kubectl get svc svc-konnect-portal-dcr-keycloak -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```
It's the Bridge Function URL related to `<Bridge_Function_url-to-be-replaced>`

## Konnect configuration
First deploy a Gateway Service then configure the new DCR provider and finally publish the API in the Developer Portal

### Konnect Gateway Service configuration
1) Have a Kong Konnect account
    - You can Start a Free trial at: [konghq.com](https://konghq.com/products/kong-konnect/register)
2) Login to [konnect](https://cloud.konghq.com)
3) Select the `API Gateway` / `Gateways` menu
4) Select your Gateway or Create a new Gateway
5) Create a new `httpbin` Gateway Service with:
    - Name = `httpbin`
    - Upstream URL = `http://httpbin.apim.eu`

**Click on Save**

5) Create a new `httpbin` Route to the Gateway Service with:
    - Name = `httpbin`
    - Path = `/httpbin`

**Click on Save**

### Konnect Dev Portal configuration
1) Login to [konnect](https://cloud.konghq.com)
2) Select Dev Portal / Application Auth menu, select DCR Providers tab, click on `+ New DCR Provider` and configure with:
    - Name = `DCR Keycloak`
    - Issuer URL = `<keycloak-domain-to-be-replaced>`
    - Provider Type = `HTTP`
    - DCR Base URL = `<Bridge_Function_url-to-be-replaced>`
    - API Key = `<your_Konnect_API_Key_value>` - Put the same value defined before
  
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

4) Select Catalog and APIs menu, click on `+ New API` and configure with:
    - API Spec = [httpbin.apim.eu.json](/httpbinOAS/httpbin.apim.eu.json)
    
![Alt text](/images/4c-Konnect-New-API.png?raw=true "Konnect Dev Portal configuration - New API Product")

**Click on Create**

5) Click on `Link a gateway service`

**Click on Save**

6) Click on `Publish to a Portal`

![Alt text](/images/4d-Konnect-App-Registration.png?raw=true "Konnect Dev Portal configuration - Edit App Registration")
**Click on Publish API**


## Test the Bridge from Konnect Dev Portal
This test applies for 3 types of Bridge deployment: Kong Gateway plugins, AWS Lambda or Container

1. Login to Konnect Dev Portal
2. Click on `My Apps` under your profile name
3. Click on `New App`
4. Set the values as shown and click on `Create`
![Alt text](/images/6-Konnect-DevPortal-NewApp.png?raw=true "Konnect Dev Portal - New App")
5. Copy the `client_id` and `client_secret` and click on `Proceed`
![Alt text](/images/7-Konnect-DevPortal-NewApp.png?raw=true "Konnect Dev Portal - New client_id/client_secret")
6. Go on Keycloak and check the new Client
![Alt text](/images/8-Keycloak-NewClient.png?raw=true "Keycloak - New client")
7. Go on Catalog, Select a Service and Register it to the new App
8. Test access to the API published on the DevPortal by using the new `client_id` and `client_secret`
- Request:
```shell
http -a 1d2d6ea6-b409-4583-a0f1-8413d8603359:pW1qkzutE6czuO78oTL2GRSkEq8HL05l :8000/httpbin/anything
```
- Response:
```shell
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
9. Test the Refresh secret
- Select `My App`
- Select `Refresh secret` menu
![Alt text](/images/9-Konnect-Refresh-secret.png?raw=true "Konnect Dev Portal - Refresh secret")
10. Go on Keycloak and check the new value of `client_secret` value`
![Alt text](/images/10-Keycloak-Secret.png?raw=true "Keycloak - Refresh secret")
11. Delete the App
- Select `My App`
- Select `Delete`
![Alt text](/images/11-Konnect-DevPortal-DeleteApp.png?raw=true "Konnect Dev Portal - Delete App")
11) Go on Keycloak and check that the client is no longer present
![Alt text](/images/12-Keycloak-AppDeleted.png?raw=true "Keycloak - Deleted App")

## Other material
see in [notes.txt](notes.txt) example of commands to call directly Keycloak APIs
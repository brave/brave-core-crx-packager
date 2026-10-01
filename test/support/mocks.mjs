// Module interception is installed at cucumber load time (top-level await),
// before any step lazily imports a real module.
import quibble from 'quibble'
import * as mockS3 from './mock-s3.mjs'
import * as mockDynamoDB from './mock-dynamodb.mjs'
import * as mockSentry from './mock-sentry.mjs'

await quibble.esm('@aws-sdk/client-s3', { ...mockS3 })
await quibble.esm('@aws-sdk/client-dynamodb', { ...mockDynamoDB })
await quibble.esm('@sentry/node', { ...mockSentry })

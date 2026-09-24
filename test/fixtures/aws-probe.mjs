// Probe fixture: imports the REAL specifiers (which quibble has replaced)
// and constructs clients, proving interception is genuinely installed.
import { S3Client } from '@aws-sdk/client-s3'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'

export function probeAWS () {
  return {
    s3: new S3Client({ signatureVersion: 'v4' }),
    dynamodb: new DynamoDBClient({ region: 'us-east-1' })
  }
}

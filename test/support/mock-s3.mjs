// Fake @aws-sdk/client-s3. Records every constructed client and every sent
// command; replies are scripted per scenario via mockState().s3.replies,
// keyed by command name.
import { mockState } from './state.mjs'

function makeCommand (name) {
  const Command = class {
    constructor (input) {
      this.input = input
    }
  }
  Object.defineProperty(Command, 'name', { value: name })
  return Command
}

export const GetObjectCommand = makeCommand('GetObjectCommand')
export const HeadObjectCommand = makeCommand('HeadObjectCommand')
export const PutObjectCommand = makeCommand('PutObjectCommand')
export const PutObjectTaggingCommand = makeCommand('PutObjectTaggingCommand')

export class S3Client {
  constructor (opts) {
    mockState().s3.constructorArgs.push(opts)
  }

  async send (command) {
    const state = mockState().s3
    state.sendCalls.push({ command: command.constructor.name, input: command.input })
    const reply = state.replies[command.constructor.name]
    if (reply && reply.error) throw reply.error
    return (reply && reply.value) || {}
  }
}

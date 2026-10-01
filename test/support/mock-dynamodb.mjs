// Fake @aws-sdk/client-dynamodb. Records every constructed client and every
// sent command; replies are scripted per scenario via mockState().dynamodb.replies.
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

export const CreateTableCommand = makeCommand('CreateTableCommand')
export const ListTablesCommand = makeCommand('ListTablesCommand')
export const PutItemCommand = makeCommand('PutItemCommand')
export const QueryCommand = makeCommand('QueryCommand')

export class DynamoDBClient {
  constructor (opts) {
    mockState().dynamodb.constructorArgs.push(opts)
  }

  async send (command) {
    const state = mockState().dynamodb
    state.sendCalls.push({ command: command.constructor.name, input: command.input })
    const reply = state.replies[command.constructor.name]
    if (reply && reply.error) throw reply.error
    return (reply && reply.value) || {}
  }
}

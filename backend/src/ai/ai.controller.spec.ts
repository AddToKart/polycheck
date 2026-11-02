import type { AiChatSendInput } from '@polycheck/shared'
import { ROLES_KEY } from '../common/decorators/roles.decorator'
import { AiController } from './ai.controller'

describe('AiController', () => {
  it('allows teachers, super admins, and students to chat', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AiController.prototype.send)).toEqual(['teacher', 'super_admin', 'student'])
    expect(Reflect.getMetadata(ROLES_KEY, AiController.prototype.capabilities)).toBeUndefined()
    expect(Reflect.getMetadata(ROLES_KEY, AiController.prototype.getThread)).toBeUndefined()
    expect(Reflect.getMetadata(ROLES_KEY, AiController.prototype.listThreads)).toBeUndefined()
    expect(Reflect.getMetadata(ROLES_KEY, AiController.prototype.deleteThread)).toBeUndefined()
  })

  it('delegates capabilities, thread reads, thread listing/deletion, and chat sends', async () => {
    const provider = { describe: jest.fn().mockResolvedValue({ enabled: true }) }
    const chat = {
      getThread: jest.fn().mockResolvedValue({ id: 'thread-1', messages: [] }),
      listThreads: jest.fn().mockResolvedValue([{ id: 'thread-1', title: 'Hello' }]),
      deleteThread: jest.fn().mockResolvedValue(true),
      start: jest.fn().mockResolvedValue({ threadId: 'thread-1', messageId: 'message-1' }),
    }
    const controller = new AiController(provider as never, chat as never)
    const request = { user: { id: 'teacher-1', role: 'teacher' as const } }
    const input: AiChatSendInput = { message: 'hello' }

    await expect(controller.capabilities(request as never)).resolves.toEqual({ enabled: true })
    expect(provider.describe).toHaveBeenCalledWith(request.user)
    await expect(controller.getThread('thread-1', request as never)).resolves.toEqual({ id: 'thread-1', messages: [] })
    await expect(controller.listThreads(request as never)).resolves.toEqual([{ id: 'thread-1', title: 'Hello' }])
    await expect(controller.deleteThread('thread-1', request as never)).resolves.toBe(true)
    await expect(controller.send(input, request as never)).resolves.toEqual({
      threadId: 'thread-1',
      messageId: 'message-1',
    })
    expect(chat.getThread).toHaveBeenCalledWith(request.user, 'thread-1')
    expect(chat.listThreads).toHaveBeenCalledWith(request.user)
    expect(chat.deleteThread).toHaveBeenCalledWith(request.user, 'thread-1')
    expect(chat.start).toHaveBeenCalledWith(request.user, input)
  })
})

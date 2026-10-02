import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { extractKnowlarityCallId } from './knowlarity-call-popup'
import {
  updateKnowlarityCallQueue,
  type CallQueueItem,
  type StreamCallEvent,
} from './knowlarity-call-queue'

const receivedAt = '2026-09-29T10:00:00.000Z'

function event(
  callId: string | null,
  state: StreamCallEvent['state'],
  leadId = 'same-patient'
): StreamCallEvent {
  return {
    callId,
    state,
    label: state,
    eventType: state,
    patientInfo: { found: true, leadId },
    receivedAt,
  }
}

function workspace(callId: string | null = null): StreamCallEvent {
  return { ...event(callId, 'on_call'), eventType: 'workspace_make_call' }
}

function apply(queue: CallQueueItem[], payload: StreamCallEvent, key = 'provisional') {
  return updateKnowlarityCallQueue(queue, payload, payload.callId || key)
}

function callIds(queue: CallQueueItem[]) {
  return queue.map((item) => item.event.callId)
}

describe('overlapping call popups', () => {
  it('keeps two incoming calls separate even for the same patient', () => {
    let queue = apply([], event('first', 'on_call'))
    queue = apply(queue, event('second', 'receiving_call'))
    assert.deepEqual(callIds(queue), ['second', 'first'])

    queue = apply(queue, event('first', 'call_finished'))
    assert.deepEqual(callIds(queue), ['second'])
    queue = apply(queue, event('first', 'call_finished'))
    assert.deepEqual(callIds(queue), ['second'])
    queue = apply(queue, event('second', 'call_finished'))
    assert.equal(queue.length, 0)
  })

  it('opens a second incoming popup while an outgoing call is active', () => {
    let queue = apply([], workspace('outgoing'))
    queue = apply(queue, event('incoming', 'receiving_call', 'another-patient'))
    assert.deepEqual(callIds(queue), ['incoming', 'outgoing'])
    queue = apply(queue, event('outgoing', 'call_finished'))
    assert.deepEqual(callIds(queue), ['incoming'])
  })

  it('opens a new call after the first ends and ignores its delayed end event', () => {
    let queue = apply([], event('first', 'on_call'))
    queue = apply(queue, event('first', 'call_finished'))
    assert.equal(queue.length, 0)
    queue = apply(queue, event('second', 'receiving_call'))
    queue = apply(queue, event('first', 'call_finished'))
    assert.deepEqual(callIds(queue), ['second'])
  })

  it('never closes a provisional outgoing popup using an older call for the same lead', () => {
    let queue = apply([], workspace(), 'second-popup')
    queue = apply(queue, event('first', 'call_finished'))
    assert.equal(queue.length, 1)
    assert.equal(queue[0].key, 'second-popup')
    assert.equal(queue[0].event.callId, null)
  })

  it('binds a provisional outgoing popup once and closes only that provider call', () => {
    let queue = apply([], workspace())
    queue[0].remarkText = 'First call notes'
    queue = apply(queue, event('first', 'on_call'))
    assert.equal(queue.length, 1)
    assert.equal(queue[0].remarkText, 'First call notes')
    queue = apply(queue, event('second', 'receiving_call'))
    assert.deepEqual(callIds(queue), ['second', 'first'])
    assert.equal(queue[0].remarkText, '')
    queue = apply(queue, { ...event('first', 'call_finished'), patientInfo: null })
    assert.deepEqual(callIds(queue), ['second'])
  })

  it('retains the provider identity across updates with no patient lookup', () => {
    let queue = apply([], workspace('first'))
    queue = apply(queue, { ...event('first', 'update'), patientInfo: null })
    assert.equal(queue[0].event.patientInfo?.leadId, 'same-patient')
    queue = apply(queue, { ...event('first', 'call_finished'), patientInfo: null })
    assert.equal(queue.length, 0)
  })

  it('does not guess which popup to close when an end event has no call ID', () => {
    let queue = apply([], event('first', 'on_call'))
    queue = apply(queue, event('second', 'receiving_call'))
    queue = apply(queue, event(null, 'call_finished'))
    assert.deepEqual(callIds(queue), ['second', 'first'])
  })

  it('does not bind an event ambiguously when two provisional calls share a patient', () => {
    let queue = apply([], workspace(), 'first-popup')
    queue = apply(queue, workspace(), 'second-popup')
    queue = apply(queue, event('provider', 'on_call'))
    assert.equal(queue.length, 3)
    assert.deepEqual(callIds(queue), ['provider', null, null])
    queue = apply(queue, event('provider', 'call_finished'))
    assert.deepEqual(callIds(queue), [null, null])
  })

  it('does not let an update for the first call overwrite the second call', () => {
    let queue = apply([], event('first', 'on_call'))
    queue = apply(queue, event('second', 'receiving_call'))
    queue = apply(queue, event('first', 'update'))
    assert.equal(queue[0].event.callId, 'second')
    assert.equal(queue[0].event.state, 'receiving_call')
  })
})

describe('provider call IDs', () => {
  it('uses the same ID extraction for make-call responses and stream events', () => {
    for (const key of ['uuid', 'unique_id', 'call_id', 'callId']) {
      assert.equal(extractKnowlarityCallId({ [key]: ' call-1 ' }), 'call-1')
      assert.equal(extractKnowlarityCallId({ data: { [key]: 'call-2' } }), 'call-2')
      assert.equal(extractKnowlarityCallId({ success: { [key]: 'call-3' } }), 'call-3')
    }
    assert.equal(extractKnowlarityCallId({ call_id: 123 }), '123')
    assert.equal(extractKnowlarityCallId({ status: 'success' }), null)
    assert.equal(extractKnowlarityCallId(null), null)
  })
})

import { describe, expect, it } from 'vitest'
import { buildCheilTaskPrompt, parseCheilTasks } from '../src/cheil-mail'

describe('Cheil fork: to-dos from a received mail', () => {
  it('asks for one JSON object of tasks, with today and the campaign', () => {
    const { system, user } = buildCheilTaskPrompt({
      mail: '안녕하세요. 시안 2안을 11월 3일까지 보내 주세요.',
      today: '2026-10-26',
      campaign: '에어린 봄 런칭',
      client: '가상전자',
    })
    expect(system).toContain('지어내지 않는다')
    expect(system).toContain('{"tasks"')
    expect(user).toContain('오늘: 2026-10-26')
    expect(user).toContain('캠페인: 에어린 봄 런칭 (광고주 가상전자)')
    expect(user).toContain('11월 3일까지')
  })

  it('keeps usable tasks only: a real day or none, one line, no repeats', () => {
    const tasks = parseCheilTasks(
      '```json\n' +
        JSON.stringify({
          tasks: [
            { task: '시안 2안\n송부', owner: '기획 3팀', due: '2026-11-03' },
            { task: '견적서 재송부', due: '2026-02-30' },
            { task: '시안 2안 송부', owner: 'x', due: '' },
            { task: '', due: '2026-11-04' },
            { task: '미팅 일정 회신', owner: 5, due: '11/05' },
            'not a task',
          ],
        }) +
        '\n```',
    )
    expect(tasks).toEqual([
      { task: '시안 2안 송부', owner: '기획 3팀', due: '2026-11-03' },
      { task: '견적서 재송부', owner: '', due: '' },
      { task: '미팅 일정 회신', owner: '', due: '' },
    ])
  })

  it('reads a bare array, and nothing from an answer that is not JSON', () => {
    expect(parseCheilTasks('[{"task":"회의록 공유","due":"2026-10-28"}]')).toEqual([
      { task: '회의록 공유', owner: '', due: '2026-10-28' },
    ])
    expect(parseCheilTasks('할 일이 없습니다')).toEqual([])
    expect(parseCheilTasks('{"tasks": []}')).toEqual([])
  })
})

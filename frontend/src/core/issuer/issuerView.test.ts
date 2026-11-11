import { describe, expect, it } from 'vitest'
import { actionsFor } from './issuerView'

describe('issuerView', () => {
  it('enables only the relevant action', () => {
    expect(actionsFor('authorized')).toEqual({ authorize: false, freeze: true })
    expect(actionsFor('partial')).toEqual({ authorize: true, freeze: true })
    expect(actionsFor('unauthorized')).toEqual({ authorize: true, freeze: false })
    expect(actionsFor('no-trustline')).toEqual({ authorize: false, freeze: false })
    expect(actionsFor('unknown')).toEqual({ authorize: true, freeze: true })
  })
})

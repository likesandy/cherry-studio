export interface Preferences {
  default: {
    test1: string
    test2: number
    test3: boolean
    test4: string[]
    test5: {
      content1: string
      content2: number
    }
  }
  user: {
    test1: string
    test2: number
    test3: boolean
  }
}

export const defaultPreferences: Preferences = {
  default: {
    test1: 'test1',
    test2: 1,
    test3: true,
    test4: ['test4-1', 'test4-2'],
    test5: {
      content1: 'test5-1',
      content2: 2
    }
  },
  user: {
    test1: 'test1',
    test2: 1,
    test3: false
  }
}

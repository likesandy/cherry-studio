/**
 * we should use sorted object keys
 * use `eslint --fix` to auto sort keys
 */

/* eslint @typescript-eslint/member-ordering: ["error", {
  "interfaces": { "order": "alphabetically" },
  "typeLiterals": { "order": "alphabetically" }
}] */
export interface PreferencesType {
  default: {
    'app.test5': {
      content1: string
      content2: number
    }
    'sys.a.test3': boolean
    'sys.a.test4': string[]
    'ui.a.test1': string
    'ui.b.test2': number
  }
}

/* eslint sort-keys: ["error", "asc", {"caseSensitive": true, "natural": false}] */
export const defaultPreferences: PreferencesType = {
  default: {
    'app.test5': {
      content1: 'test5-1',
      content2: 2
    },
    'sys.a.test3': true,
    'sys.a.test4': ['test4-1', 'test4-2'],
    'ui.a.test1': 'test1',
    'ui.b.test2': 1
  }
}

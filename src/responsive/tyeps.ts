export class EffectFunction extends Function {
  deps?: Array<Set<Function>>
  options?: Options
}

export interface Options {
  scheduler?(effectFn: Function): void
  lazy?: boolean
}

export interface WatchOptions {
  immediate?: boolean
}

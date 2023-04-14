import type { EffectFunction, Options, WatchOptions } from './tyeps'

// 用一个全局变量存储被注册的副作用函数
let activeEffect: EffectFunction
// effect栈
const effectStack: Array<Function> = []
// effect函数用于注册副作用函数
function effect(fn: Function, options?: Options) {
  const effectFn: EffectFunction = () => {
    // 调用clenup函数完成清除工作
    cleanup(effectFn)
    // 当调用effect注册副作用函数时，将副作用函数fn赋值给activeEffect
    activeEffect = effectFn
    // 在调用副作用函数前将当前副作用函数压入栈中
    effectStack.push(effectFn)
    // 执行副作用函数
    // 将fn的执行结果存储到res中
    const result = fn()
    // 在副作用函数执行完成后，将当前副作用函数弹出栈，并把activeEffect还原为之前的值
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]
    // 返回函数执行结果，实现getter功能
    return result
  }
  // 将options挂载到effectFn上
  effectFn.options = options
  // activeEffect.deps用来存储所有与该副作用函数相关联的依赖集合
  effectFn.deps = new Array<Set<Function>>()
  // 只有非lazy的时候才立即执行
  if (!options || !options.lazy) {
    effectFn()
  }
  // 将副作用函数作为返回值
  return effectFn
}

function cleanup(effectFn: EffectFunction) {
  // 遍历effectFn.deps数组
  for (const deps of effectFn.deps) {
    // 将effectFn从依赖集合中移除
    deps.delete(effectFn)
  }
  // 最后需要重制effectFn.deps数组
  effectFn.deps.length = 0
}

// 存储副作用函数的桶
const bucket = new WeakMap<object, Map<string | symbol, Set<Function>>>()

// 原始数据
const data: { [key: string | symbol]: any } = {
  ok: true,
  text: 'hello world',
  foo: 1,
  bar: 2,
}
// 对原始数据进行代理操作
const obj = new Proxy(data, {
  // 拦截读取操作
  get(target, key) {
    track(target, key)
    // 返回属性值
    return target[key]
  },
  // 拦截设置操作
  set(target, key, newValue) {
    // 设置属性值
    target[key] = newValue
    trigger(target, key)
    // 返回true代表操作成功
    return true
  },
})

function track(target: object, key: string | symbol) {
  // 如果没有activeEffect，直接return
  if (!activeEffect) return
  // 根据target从桶中取得despMap，他也是一个Map类型：key-->effects
  let depsMap = bucket.get(target)
  // 如果不存在despMap，那么新建一个Map并与target关联
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map<string | symbol, Set<Function>>()))
  }
  // 在根据key从depsMap中取得deps，他是一个Set类型
  // 里面存储着所有与当前key相关联的副作用函数：effects
  let deps = depsMap.get(key)
  if (!deps) {
    depsMap.set(key, (deps = new Set<Function>()))
  }
  // 把当前激活的副作用函数添加到依赖集合deps中
  deps.add(activeEffect)
  // deps就是一个与当前副作用函数存在联系的依赖集合
  // 将其添加到activeEffect.deps数组中
  activeEffect.deps.push(deps)
}

function trigger(target: object, key: string | symbol) {
  // 根据target从桶中取得despMap，他是key-->target
  const depsMap = bucket.get(target)
  if (!depsMap) return
  // 根据key取得所有副作用函数effects
  const effects = depsMap.get(key)
  // 执行副作用函数
  /**
   * 这种方式会导致无限循环
   * 在调用forEach遍历set集合时，如果一个值已经被访问过了，但该值被删除并重新添加到集合，如果此时forEach遍历没有结束，那么该值会被重新访问
   */
  // effects && effects.forEach((fn) => fn());
  // 解决方法
  const effectsToRun = new Set<EffectFunction>()
  effects &&
    effects.forEach(effectFn => {
      // 如果trigger触发执行的副作用函数与当前正在执行的副作用函数相同，则不触发执行
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  effectsToRun.forEach(effectFn => {
    // 如果一个副作用函数存在调度器，则调用该调度器，并将副作用函数作为参数传递
    if (effectFn.options && effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn)
    } else {
      // 否则直接执行副作用函数
      effectFn()
    }
  })
}

function computed(getter: Function) {
  // vlaue用来缓存上一次计算的值
  let value: any
  // dirty标志，用来标志数据是否需要重新计算值
  let dirty = true
  // 把getter作为副作用函数，创建一个lazy的effect
  const effectFn = effect(getter, {
    lazy: true,
    // 添加调度器，在调度器中将dirty重置为true
    scheduler() {
      if (!dirty) {
        dirty = true
        // 当计算属性依赖的响应式数据变化时，手动调用trigger函数触发响应
        trigger(obj, 'value')
      }
    },
  })
  const obj = {
    // 当读取value时才执行effectFn
    get value() {
      // 只有‘脏’时，才计算值
      if (dirty) {
        value = effectFn()
        // 将dirty设为false，下次访问直接返回缓存值
        dirty = false
      }
      // 当读取value时，手动调用track函数进行跟踪
      track(obj, 'value')
      return value
    },
  }
  return obj
}

function watch<T extends any>(
  source: T | Function,
  callback: (newValue: T, oldValue: T, onInvalidate?: Function) => void,
  options?: WatchOptions
) {
  // 定义getter
  let getter: Function
  // 如果source是函数，说明用户传的是getter
  if (typeof source === 'function') {
    getter = source
  } else {
    // 否则递归读取
    getter = () => traverse(source)
  }
  // 定义旧值与新值
  let oldValue: T, newValue: T

  // cleanup用来存储用户注册的过期回调
  let cleanup: Function
  // 定义onInvalidate函数
  function onInvalidate(fn: Function) {
    cleanup = fn
  }
  // 提取调度函数
  const scheduler = () => {
    newValue = effectFn()
    // 在调用回调函数之前，先调用过期回调
    cleanup && cleanup()
    // 当数据变化时，调用回调函数
    // 将onInvalidate作为回调函数的第三个参数使用，以便用户使用
    callback(newValue, oldValue, onInvalidate)
    oldValue = newValue
  }

  const effectFn = effect(() => getter(), {
    lazy: true,
    scheduler,
  })
  if (options.immediate) {
    // 当immediate为true时立即执行调度器，从而触发回调执行
    scheduler()
  } else {
    oldValue = effectFn()
  }
}

function traverse<T extends any>(value: T, seen = new Set()): T {
  // 如果要读取的数据是原始数据，或者已经被读取过了，那么什么都不做
  if (typeof value !== 'object' || value === null || seen.has(value)) return
  // 将数据添加到seen中，代表遍历地读取过了，避免循环引用引起的死循环
  seen.add(value)
  // 暂时不考虑数组等其他结构
  // 假设value就是一个对象，使用for-in读取对象的每一个值，并递归地调用traverse进行处理
  for (const k in value) {
    traverse(value[k], seen)
  }
  return value
}

effect(
  // 匿名副作用函数
  () => {
    console.log('effect run')
    document.querySelector('.responsive').innerHTML = obj.ok ? obj.text : 'not'
  }
)
setTimeout(() => {
  obj.ok = false
}, 1000)
setTimeout(() => {
  obj.text = 'hello vue3'
}, 2000)
setTimeout(() => {
  obj.ok = true
}, 3000)

const sumRes = computed(() => obj.foo + obj.bar)
effect(() => {
  console.log(sumRes.value)
})
obj.foo++

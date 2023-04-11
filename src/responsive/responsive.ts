/**
 * 嵌套的effect与effect栈
 */

import type { EffectFunction } from "./tyeps";

// 用一个全局变量存储被注册的副作用函数
let activeEffect: EffectFunction;
// effect栈
const effectStack: Array<Function> = [];
// effect函数用于注册副作用函数
function effect(fn: Function) {
  const effectFn = () => {
    // 调用clenup函数完成清除工作
    cleanup(effectFn);
    // 当调用effect注册副作用函数时，将副作用函数fn赋值给activeEffect
    activeEffect = effectFn;
    // 在调用副作用函数前将当前副作用函数压入栈中
    effectStack.push(effectFn);
    // 执行副作用函数
    fn();
    // 在副作用函数执行完成后，将当前副作用函数弹出栈，并把activeEffect还原为之前的值
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
  };
  // activeEffect.deps用来存储所有与该副作用函数相关联的依赖集合
  effectFn.deps = new Array<Set<Function>>();
  effectFn();
}

function cleanup(effectFn: EffectFunction) {
  // 遍历effectFn.deps数组
  for (const deps of effectFn.deps) {
    // 将effectFn从依赖集合中移除
    deps.delete(effectFn);
  }
  // 最后需要重制effectFn.deps数组
  effectFn.deps.length = 0;
}

// 存储副作用函数的桶
const bucket = new WeakMap<object, Map<string | symbol, Set<Function>>>();

// 原始数据
const data: { [key: string | symbol]: any } = { ok: true, text: "hello world" };
// 对原始数据进行代理操作
const obj = new Proxy(data, {
  // 拦截读取操作
  get(target, key) {
    track(target, key);
    // 返回属性值
    return target[key];
  },
  // 拦截设置操作
  set(target, key, newValue) {
    // 设置属性值
    target[key] = newValue;
    trigger(target, key);
    // 返回true代表操作成功
    return true;
  },
});

function track(target: object, key: string | symbol) {
  // 如果没有activeEffect，直接return
  if (!activeEffect) return;
  // 根据target从桶中取得despMap，他也是一个Map类型：key-->effects
  let depsMap = bucket.get(target);
  // 如果不存在despMap，那么新建一个Map并与target关联
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map<string | symbol, Set<Function>>()));
  }
  // 在根据key从depsMap中取得deps，他是一个Set类型
  // 里面存储着所有与当前key相关联的副作用函数：effects
  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set<Function>()));
  }
  // 把当前激活的副作用函数添加到依赖集合deps中
  deps.add(activeEffect);
  // deps就是一个与当前副作用函数存在联系的依赖集合
  // 将其添加到activeEffect.deps数组中
  activeEffect.deps.push(deps);
}

function trigger(target: object, key: string | symbol) {
  // 根据target从桶中取得despMap，他是key-->target
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  // 根据key取得所有副作用函数effects
  const effects = depsMap.get(key);
  // 执行副作用函数
  /**
   * 这种方式会导致无限循环
   * 在调用forEach遍历set集合时，如果一个值已经被访问过了，但该值被删除并重新添加到集合，如果此时forEach遍历没有结束，那么该值会被重新访问
   */
  // effects && effects.forEach((fn) => fn());
  // 解决方法
  const effectsToRun = new Set(effects);
  effectsToRun.forEach((fn) => fn());
}

effect(
  // 匿名副作用函数
  () => {
    console.log("effect run");
    document.querySelector(".responsive").innerHTML = obj.ok ? obj.text : "not";
  }
);
setTimeout(() => {
  obj.ok = false;
}, 1000);
setTimeout(() => {
  obj.text = "hello vue3";
}, 2000);

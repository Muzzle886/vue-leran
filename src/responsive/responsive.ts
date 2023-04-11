/**
 * 封装
 */

// 用一个全局变量存储被注册的副作用函数
let activeEffect: Function;
// effect函数用于注册副作用函数
function effect(fn: Function) {
  // 当调用effect注册副作用函数时，将副作用函数fn赋值给activeEffect
  activeEffect = fn;
  // 执行副作用函数
  fn();
}

// 存储副作用函数的桶
const bucket = new WeakMap<object, Map<string | symbol, Set<Function>>>();

// 原始数据
const data: { [key: string | symbol]: string } = { text: "hello world" };
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
  // 最后将当前激活的副作用函数添加到桶里
  deps.add(activeEffect);
}

function trigger(target: object, key: string | symbol) {
  // 根据target从桶中取得despMap，他是key-->target
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  // 根据key取得所有副作用函数effects
  const effects = depsMap.get(key);
  // 执行副作用函数
  effects && effects.forEach((fn) => fn());
}

effect(
  // 匿名副作用函数
  () => {
    console.log("effect run"); // 改进后只打印一次
    document.querySelector(".responsive").innerHTML = obj.text;
  }
);
setTimeout(() => {
  // 副作用函数中并没有读取notExist属性的值
  obj.notExist = "hello vue3";
}, 1000);

export default {};

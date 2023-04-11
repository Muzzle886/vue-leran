/**
 * 此版本主要对响应式系统进行测试，在响应式数据obj上设置一个不存在的属性
 * 我们没有在副作用函数与被操作的目标字段之间建立明确的联系，导致我们没有读取text属性但是副作用函数依旧被执行了，这是不正确的
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
const bucket = new Set<Function>();

// 原始数据
const data: { [key: string | symbol]: string } = { text: "hello world" };
// 对原始数据进行代理操作
const obj = new Proxy(data, {
  // 拦截读取操作
  get(target, key) {
    // 将副作用函数effect添加到储存副作用函数的桶中
    if (activeEffect) {
      bucket.add(activeEffect);
    }
    // 返回属性值
    return target[key];
  },
  // 拦截设置操作
  set(target, key, newValue) {
    // 设置属性值
    target[key] = newValue;
    // 把副作用函数从桶里取出并执行
    bucket.forEach((fn) => fn());
    // 返回true代表操作成功
    return true;
  },
});

effect(
  // 匿名副作用函数
  () => {
    console.log('effect run'); // 会打印两次
    document.querySelector(".responsive").innerHTML = obj.text;
  }
);
setTimeout(() => {
  // 副作用函数中并没有读取notExist属性的值
  obj.notExist = "hello vue3";
}, 1000);

export default {};

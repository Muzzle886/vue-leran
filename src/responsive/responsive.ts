// 存储副作用函数的桶
const bucket = new Set<Function>();

// 原始数据
const data: { [key: string | symbol]: string } = { text: "hello world" };
// 对原始数据进行代理操作
const obj = new Proxy(data, {
  // 拦截读取操作
  get(target, key) {
    // 将副作用函数effect添加到储存副作用函数的桶中
    bucket.add(effect);
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

// 副作用函数
function effect() {
  document.querySelector('.responsive').innerHTML = obj.text;
}

effect();
setTimeout(() => {
  obj.text = "hello vue3";
}, 1000);

export default {};

import type { VNode } from "./types";

function MyComponent(): VNode {
  return {
    tag: "div",
    props: {
      onClick: () => alert("click me"),
    },
    children: "click me",
  };
}

const vnode: VNode = {
  tag: MyComponent,
};

function renderer(vnode: VNode, container: Element | null) {
  if (typeof vnode.tag === "string") {
    // 说明vnode描述的是标签元素
    mountElement(vnode, container);
  } else if (typeof vnode.tag === "function") {
    // 说明vnode描述的是组件
    mountComponent(vnode, container);
  }
}

function mountElement(vnode: VNode, container: Element | null) {
  if (!container) {
    console.warn("container is null");
    return;
  }
  // 使用vnode.tag作为标签名称创建Dom元素
  const el = document.createElement(vnode.tag as string);
  // 遍历vnode.props，将属性、事件添加到DOM元素
  for (const key in vnode.props) {
    if (/^on/.test(key)) {
      // 如果key以on开头，说明他是事件
      el.addEventListener(key.substr(2).toLocaleLowerCase(), vnode.props[key]);
    }
  }

  // 处理children
  if (typeof vnode.children === "string") {
    // 如果children是字符串，说明它是父元素的文本子节点
    el.appendChild(document.createTextNode(vnode.children));
  } else if (Array.isArray(vnode.children)) {
    // 递归调用renderer函数渲染子节点，使用当前元素el作为挂载点
    vnode.children.forEach((child) => renderer(child, el));
  }

  // 将元素添加到挂载点下
  container.appendChild(el);
}

function mountComponent(vnode: VNode, container: Element | null) {
  // 原写法 const subtree = vnode.tag();
  // 由于需要类型断言，改为这样写
  // 调用组件函数，获取组件要渲染的内容（虚拟DOM）
  const tag = vnode.tag as Function
  const subtree = tag();
  renderer(subtree, container);
}

renderer(vnode, document.querySelector("#app"));

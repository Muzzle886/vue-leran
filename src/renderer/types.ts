export interface VNode {
  tag?: string | Component
  props?: any
  children?: string | VNode[]
}

export interface Component {
  render(): VNode
}

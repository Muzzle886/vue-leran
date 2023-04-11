export interface VNode {
  tag?: string|Function;
  props?: any;
  children?: string | VNode[];
}

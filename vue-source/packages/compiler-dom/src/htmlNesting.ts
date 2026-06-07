/**
 * Copied from https://github.com/MananTank/validate-html-nesting
 * with ISC license
 *
 * To avoid runtime dependency on validate-html-nesting
 * This file should not change very often in the original repo
 * but we may need to keep it up-to-date from time to time.
 */

/**
 * returns true if given parent-child nesting is valid HTML
 */
// 判断给定父子标签组合是否符合 HTML 规范。
export function isValidHTMLNesting(parent: string, child: string): boolean {
  // template 比较特殊，它在模板语义上可以包任意子节点。
  // if the parent is a template, it can have any child
  if (parent === 'template') {
    return true
  }

  // 如果这个父标签有“只能包含这些子标签”的白名单，直接按白名单判断。
  // if we know the list of children that are the only valid children for the given parent
  if (parent in onlyValidChildren) {
    return onlyValidChildren[parent].has(child)
  }

  // 如果这个子标签有“只能出现在这些父标签下”的白名单，也直接按白名单判断。
  // if we know the list of parents that are the only valid parents for the given child
  if (child in onlyValidParents) {
    return onlyValidParents[child].has(parent)
  }

  // 如果有父标签对应的黑名单，则检查当前 child 是否命中。
  // if we know the list of children that are NOT valid for the given parent
  if (parent in knownInvalidChildren) {
    // check if the child is in the list of invalid children
    // if so, return false
    if (knownInvalidChildren[parent].has(child)) return false
  }

  // 如果有子标签对应的父级黑名单，则检查当前 parent 是否命中。
  // if we know the list of parents that are NOT valid for the given child
  if (child in knownInvalidParents) {
    // check if the parent is in the list of invalid parents
    // if so, return false
    if (knownInvalidParents[child].has(parent)) return false
  }

  // 既不在白名单冲突里，也不在黑名单里时，默认认为合法。
  return true
}

// 所有标题标签的集合，后面用于限制 h1-h6 不能互相嵌套。
const headings = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
// 复用一个空集合，表示“没有任何合法子节点”或“没有任何合法父节点”。
const emptySet = new Set([])

/**
 * maps element to set of elements that can be it's children, no other */
// 某些父元素只能拥有指定类型的子元素，其他一律不合法。
const onlyValidChildren: Record<string, Set<string>> = {
  // head 中只能出现文档元信息相关标签。
  head: new Set([
    'base',
    'basefront',
    'bgsound',
    'link',
    'meta',
    'title',
    'noscript',
    'noframes',
    'style',
    'script',
    'template',
  ]),
  // optgroup 下面只能放 option。
  optgroup: new Set(['option']),
  // select 下可直接拥有 optgroup / option / hr。
  select: new Set(['optgroup', 'option', 'hr']),
  // table
  // table 结构必须遵循固定子标签集合。
  table: new Set(['caption', 'colgroup', 'tbody', 'tfoot', 'thead']),
  tr: new Set(['td', 'th']),
  colgroup: new Set(['col']),
  tbody: new Set(['tr']),
  thead: new Set(['tr']),
  tfoot: new Set(['tr']),
  // these elements can not have any children elements
  // 这些标签不允许再包含元素子节点。
  script: emptySet,
  iframe: emptySet,
  option: emptySet,
  textarea: emptySet,
  style: emptySet,
  title: emptySet,
}

/** maps elements to set of elements which can be it's parent, no other */
// 某些子元素只能挂在特定父元素下。
const onlyValidParents: Record<string, Set<string>> = {
  // sections
  // html 自身没有更高一级合法父节点。
  html: emptySet,
  body: new Set(['html']),
  head: new Set(['html']),
  // table
  td: new Set(['tr']),
  colgroup: new Set(['table']),
  caption: new Set(['table']),
  tbody: new Set(['table']),
  tfoot: new Set(['table']),
  col: new Set(['colgroup']),
  th: new Set(['tr']),
  thead: new Set(['table']),
  tr: new Set(['tbody', 'thead', 'tfoot']),
  // data list
  dd: new Set(['dl', 'div']),
  dt: new Set(['dl', 'div']),
  // other
  figcaption: new Set(['figure']),
  // li: new Set(["ul", "ol"]),
  summary: new Set(['details']),
  area: new Set(['map']),
} as const

/** maps element to set of elements that can not be it's children, others can */
// 某些父元素不能包含某些子元素，其余子元素默认允许。
const knownInvalidChildren: Record<string, Set<string>> = {
  // p 不能再包块级结构和某些会打断段落语义的标签。
  p: new Set([
    'address',
    'article',
    'aside',
    'blockquote',
    'center',
    'details',
    'dialog',
    'dir',
    'div',
    'dl',
    'fieldset',
    'figure',
    'footer',
    'form',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'header',
    'hgroup',
    'hr',
    'li',
    'main',
    'nav',
    'menu',
    'ol',
    'p',
    'pre',
    'section',
    'table',
    'ul',
  ]),
  // svg 子树不能直接混入大部分 HTML 普通文本流标签。
  svg: new Set([
    'b',
    'blockquote',
    'br',
    'code',
    'dd',
    'div',
    'dl',
    'dt',
    'em',
    'embed',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'i',
    'img',
    'li',
    'menu',
    'meta',
    'ol',
    'p',
    'pre',
    'ruby',
    's',
    'small',
    'span',
    'strong',
    'sub',
    'sup',
    'table',
    'u',
    'ul',
    'var',
  ]),
} as const

/** maps element to set of elements that can not be it's parent, others can */
// 某些子元素不能出现在特定父元素内部。
const knownInvalidParents: Record<string, Set<string>> = {
  // a / button / form 都不允许嵌套同类。
  a: new Set(['a']),
  button: new Set(['button']),
  dd: new Set(['dd', 'dt']),
  dt: new Set(['dd', 'dt']),
  form: new Set(['form']),
  li: new Set(['li']),
  // 标题标签之间不能互相嵌套。
  h1: headings,
  h2: headings,
  h3: headings,
  h4: headings,
  h5: headings,
  h6: headings,
}

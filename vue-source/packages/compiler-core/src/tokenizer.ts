/**
 * This Tokenizer is adapted from htmlparser2 under the MIT License listed at
 * https://github.com/fb55/htmlparser2/blob/master/LICENSE

Copyright 2010, 2011, Chris Winberry <chris@winberry.net>. All rights reserved.
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to
deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.
 */

import { ErrorCodes } from './errors'
import type { ElementNode, Position } from './ast'

/**
 * Note: entities is a non-browser-build-only dependency.
 * In the browser, we use an HTML element to do the decoding.
 * Make sure all imports from entities are only used in non-browser branches
 * so that it can be properly treeshaken.
 */
import {
  DecodingMode,
  EntityDecoder,
  fromCodePoint,
  htmlDecodeTree,
} from 'entities/decode'

export enum ParseMode {
  // BASE: compiler-core 纯基础模式；HTML/SFC 会打开更多特定语义。
  BASE,
  HTML,
  SFC,
}

export enum CharCodes {
  // 这里把状态机里高频判断的字符预先转成 char code，避免反复写字面量字符串。
  Tab = 0x9, // "\t"
  NewLine = 0xa, // "\n"
  FormFeed = 0xc, // "\f"
  CarriageReturn = 0xd, // "\r"
  Space = 0x20, // " "
  ExclamationMark = 0x21, // "!"
  Number = 0x23, // "#"
  Amp = 0x26, // "&"
  SingleQuote = 0x27, // "'"
  DoubleQuote = 0x22, // '"'
  GraveAccent = 96, // "`"
  Dash = 0x2d, // "-"
  Slash = 0x2f, // "/"
  Zero = 0x30, // "0"
  Nine = 0x39, // "9"
  Semi = 0x3b, // ";"
  Lt = 0x3c, // "<"
  Eq = 0x3d, // "="
  Gt = 0x3e, // ">"
  Questionmark = 0x3f, // "?"
  UpperA = 0x41, // "A"
  LowerA = 0x61, // "a"
  UpperF = 0x46, // "F"
  LowerF = 0x66, // "f"
  UpperZ = 0x5a, // "Z"
  LowerZ = 0x7a, // "z"
  LowerX = 0x78, // "x"
  LowerV = 0x76, // "v"
  Dot = 0x2e, // "."
  Colon = 0x3a, // ":"
  At = 0x40, // "@"
  LeftSquare = 91, // "["
  RightSquare = 93, // "]"
}

const defaultDelimitersOpen = new Uint8Array([123, 123]) // "{{"
const defaultDelimitersClose = new Uint8Array([125, 125]) // "}}"

/** All the states the tokenizer can be in. */
export enum State {
  // 文本区：默认状态，持续读取普通文本。
  Text = 1,

  // 插值：匹配开始分隔符、扫描内容、匹配结束分隔符。
  InterpolationOpen,
  Interpolation,
  InterpolationClose,

  // 标签：开始标签、结束标签、自闭合标签。
  BeforeTagName, // After <
  InTagName,
  InSelfClosingTag,
  BeforeClosingTagName,
  InClosingTagName,
  AfterClosingTagName,

  // 属性/指令：属性名、指令名、参数、修饰符、属性值。
  BeforeAttrName,
  InAttrName,
  InDirName,
  InDirArg,
  InDirDynamicArg,
  InDirModifier,
  AfterAttrName,
  BeforeAttrValue,
  InAttrValueDq, // "
  InAttrValueSq, // '
  InAttrValueNq,

  // 声明：例如 `<!DOCTYPE ...>` 或 `<![CDATA[ ... ]]>`
  BeforeDeclaration, // !
  InDeclaration,

  // 处理指令：例如 `<?xml ... ?>`
  InProcessingInstruction, // ?

  // 注释 / CDATA
  BeforeComment,
  CDATASequence,
  InSpecialComment,
  InCommentLike,

  // 特殊标签：script/style/title/textarea 需要切换成 RAWTEXT/RCDATA 行为。
  BeforeSpecialS, // Decide if we deal with `<script` or `<style`
  BeforeSpecialT, // Decide if we deal with `<title` or `<textarea`
  SpecialStartSequence,
  InRCDATA,

  InEntity,

  InSFCRootTagName,
}

/**
 * HTML only allows ASCII alpha characters (a-z and A-Z) at the beginning of a
 * tag name.
 */
function isTagStartChar(c: number): boolean {
  // 标签名首字符只允许 ASCII 字母，这里遵循 HTML tokenizer 规则。
  return (
    (c >= CharCodes.LowerA && c <= CharCodes.LowerZ) ||
    (c >= CharCodes.UpperA && c <= CharCodes.UpperZ)
  )
}

export function isWhitespace(c: number): boolean {
  // 这里定义“模板解析里的空白字符”，会在大量状态分支中复用。
  return (
    c === CharCodes.Space ||
    c === CharCodes.NewLine ||
    c === CharCodes.Tab ||
    c === CharCodes.FormFeed ||
    c === CharCodes.CarriageReturn
  )
}

function isEndOfTagSection(c: number): boolean {
  // 读到 `/`、`>` 或空白时，都意味着标签名/属性名这一段该停了。
  return c === CharCodes.Slash || c === CharCodes.Gt || isWhitespace(c)
}

export function toCharCodes(str: string): Uint8Array {
  // 某些特殊结束序列要逐字符比较，预先转成 Uint8Array 会更高效。
  const ret = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) {
    ret[i] = str.charCodeAt(i)
  }
  return ret
}

export enum QuoteType {
  // 属性值闭合方式：
  // NoValue 表示无值属性，Unquoted 表示无引号属性值。
  NoValue = 0,
  Unquoted = 1,
  Single = 2,
  Double = 3,
}

export interface Callbacks {
  // tokenizer 只负责切 token，不直接创建 AST。
  // 真正的节点组装都通过这些回调交给 parser.ts 完成。
  ontext(start: number, endIndex: number): void
  ontextentity(char: string, start: number, endIndex: number): void

  oninterpolation(start: number, endIndex: number): void

  onopentagname(start: number, endIndex: number): void
  onopentagend(endIndex: number): void
  onselfclosingtag(endIndex: number): void
  onclosetag(start: number, endIndex: number): void

  onattribdata(start: number, endIndex: number): void
  onattribentity(char: string, start: number, end: number): void
  onattribend(quote: QuoteType, endIndex: number): void
  onattribname(start: number, endIndex: number): void
  onattribnameend(endIndex: number): void

  ondirname(start: number, endIndex: number): void
  ondirarg(start: number, endIndex: number): void
  ondirmodifier(start: number, endIndex: number): void

  oncomment(start: number, endIndex: number): void
  oncdata(start: number, endIndex: number): void

  onprocessinginstruction(start: number, endIndex: number): void
  // ondeclaration(start: number, endIndex: number): void
  onend(): void
  onerr(code: ErrorCodes, index: number): void
}

/**
 * Sequences used to match longer strings.
 *
 * We don't have `Script`, `Style`, or `Title` here. Instead, we re-use the *End
 * sequences with an increased offset.
 */
export const Sequences: {
  Cdata: Uint8Array
  CdataEnd: Uint8Array
  CommentEnd: Uint8Array
  ScriptEnd: Uint8Array
  StyleEnd: Uint8Array
  TitleEnd: Uint8Array
  TextareaEnd: Uint8Array
} = {
  // 这些序列都是 tokenizer 在特殊状态下要匹配的“结束标志”。
  Cdata: new Uint8Array([0x43, 0x44, 0x41, 0x54, 0x41, 0x5b]), // CDATA[
  CdataEnd: new Uint8Array([0x5d, 0x5d, 0x3e]), // ]]>
  CommentEnd: new Uint8Array([0x2d, 0x2d, 0x3e]), // `-->`
  ScriptEnd: new Uint8Array([0x3c, 0x2f, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74]), // `</script`
  StyleEnd: new Uint8Array([0x3c, 0x2f, 0x73, 0x74, 0x79, 0x6c, 0x65]), // `</style`
  TitleEnd: new Uint8Array([0x3c, 0x2f, 0x74, 0x69, 0x74, 0x6c, 0x65]), // `</title`
  TextareaEnd: new Uint8Array([
    0x3c, 0x2f, 116, 101, 120, 116, 97, 114, 101, 97,
  ]), // `</textarea
}

export default class Tokenizer {
  /** The current state the tokenizer is in. */
  public state: State = State.Text
  /** The read buffer. */
  private buffer = ''
  /** The beginning of the section that is currently being read. */
  public sectionStart = 0
  /** The index within the buffer that we are currently looking at. */
  private index = 0
  /** The start of the last entity. */
  private entityStart = 0
  /** Some behavior, eg. when decoding entities, is done while we are in another state. This keeps track of the other state type. */
  private baseState = State.Text
  /** For special parsing behavior inside of script and style tags. */
  public inRCDATA = false
  /** For disabling RCDATA tags handling */
  public inXML = false
  /** For disabling interpolation parsing in v-pre */
  public inVPre = false
  /** Record newline positions for fast line / column calculation */
  private newlines: number[] = []

  private readonly entityDecoder?: EntityDecoder

  public mode: ParseMode = ParseMode.BASE
  public get inSFCRoot(): boolean {
    // SFC 模式下，根层标签（template/script/style）需要特殊处理。
    return this.mode === ParseMode.SFC && this.stack.length === 0
  }

  constructor(
    private readonly stack: ElementNode[],
    private readonly cbs: Callbacks,
  ) {
    // 非浏览器构建才启用 `entities`，浏览器环境交给 DOM 自身做解码。
    if (!__BROWSER__) {
      this.entityDecoder = new EntityDecoder(
        htmlDecodeTree,
        (cp: number, consumed: number) => this.emitCodePoint(cp, consumed),
      )
    }
  }

  public reset(): void {
    // 每次开始新的 parse 前，把状态机和缓冲区恢复到初始状态。
    this.state = State.Text
    this.mode = ParseMode.BASE
    this.buffer = ''
    this.sectionStart = 0
    this.index = 0
    this.baseState = State.Text
    this.inRCDATA = false
    this.currentSequence = undefined!
    this.newlines.length = 0
    this.delimiterOpen = defaultDelimitersOpen
    this.delimiterClose = defaultDelimitersClose
  }

  /**
   * Generate Position object with line / column information using recorded
   * newline positions. We know the index is always going to be an already
   * processed index, so all the newlines up to this index should have been
   * recorded.
   */
  public getPos(index: number): Position {
    // 利用记录下来的换行位置，把绝对 offset 快速换算成 line/column。
    let line = 1
    let column = index + 1
    const length = this.newlines.length
    let j = -1
    if (length > 100) {
      let l = -1
      let r = length
      while (l + 1 < r) {
        const m = (l + r) >>> 1
        this.newlines[m] < index ? (l = m) : (r = m)
      }
      j = l
    } else {
      for (let i = length - 1; i >= 0; i--) {
        if (index > this.newlines[i]) {
          j = i
          break
        }
      }
    }

    if (j >= 0) {
      line = j + 2
      column = index - this.newlines[j]
    }

    return {
      column,
      line,
      offset: index,
    }
  }

  private peek() {
    // 少量状态需要看“下一个字符是什么”，用 peek 避免重复写 `index + 1`。
    return this.buffer.charCodeAt(this.index + 1)
  }

  private stateText(c: number): void {
    // 文本状态下只关心三类切换：
    // 1. `<` 进入标签
    // 2. `&` 进入实体解码
    // 3. `{{` 进入插值
    if (c === CharCodes.Lt) {
      // 遇到 `<` 之前的内容都已经是纯文本，可以先吐给 parser。
      if (this.index > this.sectionStart) {
        this.cbs.ontext(this.sectionStart, this.index)
      }
      this.state = State.BeforeTagName
      this.sectionStart = this.index
    } else if (!__BROWSER__ && c === CharCodes.Amp) {
      // 文本中的 `&` 可能是实体起点，例如 `&amp;`。
      this.startEntity()
    } else if (!this.inVPre && c === this.delimiterOpen[0]) {
      // 非 v-pre 模式下，分隔符首字符可能意味着进入插值。
      this.state = State.InterpolationOpen
      this.delimiterIndex = 0
      this.stateInterpolationOpen(c)
    }
  }

  public delimiterOpen: Uint8Array = defaultDelimitersOpen
  public delimiterClose: Uint8Array = defaultDelimitersClose
  private delimiterIndex = -1

  private stateInterpolationOpen(c: number): void {
    // 逐字符匹配插值起始分隔符，例如默认的 `{{`。
    if (c === this.delimiterOpen[this.delimiterIndex]) {
      if (this.delimiterIndex === this.delimiterOpen.length - 1) {
        const start = this.index + 1 - this.delimiterOpen.length
        if (start > this.sectionStart) {
          // 如果分隔符前面还有文本，要先把前半段文本吐出去。
          this.cbs.ontext(this.sectionStart, start)
        }
        this.state = State.Interpolation
        this.sectionStart = start
      } else {
        // 分隔符还没匹配完，继续累进比较下一个字符。
        this.delimiterIndex++
      }
    } else if (this.inRCDATA) {
      // 在 RCDATA 里误判时，回退到 RCDATA 状态继续按文本看待。
      this.state = State.InRCDATA
      this.stateInRCDATA(c)
    } else {
      // 普通文本里误判时，退回 Text 状态重新消费当前字符。
      this.state = State.Text
      this.stateText(c)
    }
  }

  private stateInterpolation(c: number): void {
    // 插值内部持续扫描，直到命中结束分隔符。
    if (c === this.delimiterClose[0]) {
      // 只有遇到结束分隔符首字符时，才值得切到 close 状态继续确认。
      this.state = State.InterpolationClose
      this.delimiterIndex = 0
      this.stateInterpolationClose(c)
    }
  }

  private stateInterpolationClose(c: number) {
    // 成功闭合后，把整段交给 parser 的 oninterpolation 回调。
    if (c === this.delimiterClose[this.delimiterIndex]) {
      if (this.delimiterIndex === this.delimiterClose.length - 1) {
        this.cbs.oninterpolation(this.sectionStart, this.index + 1)
        if (this.inRCDATA) {
          // `<textarea>{{x}}</textarea>` 这类场景，插值结束后还要回到 RCDATA。
          this.state = State.InRCDATA
        } else {
          this.state = State.Text
        }
        this.sectionStart = this.index + 1
      } else {
        this.delimiterIndex++
      }
    } else {
      // 结束分隔符匹配失败，说明这只是插值内部普通文本的一部分。
      this.state = State.Interpolation
      this.stateInterpolation(c)
    }
  }

  public currentSequence: Uint8Array = undefined!
  private sequenceIndex = 0
  private stateSpecialStartSequence(c: number): void {
    // 进入 script/style/textarea/title 等特殊标签后，
    // 先匹配完整开始标签名，再决定是否切到 RCDATA/RAWTEXT。
    const isEnd = this.sequenceIndex === this.currentSequence.length
    const isMatch = isEnd
      ? // If we are at the end of the sequence, make sure the tag name has ended
        isEndOfTagSection(c)
      : // Otherwise, do a case-insensitive comparison
        (c | 0x20) === this.currentSequence[this.sequenceIndex]

    if (!isMatch) {
      // 一旦发现不是特殊标签，就撤销 RCDATA 标记，按普通标签处理。
      this.inRCDATA = false
    } else if (!isEnd) {
      // 还在匹配标签名途中，继续推进 sequenceIndex。
      this.sequenceIndex++
      return
    }

    this.sequenceIndex = 0
    this.state = State.InTagName
    // 特殊标签名确认完以后，剩余部分还是普通开始标签处理逻辑。
    this.stateInTagName(c)
  }

  /** Look for an end tag. For <title> and <textarea>, also decode entities. */
  private stateInRCDATA(c: number): void {
    // RCDATA 会把大部分内容当文本，但仍要识别结束标签、实体和插值。
    if (this.sequenceIndex === this.currentSequence.length) {
      if (c === CharCodes.Gt || isWhitespace(c)) {
        const endOfText = this.index - this.currentSequence.length

        if (this.sectionStart < endOfText) {
          // 命中结束标签前，先把前面的正文文本片段吐给 parser。
          // Spoof the index so that reported locations match up.
          const actualIndex = this.index
          this.index = endOfText
          this.cbs.ontext(this.sectionStart, endOfText)
          this.index = actualIndex
        }

        this.sectionStart = endOfText + 2 // Skip over the `</`
        this.stateInClosingTagName(c)
        this.inRCDATA = false
        return // We are done; skip the rest of the function.
      }

      // 序列已经匹配满，但当前字符没法真正结束标签，则重新开始找下一次匹配。
      this.sequenceIndex = 0
    }

    if ((c | 0x20) === this.currentSequence[this.sequenceIndex]) {
      // 当前字符与目标结束序列继续匹配，推进比较进度。
      this.sequenceIndex += 1
    } else if (this.sequenceIndex === 0) {
      if (
        this.currentSequence === Sequences.TitleEnd ||
        (this.currentSequence === Sequences.TextareaEnd && !this.inSFCRoot)
      ) {
        // title/textarea 属于 RCDATA：正文里仍要处理实体和插值。
        // We have to parse entities in <title> and <textarea> tags.
        if (!__BROWSER__ && c === CharCodes.Amp) {
          this.startEntity()
        } else if (!this.inVPre && c === this.delimiterOpen[0]) {
          // We also need to handle interpolation
          this.state = State.InterpolationOpen
          this.delimiterIndex = 0
          this.stateInterpolationOpen(c)
        }
      } else if (this.fastForwardTo(CharCodes.Lt)) {
        // script/style 这类 RAWTEXT 不需要逐字符看正文，直接快进到下一个 `<`。
        // Outside of <title> and <textarea> tags, we can fast-forward.
        this.sequenceIndex = 1
      }
    } else {
      // 之前已经部分匹配到结束序列，但当前字符断掉了匹配，必要时保留 `<` 作为新起点。
      // If we see a `<`, set the sequence index to 1; useful for eg. `<</script>`.
      this.sequenceIndex = Number(c === CharCodes.Lt)
    }
  }

  private stateCDATASequence(c: number): void {
    // `<![CDATA[` 前缀匹配完成后，进入统一的 comment-like 终止序列扫描。
    if (c === Sequences.Cdata[this.sequenceIndex]) {
      if (++this.sequenceIndex === Sequences.Cdata.length) {
        // CDATA 头部完整命中后，正文部分复用 InCommentLike 按 `]]>` 结束。
        this.state = State.InCommentLike
        this.currentSequence = Sequences.CdataEnd
        this.sequenceIndex = 0
        this.sectionStart = this.index + 1
      }
    } else {
      // 不是 CDATA，就回退成普通声明处理。
      this.sequenceIndex = 0
      this.state = State.InDeclaration
      this.stateInDeclaration(c) // Reconsume the character
    }
  }

  /**
   * When we wait for one specific character, we can speed things up
   * by skipping through the buffer until we find it.
   *
   * @returns Whether the character was found.
   */
  private fastForwardTo(c: number): boolean {
    // 某些状态只关心“下一个 `<` / `-` / `]` 在哪”，这里直接快进减少逐字符开销。
    while (++this.index < this.buffer.length) {
      const cc = this.buffer.charCodeAt(this.index)
      if (cc === CharCodes.NewLine) {
        this.newlines.push(this.index)
      }
      if (cc === c) {
        return true
      }
    }

    /*
     * We increment the index at the end of the `parse` loop,
     * so set it to `buffer.length - 1` here.
     *
     * TODO: Refactor `parse` to increment index before calling states.
     */
    this.index = this.buffer.length - 1

    return false
  }

  /**
   * Comments and CDATA end with `-->` and `]]>`.
   *
   * Their common qualities are:
   * - Their end sequences have a distinct character they start with.
   * - That character is then repeated, so we have to check multiple repeats.
   * - All characters but the start character of the sequence can be skipped.
   */
  private stateInCommentLike(c: number): void {
    // 注释和 CDATA 的结束序列都很短，统一复用一个状态处理。
    if (c === this.currentSequence[this.sequenceIndex]) {
      if (++this.sequenceIndex === this.currentSequence.length) {
        if (this.currentSequence === Sequences.CdataEnd) {
          this.cbs.oncdata(this.sectionStart, this.index - 2)
        } else {
          this.cbs.oncomment(this.sectionStart, this.index - 2)
        }

        this.sequenceIndex = 0
        this.sectionStart = this.index + 1
        this.state = State.Text
      }
    } else if (this.sequenceIndex === 0) {
      // Fast-forward to the first character of the sequence
      if (this.fastForwardTo(this.currentSequence[0])) {
        this.sequenceIndex = 1
      }
    } else if (c !== this.currentSequence[this.sequenceIndex - 1]) {
      // Allow long sequences, eg. --->, ]]]>
      this.sequenceIndex = 0
    }
  }

  private startSpecial(sequence: Uint8Array, offset: number) {
    this.enterRCDATA(sequence, offset)
    this.state = State.SpecialStartSequence
  }

  public enterRCDATA(sequence: Uint8Array, offset: number): void {
    // 记录目标结束序列，例如 `</script` / `</textarea`，后续按它回退文本模式。
    this.inRCDATA = true
    this.currentSequence = sequence
    this.sequenceIndex = offset
  }

  private stateBeforeTagName(c: number): void {
    // `<` 之后先判断是开始标签、结束标签、注释声明还是处理指令。
    if (c === CharCodes.ExclamationMark) {
      this.state = State.BeforeDeclaration
      this.sectionStart = this.index + 1
    } else if (c === CharCodes.Questionmark) {
      this.state = State.InProcessingInstruction
      this.sectionStart = this.index + 1
    } else if (isTagStartChar(c)) {
      this.sectionStart = this.index
      if (this.mode === ParseMode.BASE) {
        // no special tags in base mode
        this.state = State.InTagName
      } else if (this.inSFCRoot) {
        // SFC mode + root level
        // - everything except <template> is RAWTEXT
        // - <template> with lang other than html is also RAWTEXT
        this.state = State.InSFCRootTagName
      } else if (!this.inXML) {
        // HTML mode
        // - <script>, <style> RAWTEXT
        // - <title>, <textarea> RCDATA
        if (c === 116 /* t */) {
          this.state = State.BeforeSpecialT
        } else {
          this.state =
            c === 115 /* s */ ? State.BeforeSpecialS : State.InTagName
        }
      } else {
        this.state = State.InTagName
      }
    } else if (c === CharCodes.Slash) {
      this.state = State.BeforeClosingTagName
    } else {
      this.state = State.Text
      this.stateText(c)
    }
  }
  private stateInTagName(c: number): void {
    if (isEndOfTagSection(c)) {
      this.handleTagName(c)
    }
  }
  private stateInSFCRootTagName(c: number): void {
    if (isEndOfTagSection(c)) {
      const tag = this.buffer.slice(this.sectionStart, this.index)
      if (tag !== 'template') {
        this.enterRCDATA(toCharCodes(`</` + tag), 0)
      }
      this.handleTagName(c)
    }
  }
  private handleTagName(c: number) {
    // 标签名一旦结束，立即通知 parser 建立元素节点，然后转入属性区。
    this.cbs.onopentagname(this.sectionStart, this.index)
    this.sectionStart = -1
    this.state = State.BeforeAttrName
    this.stateBeforeAttrName(c)
  }
  private stateBeforeClosingTagName(c: number): void {
    if (isWhitespace(c)) {
      // Ignore
    } else if (c === CharCodes.Gt) {
      if (__DEV__ || !__BROWSER__) {
        this.cbs.onerr(ErrorCodes.MISSING_END_TAG_NAME, this.index)
      }
      this.state = State.Text
      // Ignore
      this.sectionStart = this.index + 1
    } else {
      this.state = isTagStartChar(c)
        ? State.InClosingTagName
        : State.InSpecialComment
      this.sectionStart = this.index
    }
  }
  private stateInClosingTagName(c: number): void {
    if (c === CharCodes.Gt || isWhitespace(c)) {
      this.cbs.onclosetag(this.sectionStart, this.index)
      this.sectionStart = -1
      this.state = State.AfterClosingTagName
      this.stateAfterClosingTagName(c)
    }
  }
  private stateAfterClosingTagName(c: number): void {
    // Skip everything until ">"
    if (c === CharCodes.Gt) {
      this.state = State.Text
      this.sectionStart = this.index + 1
    }
  }
  private stateBeforeAttrName(c: number): void {
    // 开始标签名之后进入属性扫描区，直到 `>` 或 `/>` 结束。
    if (c === CharCodes.Gt) {
      this.cbs.onopentagend(this.index)
      if (this.inRCDATA) {
        this.state = State.InRCDATA
      } else {
        this.state = State.Text
      }
      this.sectionStart = this.index + 1
    } else if (c === CharCodes.Slash) {
      this.state = State.InSelfClosingTag
      if ((__DEV__ || !__BROWSER__) && this.peek() !== CharCodes.Gt) {
        this.cbs.onerr(ErrorCodes.UNEXPECTED_SOLIDUS_IN_TAG, this.index)
      }
    } else if (c === CharCodes.Lt && this.peek() === CharCodes.Slash) {
      // special handling for </ appearing in open tag state
      // this is different from standard HTML parsing but makes practical sense
      // especially for parsing intermediate input state in IDEs.
      this.cbs.onopentagend(this.index)
      this.state = State.BeforeTagName
      this.sectionStart = this.index
    } else if (!isWhitespace(c)) {
      if ((__DEV__ || !__BROWSER__) && c === CharCodes.Eq) {
        this.cbs.onerr(
          ErrorCodes.UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME,
          this.index,
        )
      }
      this.handleAttrStart(c)
    }
  }
  private handleAttrStart(c: number) {
    // 根据首字符区分普通属性、完整 `v-xxx` 指令，或 `:` / `@` / `#` 简写。
    if (c === CharCodes.LowerV && this.peek() === CharCodes.Dash) {
      this.state = State.InDirName
      this.sectionStart = this.index
    } else if (
      c === CharCodes.Dot ||
      c === CharCodes.Colon ||
      c === CharCodes.At ||
      c === CharCodes.Number
    ) {
      this.cbs.ondirname(this.index, this.index + 1)
      this.state = State.InDirArg
      this.sectionStart = this.index + 1
    } else {
      this.state = State.InAttrName
      this.sectionStart = this.index
    }
  }
  private stateInSelfClosingTag(c: number): void {
    if (c === CharCodes.Gt) {
      this.cbs.onselfclosingtag(this.index)
      this.state = State.Text
      this.sectionStart = this.index + 1
      this.inRCDATA = false // Reset special state, in case of self-closing special tags
    } else if (!isWhitespace(c)) {
      this.state = State.BeforeAttrName
      this.stateBeforeAttrName(c)
    }
  }
  private stateInAttrName(c: number): void {
    // 普通属性名读到 `=` 或标签边界时结束。
    if (c === CharCodes.Eq || isEndOfTagSection(c)) {
      this.cbs.onattribname(this.sectionStart, this.index)
      this.handleAttrNameEnd(c)
    } else if (
      (__DEV__ || !__BROWSER__) &&
      (c === CharCodes.DoubleQuote ||
        c === CharCodes.SingleQuote ||
        c === CharCodes.Lt)
    ) {
      this.cbs.onerr(
        ErrorCodes.UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME,
        this.index,
      )
    }
  }
  private stateInDirName(c: number): void {
    // 指令名可继续切换到参数区 `:` 或修饰符区 `.`。
    if (c === CharCodes.Eq || isEndOfTagSection(c)) {
      this.cbs.ondirname(this.sectionStart, this.index)
      this.handleAttrNameEnd(c)
    } else if (c === CharCodes.Colon) {
      this.cbs.ondirname(this.sectionStart, this.index)
      this.state = State.InDirArg
      this.sectionStart = this.index + 1
    } else if (c === CharCodes.Dot) {
      this.cbs.ondirname(this.sectionStart, this.index)
      this.state = State.InDirModifier
      this.sectionStart = this.index + 1
    }
  }
  private stateInDirArg(c: number): void {
    // 指令参数支持静态参数、动态参数 `[foo]` 和修饰符继续串接。
    if (c === CharCodes.Eq || isEndOfTagSection(c)) {
      this.cbs.ondirarg(this.sectionStart, this.index)
      this.handleAttrNameEnd(c)
    } else if (c === CharCodes.LeftSquare) {
      this.state = State.InDirDynamicArg
    } else if (c === CharCodes.Dot) {
      this.cbs.ondirarg(this.sectionStart, this.index)
      this.state = State.InDirModifier
      this.sectionStart = this.index + 1
    }
  }
  private stateInDynamicDirArg(c: number): void {
    // 动态参数形如 `:[foo]`，读到 `]` 才算参数结束。
    if (c === CharCodes.RightSquare) {
      this.state = State.InDirArg
    } else if (c === CharCodes.Eq || isEndOfTagSection(c)) {
      // 少了 `]` 也会尽量收尾，并上报缺失结束括号错误。
      this.cbs.ondirarg(this.sectionStart, this.index + 1)
      this.handleAttrNameEnd(c)
      if (__DEV__ || !__BROWSER__) {
        this.cbs.onerr(
          ErrorCodes.X_MISSING_DYNAMIC_DIRECTIVE_ARGUMENT_END,
          this.index,
        )
      }
    }
  }
  private stateInDirModifier(c: number): void {
    // 修饰符支持链式出现，例如 `.stop.prevent`，所以 `.` 会继续分段。
    if (c === CharCodes.Eq || isEndOfTagSection(c)) {
      this.cbs.ondirmodifier(this.sectionStart, this.index)
      this.handleAttrNameEnd(c)
    } else if (c === CharCodes.Dot) {
      this.cbs.ondirmodifier(this.sectionStart, this.index)
      this.sectionStart = this.index + 1
    }
  }
  private handleAttrNameEnd(c: number): void {
    // 属性名/指令名结束后，统一进入“等号后面是什么”这一小段中间状态。
    this.sectionStart = this.index
    this.state = State.AfterAttrName
    this.cbs.onattribnameend(this.index)
    this.stateAfterAttrName(c)
  }
  private stateAfterAttrName(c: number): void {
    if (c === CharCodes.Eq) {
      // 正常情况：属性名后接 `=`，进入属性值解析。
      this.state = State.BeforeAttrValue
    } else if (c === CharCodes.Slash || c === CharCodes.Gt) {
      // 没有显式值的属性，例如 `disabled`，这里按 NoValue 结束。
      this.cbs.onattribend(QuoteType.NoValue, this.sectionStart)
      this.sectionStart = -1
      this.state = State.BeforeAttrName
      this.stateBeforeAttrName(c)
    } else if (!isWhitespace(c)) {
      // 遇到下一个属性起始字符，说明前一个属性是无值属性，立即开启下一个属性。
      this.cbs.onattribend(QuoteType.NoValue, this.sectionStart)
      this.handleAttrStart(c)
    }
  }
  private stateBeforeAttrValue(c: number): void {
    // 根据首字符判断属性值是双引号、单引号还是无引号模式。
    if (c === CharCodes.DoubleQuote) {
      this.state = State.InAttrValueDq
      this.sectionStart = this.index + 1
    } else if (c === CharCodes.SingleQuote) {
      this.state = State.InAttrValueSq
      this.sectionStart = this.index + 1
    } else if (!isWhitespace(c)) {
      this.sectionStart = this.index
      this.state = State.InAttrValueNq
      this.stateInAttrValueNoQuotes(c) // Reconsume token
    }
  }
  private handleInAttrValue(c: number, quote: number) {
    // 双引号和单引号属性值共用同一套逻辑：遇到配对引号结束，遇到 `&` 则解实体。
    if (c === quote || (__BROWSER__ && this.fastForwardTo(quote))) {
      this.cbs.onattribdata(this.sectionStart, this.index)
      this.sectionStart = -1
      this.cbs.onattribend(
        quote === CharCodes.DoubleQuote ? QuoteType.Double : QuoteType.Single,
        this.index + 1,
      )
      this.state = State.BeforeAttrName
    } else if (!__BROWSER__ && c === CharCodes.Amp) {
      this.startEntity()
    }
  }
  private stateInAttrValueDoubleQuotes(c: number): void {
    // `foo="bar"` 进入这里。
    this.handleInAttrValue(c, CharCodes.DoubleQuote)
  }
  private stateInAttrValueSingleQuotes(c: number): void {
    // `foo='bar'` 进入这里。
    this.handleInAttrValue(c, CharCodes.SingleQuote)
  }
  private stateInAttrValueNoQuotes(c: number): void {
    // 无引号属性值以空白或 `>` 结束，例如 `foo=bar`。
    if (isWhitespace(c) || c === CharCodes.Gt) {
      this.cbs.onattribdata(this.sectionStart, this.index)
      this.sectionStart = -1
      this.cbs.onattribend(QuoteType.Unquoted, this.index)
      this.state = State.BeforeAttrName
      this.stateBeforeAttrName(c)
    } else if (
      ((__DEV__ || !__BROWSER__) && c === CharCodes.DoubleQuote) ||
      c === CharCodes.SingleQuote ||
      c === CharCodes.Lt ||
      c === CharCodes.Eq ||
      c === CharCodes.GraveAccent
    ) {
      // 这些字符在无引号属性值里都不合法，但 tokenizer 仍尽量继续往下走。
      this.cbs.onerr(
        ErrorCodes.UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE,
        this.index,
      )
    } else if (!__BROWSER__ && c === CharCodes.Amp) {
      this.startEntity()
    }
  }
  private stateBeforeDeclaration(c: number): void {
    // `<!` 后面继续区分 `<![CDATA[`、`<!--` 或其他声明。
    if (c === CharCodes.LeftSquare) {
      this.state = State.CDATASequence
      this.sequenceIndex = 0
    } else {
      this.state =
        c === CharCodes.Dash ? State.BeforeComment : State.InDeclaration
    }
  }
  private stateInDeclaration(c: number): void {
    // 普通声明不做结构化解析，直接快进到 `>` 结束。
    if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
      // this.cbs.ondeclaration(this.sectionStart, this.index)
      this.state = State.Text
      this.sectionStart = this.index + 1
    }
  }
  private stateInProcessingInstruction(c: number): void {
    // `<? ... ?>` 这种处理指令在 Vue 模板里不参与运行时，仅保留错误检测/跳过。
    if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
      this.cbs.onprocessinginstruction(this.sectionStart, this.index)
      this.state = State.Text
      this.sectionStart = this.index + 1
    }
  }
  private stateBeforeComment(c: number): void {
    // `<!-` 后再判断是不是完整注释起始 `<!--`。
    if (c === CharCodes.Dash) {
      this.state = State.InCommentLike
      this.currentSequence = Sequences.CommentEnd
      // Allow short comments (eg. <!-->)
      this.sequenceIndex = 2
      this.sectionStart = this.index + 1
    } else {
      // 不是注释就回退成普通 declaration 处理。
      this.state = State.InDeclaration
    }
  }
  private stateInSpecialComment(c: number): void {
    // 某些非法闭合标签模式会退化到“特殊注释”分支，统一忽略到 `>`。
    if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
      this.cbs.oncomment(this.sectionStart, this.index)
      this.state = State.Text
      this.sectionStart = this.index + 1
    }
  }
  private stateBeforeSpecialS(c: number): void {
    // 读到 `<s...` 时继续区分是 `<script>` 还是 `<style>`。
    if (c === Sequences.ScriptEnd[3]) {
      this.startSpecial(Sequences.ScriptEnd, 4)
    } else if (c === Sequences.StyleEnd[3]) {
      this.startSpecial(Sequences.StyleEnd, 4)
    } else {
      // 不是特殊标签就回到普通标签名扫描。
      this.state = State.InTagName
      this.stateInTagName(c) // Consume the token again
    }
  }
  private stateBeforeSpecialT(c: number): void {
    // 读到 `<t...` 时继续区分是 `<title>` 还是 `<textarea>`。
    if (c === Sequences.TitleEnd[3]) {
      this.startSpecial(Sequences.TitleEnd, 4)
    } else if (c === Sequences.TextareaEnd[3]) {
      this.startSpecial(Sequences.TextareaEnd, 4)
    } else {
      // 否则仍按普通标签处理。
      this.state = State.InTagName
      this.stateInTagName(c) // Consume the token again
    }
  }

  private startEntity() {
    if (!__BROWSER__) {
      // 进入实体解码时先记住“我是从文本区还是属性值区跳进来的”，
      // 解码完成后还要回到原状态继续扫描。
      this.baseState = this.state
      this.state = State.InEntity
      this.entityStart = this.index
      this.entityDecoder!.startEntity(
        this.baseState === State.Text || this.baseState === State.InRCDATA
          ? DecodingMode.Legacy
          : DecodingMode.Attribute,
      )
    }
  }

  private stateInEntity(): void {
    if (!__BROWSER__) {
      // EntityDecoder 会尝试从当前位置开始消费一个完整实体，例如 `&amp;`。
      const length = this.entityDecoder!.write(this.buffer, this.index)

      // If `length` is positive, we are done with the entity.
      if (length >= 0) {
        this.state = this.baseState

        if (length === 0) {
          // 0 表示这不是合法实体，回退到 `&` 位置按普通文本处理。
          this.index = this.entityStart
        }
      } else {
        // 负数表示实体还没读完，等待更多输入；当前批次缓冲区视为已消费完。
        // Mark buffer as consumed.
        this.index = this.buffer.length - 1
      }
    }
  }

  /**
   * Iterates through the buffer, calling the function corresponding to the current state.
   *
   * States that are more likely to be hit are higher up, as a performance improvement.
   */
  public parse(input: string): void {
    // tokenizer 主循环：逐字符读取，根据当前状态分派到对应处理函数。
    this.buffer = input
    while (this.index < this.buffer.length) {
      const c = this.buffer.charCodeAt(this.index)
      if (c === CharCodes.NewLine && this.state !== State.InEntity) {
        // 实体解码期间的行列信息由外层原始文本驱动，这里跳过重复记录。
        this.newlines.push(this.index)
      }
      switch (this.state) {
        case State.Text: {
          this.stateText(c)
          break
        }
        case State.InterpolationOpen: {
          this.stateInterpolationOpen(c)
          break
        }
        case State.Interpolation: {
          this.stateInterpolation(c)
          break
        }
        case State.InterpolationClose: {
          this.stateInterpolationClose(c)
          break
        }
        case State.SpecialStartSequence: {
          this.stateSpecialStartSequence(c)
          break
        }
        case State.InRCDATA: {
          this.stateInRCDATA(c)
          break
        }
        case State.CDATASequence: {
          this.stateCDATASequence(c)
          break
        }
        case State.InAttrValueDq: {
          this.stateInAttrValueDoubleQuotes(c)
          break
        }
        case State.InAttrName: {
          this.stateInAttrName(c)
          break
        }
        case State.InDirName: {
          this.stateInDirName(c)
          break
        }
        case State.InDirArg: {
          this.stateInDirArg(c)
          break
        }
        case State.InDirDynamicArg: {
          this.stateInDynamicDirArg(c)
          break
        }
        case State.InDirModifier: {
          this.stateInDirModifier(c)
          break
        }
        case State.InCommentLike: {
          this.stateInCommentLike(c)
          break
        }
        case State.InSpecialComment: {
          this.stateInSpecialComment(c)
          break
        }
        case State.BeforeAttrName: {
          this.stateBeforeAttrName(c)
          break
        }
        case State.InTagName: {
          this.stateInTagName(c)
          break
        }
        case State.InSFCRootTagName: {
          this.stateInSFCRootTagName(c)
          break
        }
        case State.InClosingTagName: {
          this.stateInClosingTagName(c)
          break
        }
        case State.BeforeTagName: {
          this.stateBeforeTagName(c)
          break
        }
        case State.AfterAttrName: {
          this.stateAfterAttrName(c)
          break
        }
        case State.InAttrValueSq: {
          this.stateInAttrValueSingleQuotes(c)
          break
        }
        case State.BeforeAttrValue: {
          this.stateBeforeAttrValue(c)
          break
        }
        case State.BeforeClosingTagName: {
          this.stateBeforeClosingTagName(c)
          break
        }
        case State.AfterClosingTagName: {
          this.stateAfterClosingTagName(c)
          break
        }
        case State.BeforeSpecialS: {
          this.stateBeforeSpecialS(c)
          break
        }
        case State.BeforeSpecialT: {
          this.stateBeforeSpecialT(c)
          break
        }
        case State.InAttrValueNq: {
          this.stateInAttrValueNoQuotes(c)
          break
        }
        case State.InSelfClosingTag: {
          this.stateInSelfClosingTag(c)
          break
        }
        case State.InDeclaration: {
          this.stateInDeclaration(c)
          break
        }
        case State.BeforeDeclaration: {
          this.stateBeforeDeclaration(c)
          break
        }
        case State.BeforeComment: {
          this.stateBeforeComment(c)
          break
        }
        case State.InProcessingInstruction: {
          this.stateInProcessingInstruction(c)
          break
        }
        case State.InEntity: {
          this.stateInEntity()
          break
        }
      }
      this.index++
    }
    // 输入扫描结束后，还要把尾部尚未 flush 的片段补发给 parser。
    this.cleanup()
    this.finish()
  }

  /**
   * Remove data that has already been consumed from the buffer.
   */
  private cleanup() {
    // cleanup 只负责把“已经确定属于当前片段”的尾巴吐出去，
    // 但不会越权补齐半截标签结构。
    // If we are inside of text or attributes, emit what we already have.
    if (this.sectionStart !== this.index) {
      if (
        this.state === State.Text ||
        (this.state === State.InRCDATA && this.sequenceIndex === 0)
      ) {
        // 纯文本 / 普通 RCDATA 尾部可以直接作为文本吐出。
        this.cbs.ontext(this.sectionStart, this.index)
        this.sectionStart = this.index
      } else if (
        this.state === State.InAttrValueDq ||
        this.state === State.InAttrValueSq ||
        this.state === State.InAttrValueNq
      ) {
        // 属性值同理，把目前已读到的内容交给 parser 暂存。
        this.cbs.onattribdata(this.sectionStart, this.index)
        this.sectionStart = this.index
      }
    }
  }

  private finish() {
    if (!__BROWSER__ && this.state === State.InEntity) {
      // 如果输入正好结束在实体中间，先强制结束解码器，再回到原状态收尾。
      this.entityDecoder!.end()
      this.state = this.baseState
    }

    // 再根据当前状态决定剩余数据是文本、注释，还是应该直接忽略。
    this.handleTrailingData()

    this.cbs.onend()
  }

  /** Handle any trailing data. */
  private handleTrailingData() {
    const endIndex = this.buffer.length

    // If there is no remaining data, we are done.
    if (this.sectionStart >= endIndex) {
      return
    }

    if (this.state === State.InCommentLike) {
      // 截止在注释/CDATA 中间时，仍把目前内容作为注释/CDATA 片段回调出去。
      if (this.currentSequence === Sequences.CdataEnd) {
        this.cbs.oncdata(this.sectionStart, endIndex)
      } else {
        this.cbs.oncomment(this.sectionStart, endIndex)
      }
    } else if (
      this.state === State.InTagName ||
      this.state === State.BeforeAttrName ||
      this.state === State.BeforeAttrValue ||
      this.state === State.AfterAttrName ||
      this.state === State.InAttrName ||
      this.state === State.InDirName ||
      this.state === State.InDirArg ||
      this.state === State.InDirDynamicArg ||
      this.state === State.InDirModifier ||
      this.state === State.InAttrValueSq ||
      this.state === State.InAttrValueDq ||
      this.state === State.InAttrValueNq ||
      this.state === State.InClosingTagName
    ) {
      /*
       * If we are currently in an opening or closing tag, us not calling the
       * respective callback signals that the tag should be ignored.
       */
      // 如果停在半截标签或半截属性里，故意什么也不吐，交给 parser 在 onend 阶段报错。
    } else {
      // 其余情况一律按尾部文本处理。
      this.cbs.ontext(this.sectionStart, endIndex)
    }
  }

  private emitCodePoint(cp: number, consumed: number): void {
    if (!__BROWSER__) {
      if (this.baseState !== State.Text && this.baseState !== State.InRCDATA) {
        // 在属性值里解出实体时，先把实体前面的普通片段吐成 attribdata，
        // 再把当前实体吐成 attribentity。
        if (this.sectionStart < this.entityStart) {
          this.cbs.onattribdata(this.sectionStart, this.entityStart)
        }
        this.sectionStart = this.entityStart + consumed
        this.index = this.sectionStart - 1

        this.cbs.onattribentity(
          fromCodePoint(cp),
          this.entityStart,
          this.sectionStart,
        )
      } else {
        // 文本/RCDATA 中的实体同理，拆成“前缀普通文本 + 当前实体字符”两段回调。
        if (this.sectionStart < this.entityStart) {
          this.cbs.ontext(this.sectionStart, this.entityStart)
        }
        this.sectionStart = this.entityStart + consumed
        this.index = this.sectionStart - 1

        this.cbs.ontextentity(
          fromCodePoint(cp),
          this.entityStart,
          this.sectionStart,
        )
      }
    }
  }
}

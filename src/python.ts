/*
 * @Author: LQ
 * @Date: 2023-02-14 09:34:29
 * @LastEditors: LQ
 * @LastEditTime: 2023-02-14 09:53:43
 * @FilePath: \lang-python-scm\src\python.ts
 * @Description:
 *
 * Copyright (c) 2023 by LQ/量迅, All Rights Reserved.
 */
import {parser} from "@lezer/python"
import {SyntaxNode} from "@lezer/common"
import {delimitedIndent, indentNodeProp, TreeIndentContext,
        foldNodeProp, foldInside, LRLanguage, LanguageSupport} from "@codemirror/language"
import {globalCompletion, localCompletionSource} from "./complete"
import { Completion } from "@codemirror/autocomplete"
export {globalCompletion, localCompletionSource}

function indentBody(context: TreeIndentContext, node: SyntaxNode) {
  let base = context.lineIndent(node.from)
  let line = context.lineAt(context.pos, -1), to = line.from + line.text.length
  // Don't consider blank, deindented lines at the end of the
  // block part of the block
  if (!/\S/.test(line.text) &&
      context.node.to < to + 100 &&
      !/\S/.test(context.state.sliceDoc(to, context.node.to)) &&
      context.lineIndent(context.pos, -1) <= base)
    return null
  // A normally deindenting keyword that appears at a higher
  // indentation than the block should probably be handled by the next
  // level
  if (/^\s*(else:|elif |except |finally:)/.test(context.textAfter) && context.lineIndent(context.pos, -1) > base)
    return null
  return base + context.unit
}

/// A language provider based on the [Lezer Python
/// parser](https://github.com/lezer-parser/python), extended with
/// highlighting and indentation information.
export const pythonScmLanguage = LRLanguage.define({
  name: "pythonScm",
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        Body: context => indentBody(context, context.node) ?? context.continue(),
        IfStatement: cx => /^\s*(else:|elif )/.test(cx.textAfter) ? cx.baseIndent : cx.continue(),
        TryStatement: cx => /^\s*(except |finally:|else:)/.test(cx.textAfter) ? cx.baseIndent : cx.continue(),
        "TupleExpression ComprehensionExpression ParamList ArgList ParenthesizedExpression": delimitedIndent({closing: ")"}),
        "DictionaryExpression DictionaryComprehensionExpression SetExpression SetComprehensionExpression": delimitedIndent({closing: "}"}),
        "ArrayExpression ArrayComprehensionExpression": delimitedIndent({closing: "]"}),
        "String FormatString": () => null,
        Script: context => {
          if (context.pos + /\s*/.exec(context.textAfter)![0].length >= context.node.to) {
            let endBody:SyntaxNode = null as never as SyntaxNode
            for (let cur: SyntaxNode | null = context.node, to = cur.to;;) {
              cur = cur.lastChild
              if (!cur || cur.to != to) break
              if (cur.type.name == "Body") endBody = cur
            }
            if (endBody) {
              let bodyIndent = indentBody(context, endBody)
              if (bodyIndent != null) return bodyIndent
            }
          }
          return context.continue()
        }
      }),
      foldNodeProp.add({
        "ArrayExpression DictionaryExpression SetExpression TupleExpression": foldInside,
        Body: (node, state) => ({from: node.from + 1, to: node.to - (node.to == state.doc.length ? 0 : 1)})
      })
    ],
  }),
  languageData: {
    closeBrackets: {
      brackets: ["(", "[", "{", "'", '"', "'''", '"""'],
      stringPrefixes: ["f", "fr", "rf", "r", "u", "b", "br", "rb",
                       "F", "FR", "RF", "R", "U", "B", "BR", "RB"]
    },
    commentTokens: {line: "#"},
    indentOnInput: /^\s*([\}\]\)]|else:|elif |except |finally:)$/
  }
})

/// Python language support.
export function pythonScm(completions:Completion[]) {
  return new LanguageSupport(pythonScmLanguage, [
    pythonScmLanguage.data.of({ autocomplete: localCompletionSource }),
    pythonScmLanguage.data.of({ autocomplete: globalCompletion(completions) }),
  ]);
}

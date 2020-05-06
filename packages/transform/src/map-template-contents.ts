import { AST, preprocess } from '@glimmer/syntax';
import MappingTree from './mapping-tree';
import { Range } from './transformed-module';
import { assert } from './util';

/**
 * @glimmer/syntax parses identifiers as strings. Aside from meaning
 * we often have to reverse engineer location information for them
 * by hand, it also means we can't treat mappings from identifiers
 * consistently with how we treat mappings from other AST nodes.
 *
 * This class just gives us a uniform way to store identifiers
 * or other nodes as the `source` for a mapping.
 */
export class Identifier {
  public readonly type = 'Identifier';
  public constructor(public readonly name: string) {}
}

export type Mapper = {
  /**
   * Given a @glimmer/syntax AST node, returns the corresponding start
   * and end offsets of that node in the original source.
   */
  rangeForNode: (node: AST.Node) => Range;

  emit: {
    /** Emit a newline in the transformed source */
    newline(): void;

    /** Increase the indent level for future emitted content */
    indent(): void;

    /** Decrease the indent level for future emitted content*/
    dedent(): void;

    /** Append the given raw text to the transformed source */
    text(value: string): void;

    /**
     * Append the given value to the transformed source, mapping
     * that span back to the given offset in the original source.
     */
    identifier(value: string, hbsOffset: number, hbsLength?: number): void;

    /**
     * Map all content emitted in the given callback to the span
     * corresponding to the given AST node in the original source.
     */
    forNode(node: AST.Node, callback: () => void): void;
  };
};

/** The result of rewriting a template */
export type RewriteResult = {
  /**
   * Any errors discovered during rewriting, along with their location
   * in terms of the original source.
   */
  errors: Array<{ message: string; location: Range }>;

  /**
   * The source code and a `MappingTree` resulting from rewriting a
   * template. If the template contains unrecoverable syntax errors,
   * this may be undefined.
   */
  result?: {
    code: string;
    mapping: MappingTree;
  };
};

/**
 * Given the text of an HBS template, invokes the given callback
 * with a set of tools to emit mapped contents corresponding to
 * that template, tracking the text emitted in order to provide
 * a mapping of ranges in the input to ranges in the output.
 */
export function mapTemplateContents(
  template: string,
  callback: (ast: AST.Template, mapper: Mapper) => void
): RewriteResult {
  let ast: AST.Template;
  try {
    ast = preprocess(template);
  } catch (error) {
    return {
      errors: [
        {
          message: error.message,
          location: { start: 0, end: template.length },
        },
      ],
    };
  }

  let rangeForNode = calculateLineOffsets(template);

  let segmentsStack: string[][] = [[]];
  let mappingsStack: MappingTree[][] = [[]];
  let indent = '';
  let offset = 0;
  let needsIndent = false;
  let errors: Array<{ message: string; location: Range }> = [];

  // Associates all content emitted during the given callback with the
  // given range in the template source and corresponding AST node.
  // If an exception is thrown while executing the callback, the error
  // will be captured and associated with the given range, and no content
  // will be emitted.
  let captureMapping = (
    hbsRange: Range,
    source: AST.Node | Identifier,
    callback: () => void
  ): void => {
    let start = offset;
    let mappings: MappingTree[] = [];
    let segments: string[] = [];

    segmentsStack.unshift(segments);
    mappingsStack.unshift(mappings);
    try {
      callback();
    } catch (error) {
      errors.push({ message: error.message, location: hbsRange });
      offset = start;
    }
    mappingsStack.shift();
    segmentsStack.shift();

    // If the offset didn't change (either because nothing was emitted
    // or because an exception was thrown), don't add a new node to the
    // mapping tree or flush any new content.
    if (start !== offset) {
      let end = offset;
      let tsRange = { start, end };

      mappingsStack[0].push(new MappingTree(tsRange, hbsRange, mappings, source));
      segmentsStack[0].push(...segments);
    }
  };

  let emit = {
    indent() {
      indent += '  ';
    },
    dedent() {
      indent = indent.slice(2);
    },
    newline() {
      offset += 1;
      segmentsStack[0].push('\n');
      needsIndent = true;
    },
    text(value: string) {
      if (needsIndent) {
        offset += indent.length;
        segmentsStack[0].push(indent);
        needsIndent = false;
      }

      offset += value.length;
      segmentsStack[0].push(value);
    },
    identifier(value: string, hbsOffset: number, hbsLength = value.length) {
      let hbsRange = { start: hbsOffset, end: hbsOffset + hbsLength };
      let source = new Identifier(value);
      captureMapping(hbsRange, source, () => emit.text(value));
    },
    forNode(node: AST.Node, callback: () => void) {
      captureMapping(rangeForNode(node), node, callback);
    },
  };

  callback(ast, { emit, rangeForNode });

  assert(segmentsStack.length === 1);

  let code = segmentsStack[0].join('');
  let mapping = new MappingTree(
    { start: 0, end: code.length },
    rangeForNode(ast),
    mappingsStack[0],
    ast
  );

  return { errors, result: { code, mapping } };
}

const LEADING_WHITESPACE = /^\s+/;
const TRAILING_WHITESPACE = /\s+$/;

function calculateLineOffsets(template: string): (node: AST.Node) => Range {
  let lines = template.split('\n');
  let total = 0;
  let offsets = [0];

  for (let [index, line] of lines.entries()) {
    // lines from @glimmer/syntax are 1-indexed
    offsets[index + 1] = total;
    total += line.length + 1;
  }

  return (node) => {
    let { loc } = node;
    let start = offsets[loc.start.line] + loc.start.column;
    let end = offsets[loc.end.line] + loc.end.column;

    // This makes error reporting for illegal text nodes (e.g. alongside named blocks)
    // a bit nicer by only highlighting the content rather than all the surrounding
    // newlines and attendant whitespace
    if (node.type === 'TextNode') {
      let leading = LEADING_WHITESPACE.exec(node.chars)?.[0].length ?? 0;
      let trailing = TRAILING_WHITESPACE.exec(node.chars)?.[0].length ?? 0;

      if (leading !== node.chars.length) {
        start += leading;
        end -= trailing;
      }
    }

    return { start, end };
  };
}

import { expectTypeOf } from 'expect-type';
import SumType from 'sums-up';
import { AcceptsBlocks, DirectInvokable, EmptyObject } from '../-private/integration';
import { invokeBlock, invokeEmit, resolve, resolveOrReturn } from '../-private/dsl';
import { SafeString } from '@glimmer/runtime';
import { htmlSafe } from '@ember/template';

///////////////////////////////////////////////////////////////////////////////
// This module exercises what's possible when declaring a signature for a
// complex third-party (i.e. non-built-in) helper.
// Real-world, this is actually implemented via an AST transform to a series
// of conditionals and helper invocations that are efficient but not
// particularly ergonomic to write by hand.

class Maybe<T> extends SumType<{ Nothing: []; Just: [T] }> {}

const maybeValue = new Maybe<number>('Just', 123);

type SumVariants<T extends SumType<never>> = T extends SumType<infer V> ? V : never;

// Used to do pattern matching against sum type values using
// https://github.com/hojberg/sums-up
// It doesn't (can't) do exhaustiveness checking, but it does plumb through
// type parameters correctly
declare const caseOf: DirectInvokable<
  <T extends SumType<never>>(
    args: EmptyObject,
    value: T
  ) => AcceptsBlocks<{
    default: [
      DirectInvokable<
        <K extends keyof SumVariants<T>>(
          args: EmptyObject,
          key: K
        ) => AcceptsBlocks<{
          default: SumVariants<T>[K];
          inverse?: [];
        }>
      >
    ];
  }>
>;

/**
 * ```hbs
 * {{#case-of maybeValue as |when|}}
 *   {{#when 'Just' as |n|}}
 *     {{n}}
 *   {{else when 'Nothing'}}
 *     {{! nothin }}
 *   {{/when}}
 * {{/case-of}}
 * ```
 */
invokeBlock(resolve(caseOf)({}, maybeValue), {
  default(when) {
    invokeBlock(resolve(when)({}, 'Just'), {
      default(n) {
        expectTypeOf(n).toEqualTypeOf<number>();
        invokeEmit(resolveOrReturn(n)({}));
      },
      inverse() {
        invokeBlock(resolve(when)({}, 'Nothing'), {
          default() {
            /* nothin */
          },
        });
      },
    });
  },
});

// Glimmer's SafeString interface
let safeString: SafeString = {
  toHTML(): string {
    return '<span>Foo</span>';
  },
};

invokeEmit(safeString);

// @ember/template's SafeString
invokeEmit(htmlSafe('<span>Foo</span>'));

// Below is an alternative formulation using named block syntax.
// This is a bit weird as it's really a control structure and looks here
// more like it would emit DOM since it's using angle brackets, but
// you do get exhaustiveness checking with this approach (though it's
// arguable whether that's necessarily a good thing in template-land)

declare const CaseOf: DirectInvokable<
  <T extends SumType<any>>(args: { value: T }) => AcceptsBlocks<SumVariants<T>>
>;

/**
 * ```hbs
 * <CaseOf @value={{maybeValue}}>
 *   <:Just as |value|>
 *     {{value}}
 *   </:Just>
 *   <:Nothing>
 *     {{! nothin }}
 *   </:Nothing>
 * </CaseOf>
 * ```
 */
invokeBlock(resolve(CaseOf)({ value: maybeValue }), {
  Just(value) {
    expectTypeOf(value).toEqualTypeOf<number>();
    invokeEmit(resolveOrReturn(value)({}));
  },
  Nothing() {
    /* nothin */
  },
});

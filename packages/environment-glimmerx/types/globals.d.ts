import * as VM from '@glint/template/-private/keywords';

interface Keywords {
  debugger: VM.DebuggerKeyword;
  each: VM.EachKeyword;
  'has-block': VM.HasBlockParamsKeyword;
  'has-block-params': VM.HasBlockParamsKeyword;
  // the `if` keyword is implemented directly in @glint/transform
  'in-element': VM.InElementKeyword;
  let: VM.LetKeyword;
  unless: void; // TODO: should this be implemented as `if (!...)`?
  with: VM.WithKeyword;
  // the `yield` keyword is implemented directly in @glint/transform
}

declare const k: Keywords;

export interface Globals extends Keywords {
  // GlimmerX, by design, doesn't have any global values beyond
  // glimmer-vm keywords
}

export declare const Globals: Globals;
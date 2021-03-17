import type { ContextType, Invoke, TemplateContext } from '@glint/template/-private';
import type { RootElement } from '@glint/template/-private/attributes';
import type { AcceptsBlocks, EmptyObject } from '@glint/template/-private/signature';

const EmberComponent = window.require('ember').EmberComponent;
type EmberComponent = import('@ember/component').default;
type EmberComponentConstructor = typeof import('@ember/component').default;

type Get<T, Key, Otherwise = EmptyObject> = Key extends keyof T
  ? Exclude<T[Key], undefined>
  : Otherwise;

export type ArgsFor<T extends ComponentSignature> = 'Args' extends keyof T ? T['Args'] : {};

export interface ComponentSignature {
  Args?: Partial<Record<string, unknown>>;
  Yields?: Partial<Record<string, Array<unknown>>>;
  Element?: Element;
}

const Component = EmberComponent as new <T extends ComponentSignature = {}>(
  ...args: ConstructorParameters<EmberComponentConstructor>
) => Component<T>;

interface Component<T extends ComponentSignature = {}> extends EmberComponent {
  [Invoke]: (args: Get<T, 'Args'>) => AcceptsBlocks<Get<T, 'Yields'>>;
  [RootElement]: Get<T, 'Element', null>;
  [ContextType]: TemplateContext<this, Get<T, 'Args'>, Get<T, 'Yields'>, Get<T, 'Element', null>>;
}

export default Component;

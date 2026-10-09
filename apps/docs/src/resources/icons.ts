import type { IconComponent } from "@once-ui-system/core";
import { FaGithub, FaNpm } from "react-icons/fa6";
import {
  VscSymbolClass,
  VscSymbolEnum,
  VscSymbolInterface,
  VscSymbolMethod,
  VscSymbolVariable,
  VscGroupByRefType,
} from "react-icons/vsc";

/**
 * Icons the site registers on top of the ones Once UI ships: brand marks and
 * the symbol kinds used by the API reference. Names must also be declared in
 * `once-ui.d.ts` so that `IconName` knows about them.
 */
export const iconLibrary: Record<string, IconComponent> = {
  github: FaGithub,
  npm: FaNpm,
  class: VscSymbolClass,
  enum: VscSymbolEnum,
  function: VscSymbolMethod,
  interface: VscSymbolInterface,
  type: VscGroupByRefType,
  variable: VscSymbolVariable,
};

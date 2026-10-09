import "@once-ui-system/core";

declare module "@once-ui-system/core" {
  /** Icons registered in `icons.ts`, on top of the built-in set. */
  interface IconLibraryOverrides {
    github: true;
    npm: true;
    class: true;
    enum: true;
    function: true;
    interface: true;
    type: true;
    variable: true;
  }
}

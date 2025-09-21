import { Widget } from './Widget';

/**
 * @example
 * A button widget.
 */
export class ButtonWidget extends Widget<{
    /**
     * The name of this button.
     */
    name: string;
}> {
    /**
     * Creates a new button.
     */
    public constructor() {
        super({ name: 'Button' });
    }

    /**
     * Renders this button.
     */
    public render() {
        return `<button>${this.name}</button>`;
    }
}

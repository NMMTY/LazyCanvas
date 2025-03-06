/**
 * List of CSS [`filters`](https://developer.mozilla.org/en-US/docs/Web/CSS/filter) that can be used with the `filter` property. Use this functions to `setFilters` on the layer.
 */
export const Filters = {
    /**
     * @description Applies a Gaussian blur to the input image. The value of `radius` defines the value of the standard deviation to the Gaussian function, or how many pixels on the screen blend into each other, so a larger value will create more blur. If no value is specified, it defaults to 0.
     * @param radius {number} - The `radius` of the blur.
     * @returns {string}
     */
    blur(radius: number): string {
        return `blur(${radius}px)`;
    },
    /**
     * @description Adjusts the brightness of the input image. A value of `0%` will create an image that is completely black, while a value of `100%` leaves the input unchanged. If no value is specified, it defaults to `100%`.
     * @param amount {number} - The `amount` of the brightness.
     * @returns {string}
     */
    brightness(amount: number): string {
        return `brightness(${amount}%)`;
    },
    /**
     * @description Adjusts the contrast of the input image. A value of `0%` will create an image that is completely black, while a value of `100%` leaves the input unchanged. If no value is specified, it defaults to `100%`.
     * @param amount {number} - The `amount` of the contrast.
     * @returns {string}
     */
    contrast(amount: number): string {
        return `contrast(${amount}%)`;
    },
    /**
     * @description Applies a drop shadow effect to the input image. The value of `color` is the color of the shadow. The `offsetX` and `offsetY` values are the horizontal and vertical distances of the shadow, and the `blurRadius` is the amount of blur. If no value is specified, it defaults to `0`.
     * @param color {string} - The `color` of the shadow.
     * @param offsetX {number} - The `offsetX` of the shadow.
     * @param offsetY {number} - The `offsetY` of the shadow.
     * @param blurRadius {number} - The `blurRadius` of the shadow.
     * @returns {string}
     */
    dropShadow(color: string, offsetX: number, offsetY: number, blurRadius: number): string {
        return `drop-shadow(${offsetX}px ${offsetY}px ${blurRadius}px ${color})`;
    },
    /**
     * @description Converts the input image to grayscale. A value of `0%` is completely unmodified, while a value of `100%` will make the image completely grayscale.
     * @param amount {number} - The `amount` of the grayscale.
     * @returns {string}
     */
    grayscale(amount: number): string {
        return `grayscale(${amount}%)`;
    },
    /**
     * @description Applies a hue rotation to the input image. The value of `angle` defines the number of degrees around the color circle the input samples will be adjusted. A value of `0deg` leaves the input unchanged.
     * @param angle {number} - The `angle` of the hue rotation.
     * @returns {string}
     */
    hueRotate(angle: number): string {
        return `hue-rotate(${angle}deg)`;
    },
    /**
     * @description Inverts the samples in the input image. A value of `0%` leaves the input unchanged, while a value of `100%` is completely inverted.
     * @param amount {number} - The `amount` of the invert.
     * @returns {string}
     */
    invert(amount: number): string {
        return `invert(${amount}%)`;
    },
    /**
     * @description Sets the opacity of the input image. A value of `0%` is completely transparent, while a value of `100%` is completely opaque.
     * @param amount {number} - The `amount` of the opacity.
     * @returns {string}
     */
    opacity(amount: number): string {
        return `opacity(${amount}%)`;
    },
    /**
     * @description Saturates the input image. A value of `0%` is completely unmodified, while a value of `100%` is completely saturated.
     * @param amount {number} - The `amount` of the saturation.
     * @returns {string}
     */
    saturate(amount: number): string {
        return `saturate(${amount}%)`;
    },
    /**
     * @description Converts the input image to sepia. A value of `0%` is completely unmodified, while a value of `100%` is completely sepia.
     * @param amount {number} - The `amount` of the sepia.
     * @returns {string}
     */
    sepia(amount: number): string {
        return `sepia(${amount}%)`;
    }
}

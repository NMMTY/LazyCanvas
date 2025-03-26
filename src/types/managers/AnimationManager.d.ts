import { AnyColorSpace } from "../types";

export interface IAnimationManager {
    opts: {
        frameRate: number;
        maxColors: number;
        colorSpace: AnyColorSpace;
        loop: boolean;
        transparency: boolean;
        clear: boolean;
    };
    animated: boolean;
    debug: boolean;
}
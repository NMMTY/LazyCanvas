import { LazyCanvas } from '../../';
import { AnyPatternType } from "../";

export interface IPattern {
    type: AnyPatternType;
    src: string | LazyCanvas;
}

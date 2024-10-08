import { ViewportType } from '../enums';
import Point2 from './Point2';
export declare type InternalVideoCamera = {
    panWorld?: Point2;
    parallelScale?: number;
};
export declare type VideoViewportInput = {
    id: string;
    renderingEngineId: string;
    type: ViewportType;
    element: HTMLDivElement;
    sx: number;
    sy: number;
    sWidth: number;
    sHeight: number;
    defaultOptions: any;
    canvas: HTMLCanvasElement;
};
//# sourceMappingURL=VideoViewportTypes.d.ts.map
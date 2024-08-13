import type IStackViewport from '../types/IStackViewport';
import type IRenderingEngine from '../types/IRenderingEngine';
import type IVolumeViewport from '../types/IVolumeViewport';
import type { IViewport } from '../types/IViewport';
import type { PublicViewportInput } from '../types/IViewport';
declare class RenderingEngine implements IRenderingEngine {
    readonly id: string;
    hasBeenDestroyed: boolean;
    offscreenMultiRenderWindow: any;
    readonly offScreenCanvasContainer: any;
    private _viewports;
    private _needsRender;
    private _animationFrameSet;
    private _animationFrameHandle;
    private useCPURendering;
    constructor(id?: string);
    enableElement(viewportInputEntry: PublicViewportInput): void;
    disableElement(viewportId: string): void;
    setViewports(publicViewportInputEntries: Array<PublicViewportInput>): void;
    resize(immediate?: boolean, keepCamera?: boolean): void;
    getViewport(viewportId: string): IViewport;
    getViewports(): Array<IViewport>;
    getStackViewports(): Array<IStackViewport>;
    getVolumeViewports(): Array<IVolumeViewport>;
    render(): void;
    renderFrameOfReference: (FrameOfReferenceUID: string) => void;
    renderViewports(viewportIds: Array<string>): void;
    renderViewport(viewportId: string): void;
    destroy(): void;
    fillCanvasWithBackgroundColor(canvas: HTMLCanvasElement, backgroundColor: [number, number, number]): void;
    private _normalizeViewportInputEntry;
    private _normalizeViewportInputEntries;
    private _resizeUsingCustomResizeHandler;
    private _resizeVTKViewports;
    private enableVTKjsDrivenViewport;
    private _removeViewport;
    private addVtkjsDrivenViewport;
    private addCustomViewport;
    private setCustomViewports;
    private setVtkjsDrivenViewports;
    private _resizeOffScreenCanvas;
    private _resize;
    private _getViewportCoordsOnOffScreenCanvas;
    private _getViewportsAsArray;
    private _setViewportsToBeRenderedNextFrame;
    private _render;
    private _renderFlaggedViewports;
    private performVtkDrawCall;
    private renderViewportUsingCustomOrVtkPipeline;
    private _renderViewportFromVtkCanvasToOnscreenCanvas;
    private _resetViewport;
    private _clearAnimationFrame;
    private _reset;
    private _throwIfDestroyed;
    _downloadOffScreenCanvas(): void;
    _debugRender(): void;
}
export default RenderingEngine;

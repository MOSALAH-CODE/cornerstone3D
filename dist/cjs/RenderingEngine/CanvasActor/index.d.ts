import type { IViewport } from '../../types/IViewport';
import type { ICanvasActor } from '../../types/IActor';
import CanvasProperties from './CanvasProperties';
import CanvasMapper from './CanvasMapper';
export default class CanvasActor implements ICanvasActor {
    private image;
    private derivedImage;
    private canvasProperties;
    private visibility;
    private mapper;
    private viewport;
    protected className: string;
    protected canvas: any;
    constructor(viewport: IViewport, derivedImage: any);
    protected renderRLE(viewport: any, context: any, voxelManager: any): void;
    render(viewport: IViewport, context: CanvasRenderingContext2D): void;
    getClassName(): string;
    getProperty(): CanvasProperties;
    setVisibility(visibility: boolean): void;
    getMapper(): CanvasMapper;
    isA(actorType: any): boolean;
    getImage(): any;
}

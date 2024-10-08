import { BlendModes, OrientationAxis } from '../enums';
import type { IVolumeInput, OrientationVectors, Point3, ViewReference, ViewReferenceSpecifier } from '../types';
import type { ViewportInput } from '../types/IViewport';
import BaseVolumeViewport from './BaseVolumeViewport';
declare class VolumeViewport extends BaseVolumeViewport {
    private _useAcquisitionPlaneForViewPlane;
    constructor(props: ViewportInput);
    setVolumes(volumeInputArray: Array<IVolumeInput>, immediate?: boolean, suppressEvents?: boolean): Promise<void>;
    getNumberOfSlices: () => number;
    addVolumes(volumeInputArray: Array<IVolumeInput>, immediate?: boolean, suppressEvents?: boolean): Promise<void>;
    setOrientation(orientation: OrientationAxis | OrientationVectors, immediate?: boolean): void;
    private _getAcquisitionPlaneOrientation;
    private _setViewPlaneToAcquisitionPlane;
    setBlendMode(blendMode: BlendModes, filterActorUIDs?: any[], immediate?: boolean): void;
    resetCamera(resetPan?: boolean, resetZoom?: boolean, resetToCenter?: boolean, resetRotation?: boolean, supressEvents?: boolean): boolean;
    setSlabThickness(slabThickness: number, filterActorUIDs?: any[]): void;
    resetSlabThickness(): void;
    getCurrentImageIdIndex: (volumeId?: string) => number;
    getSliceIndex: () => number;
    getCurrentImageId: () => string | undefined;
    getViewReference(viewRefSpecifier?: ViewReferenceSpecifier): ViewReference;
    resetProperties(volumeId?: string): void;
    private _resetProperties;
    getSlicesClippingPlanes(): Array<{
        sliceIndex: number;
        planes: Array<{
            normal: Point3;
            origin: Point3;
        }>;
    }>;
    getSlicePlaneCoordinates: () => Array<{
        sliceIndex: number;
        point: Point3;
    }>;
}
export default VolumeViewport;
//# sourceMappingURL=VolumeViewport.d.ts.map
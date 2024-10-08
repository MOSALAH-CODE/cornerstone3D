import vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane';
import cache from '../cache';
import { MPR_CAMERA_VALUES, RENDERING_DEFAULTS } from '../constants';
import { OrientationAxis, Events } from '../enums';
import { actorIsA, getClosestImageId, getSliceRange, getSpacingInNormalDirection, isImageActor, snapFocalPointToSlice, triggerEvent, } from '../utilities';
import BaseVolumeViewport from './BaseVolumeViewport';
import setDefaultVolumeVOI from './helpers/setDefaultVolumeVOI';
import { setTransferFunctionNodes } from '../utilities/transferFunctionUtils';
import getImageSliceDataForVolumeViewport from '../utilities/getImageSliceDataForVolumeViewport';
import { vec3 } from 'gl-matrix';
class VolumeViewport extends BaseVolumeViewport {
    constructor(props) {
        super(props);
        this._useAcquisitionPlaneForViewPlane = false;
        this.getNumberOfSlices = () => {
            const { numberOfSlices } = getImageSliceDataForVolumeViewport(this);
            return numberOfSlices;
        };
        this.getCurrentImageIdIndex = (volumeId) => {
            const { viewPlaneNormal, focalPoint } = this.getCamera();
            const imageData = this.getImageData(volumeId);
            if (!imageData) {
                return;
            }
            const { origin, direction, spacing } = imageData;
            const spacingInNormal = getSpacingInNormalDirection({ direction, spacing }, viewPlaneNormal);
            const sub = vec3.create();
            vec3.sub(sub, focalPoint, origin);
            const distance = vec3.dot(sub, viewPlaneNormal);
            return Math.round(Math.abs(distance) / spacingInNormal);
        };
        this.getSliceIndex = () => {
            const { imageIndex } = getImageSliceDataForVolumeViewport(this);
            return imageIndex;
        };
        this.getCurrentImageId = () => {
            const actorEntry = this.getDefaultActor();
            if (!actorEntry || !actorIsA(actorEntry, 'vtkVolume')) {
                return;
            }
            const { uid } = actorEntry;
            const volume = cache.getVolume(uid);
            if (!volume) {
                return;
            }
            const { viewPlaneNormal, focalPoint } = this.getCamera();
            return getClosestImageId(volume, focalPoint, viewPlaneNormal);
        };
        this.getSlicePlaneCoordinates = () => {
            const actorEntry = this.getDefaultActor();
            if (!actorEntry?.actor) {
                console.warn('No image data found for calculating vtkPlanes.');
                return [];
            }
            const volumeId = actorEntry.uid;
            const imageVolume = cache.getVolume(volumeId);
            const camera = this.getCamera();
            const { focalPoint, position, viewPlaneNormal } = camera;
            const spacingInNormalDirection = getSpacingInNormalDirection(imageVolume, viewPlaneNormal);
            const sliceRange = getSliceRange(actorEntry.actor, viewPlaneNormal, focalPoint);
            const numSlicesBackward = Math.round((sliceRange.current - sliceRange.min) / spacingInNormalDirection);
            const numSlicesForward = Math.round((sliceRange.max - sliceRange.current) / spacingInNormalDirection);
            const currentSliceIndex = this.getSliceIndex();
            const focalPoints = [];
            for (let i = -numSlicesBackward; i <= numSlicesForward; i++) {
                const { newFocalPoint: point } = snapFocalPointToSlice(focalPoint, position, sliceRange, viewPlaneNormal, spacingInNormalDirection, i);
                focalPoints.push({ sliceIndex: currentSliceIndex + i, point });
            }
            return focalPoints;
        };
        const { orientation } = this.options;
        if (orientation && orientation !== OrientationAxis.ACQUISITION) {
            this.applyViewOrientation(orientation);
            return;
        }
        this._useAcquisitionPlaneForViewPlane = true;
    }
    async setVolumes(volumeInputArray, immediate = false, suppressEvents = false) {
        const firstImageVolume = cache.getVolume(volumeInputArray[0].volumeId);
        if (!firstImageVolume) {
            throw new Error(`imageVolume with id: ${firstImageVolume.volumeId} does not exist`);
        }
        if (this._useAcquisitionPlaneForViewPlane) {
            this._setViewPlaneToAcquisitionPlane(firstImageVolume);
            this._useAcquisitionPlaneForViewPlane = false;
        }
        return super.setVolumes(volumeInputArray, immediate, suppressEvents);
    }
    async addVolumes(volumeInputArray, immediate = false, suppressEvents = false) {
        const firstImageVolume = cache.getVolume(volumeInputArray[0].volumeId);
        if (!firstImageVolume) {
            throw new Error(`imageVolume with id: ${firstImageVolume.volumeId} does not exist`);
        }
        if (this._useAcquisitionPlaneForViewPlane) {
            this._setViewPlaneToAcquisitionPlane(firstImageVolume);
            this._useAcquisitionPlaneForViewPlane = false;
        }
        return super.addVolumes(volumeInputArray, immediate, suppressEvents);
    }
    setOrientation(orientation, immediate = true) {
        let viewPlaneNormal, viewUp;
        if (typeof orientation === 'string') {
            if (MPR_CAMERA_VALUES[orientation]) {
                ({ viewPlaneNormal, viewUp } = MPR_CAMERA_VALUES[orientation]);
            }
            else if (orientation === 'acquisition') {
                ({ viewPlaneNormal, viewUp } = this._getAcquisitionPlaneOrientation());
            }
            else {
                throw new Error(`Invalid orientation: ${orientation}. Use Enums.OrientationAxis instead.`);
            }
            this.setCamera({
                viewPlaneNormal,
                viewUp,
            });
            this.viewportProperties.orientation = orientation;
            this.resetCamera();
        }
        else {
            ({ viewPlaneNormal, viewUp } = orientation);
            this.applyViewOrientation(orientation);
        }
        if (immediate) {
            this.render();
        }
    }
    _getAcquisitionPlaneOrientation() {
        const actorEntry = this.getDefaultActor();
        if (!actorEntry) {
            return;
        }
        const volumeId = actorEntry.uid;
        const imageVolume = cache.getVolume(volumeId);
        if (!imageVolume) {
            throw new Error(`imageVolume with id: ${volumeId} does not exist in cache`);
        }
        const { direction } = imageVolume;
        const viewPlaneNormal = direction.slice(6, 9).map((x) => -x);
        const viewUp = direction.slice(3, 6).map((x) => -x);
        return {
            viewPlaneNormal,
            viewUp,
        };
    }
    _setViewPlaneToAcquisitionPlane(imageVolume) {
        let viewPlaneNormal, viewUp;
        if (imageVolume) {
            const { direction } = imageVolume;
            viewPlaneNormal = direction.slice(6, 9).map((x) => -x);
            viewUp = direction.slice(3, 6).map((x) => -x);
        }
        else {
            ({ viewPlaneNormal, viewUp } = this._getAcquisitionPlaneOrientation());
        }
        this.setCamera({
            viewPlaneNormal,
            viewUp,
        });
        this.initialViewUp = viewUp;
        this.resetCamera();
    }
    setBlendMode(blendMode, filterActorUIDs = [], immediate = false) {
        let actorEntries = this.getActors();
        if (filterActorUIDs && filterActorUIDs.length > 0) {
            actorEntries = actorEntries.filter((actorEntry) => {
                return filterActorUIDs.includes(actorEntry.uid);
            });
        }
        actorEntries.forEach((actorEntry) => {
            const { actor } = actorEntry;
            const mapper = actor.getMapper();
            mapper.setBlendMode?.(blendMode);
        });
        if (immediate) {
            this.render();
        }
    }
    resetCamera(resetPan = true, resetZoom = true, resetToCenter = true, resetRotation = false, supressEvents = false) {
        const { orientation } = this.viewportProperties;
        if (orientation) {
            this.applyViewOrientation(orientation, false);
        }
        super.resetCamera(resetPan, resetZoom, resetToCenter);
        this.resetVolumeViewportClippingRange();
        const activeCamera = this.getVtkActiveCamera();
        const viewPlaneNormal = activeCamera.getViewPlaneNormal();
        const focalPoint = activeCamera.getFocalPoint();
        const actorEntries = this.getActors();
        actorEntries.forEach((actorEntry) => {
            if (!actorEntry.actor) {
                return;
            }
            const mapper = actorEntry.actor.getMapper();
            const vtkPlanes = mapper.getClippingPlanes();
            if (vtkPlanes.length === 0 && !actorEntry?.clippingFilter) {
                const clipPlane1 = vtkPlane.newInstance();
                const clipPlane2 = vtkPlane.newInstance();
                const newVtkPlanes = [clipPlane1, clipPlane2];
                let slabThickness = RENDERING_DEFAULTS.MINIMUM_SLAB_THICKNESS;
                if (actorEntry.slabThickness) {
                    slabThickness = actorEntry.slabThickness;
                }
                this.setOrientationOfClippingPlanes(newVtkPlanes, slabThickness, viewPlaneNormal, focalPoint);
                mapper.addClippingPlane(clipPlane1);
                mapper.addClippingPlane(clipPlane2);
            }
        });
        if (resetRotation &&
            MPR_CAMERA_VALUES[this.viewportProperties.orientation] !== undefined) {
            const viewToReset = MPR_CAMERA_VALUES[this.viewportProperties.orientation];
            this.setCameraNoEvent({
                viewUp: viewToReset.viewUp,
                viewPlaneNormal: viewToReset.viewPlaneNormal,
            });
        }
        if (!supressEvents) {
            const eventDetail = {
                viewportId: this.id,
                camera: this.getCamera(),
                renderingEngineId: this.renderingEngineId,
                element: this.element,
            };
            triggerEvent(this.element, Events.CAMERA_RESET, eventDetail);
        }
        return true;
    }
    setSlabThickness(slabThickness, filterActorUIDs = []) {
        if (slabThickness < 0.1) {
            slabThickness = 0.1;
        }
        let actorEntries = this.getActors();
        if (filterActorUIDs && filterActorUIDs.length > 0) {
            actorEntries = actorEntries.filter((actorEntry) => {
                return filterActorUIDs.includes(actorEntry.uid);
            });
        }
        actorEntries.forEach((actorEntry) => {
            if (actorIsA(actorEntry, 'vtkVolume')) {
                actorEntry.slabThickness = slabThickness;
            }
        });
        const currentCamera = this.getCamera();
        this.updateClippingPlanesForActors(currentCamera);
        this.triggerCameraModifiedEventIfNecessary(currentCamera, currentCamera);
        this.viewportProperties.slabThickness = slabThickness;
    }
    resetSlabThickness() {
        const actorEntries = this.getActors();
        actorEntries.forEach((actorEntry) => {
            if (actorIsA(actorEntry, 'vtkVolume')) {
                actorEntry.slabThickness = RENDERING_DEFAULTS.MINIMUM_SLAB_THICKNESS;
            }
        });
        const currentCamera = this.getCamera();
        this.updateClippingPlanesForActors(currentCamera);
        this.triggerCameraModifiedEventIfNecessary(currentCamera, currentCamera);
        this.viewportProperties.slabThickness = undefined;
    }
    getViewReference(viewRefSpecifier = {}) {
        const viewRef = super.getViewReference(viewRefSpecifier);
        if (!viewRef?.volumeId) {
            return;
        }
        const volume = cache.getVolume(viewRef.volumeId);
        viewRef.referencedImageId = getClosestImageId(volume, viewRef.cameraFocalPoint, viewRef.viewPlaneNormal);
        return viewRef;
    }
    resetProperties(volumeId) {
        this._resetProperties(volumeId);
    }
    _resetProperties(volumeId) {
        const volumeActor = volumeId
            ? this.getActor(volumeId)
            : this.getDefaultActor();
        if (!volumeActor) {
            throw new Error(`No actor found for the given volumeId: ${volumeId}`);
        }
        if (volumeActor.slabThickness) {
            volumeActor.slabThickness = RENDERING_DEFAULTS.MINIMUM_SLAB_THICKNESS;
            this.viewportProperties.slabThickness = undefined;
            this.updateClippingPlanesForActors(this.getCamera());
        }
        const imageVolume = cache.getVolume(volumeActor.uid);
        if (!imageVolume) {
            throw new Error(`imageVolume with id: ${volumeActor.uid} does not exist in cache`);
        }
        setDefaultVolumeVOI(volumeActor.actor, imageVolume, false);
        if (isImageActor(volumeActor)) {
            const transferFunction = volumeActor.actor
                .getProperty()
                .getRGBTransferFunction(0);
            setTransferFunctionNodes(transferFunction, this.initialTransferFunctionNodes);
        }
        const eventDetails = {
            ...super.getVOIModifiedEventDetail(volumeId),
        };
        const resetPan = true;
        const resetZoom = true;
        const resetToCenter = true;
        const resetCameraRotation = true;
        this.resetCamera(resetPan, resetZoom, resetToCenter, resetCameraRotation);
        triggerEvent(this.element, Events.VOI_MODIFIED, eventDetails);
    }
    getSlicesClippingPlanes() {
        const focalPoints = this.getSlicePlaneCoordinates();
        const { viewPlaneNormal } = this.getCamera();
        const slabThickness = RENDERING_DEFAULTS.MINIMUM_SLAB_THICKNESS;
        return focalPoints.map(({ point, sliceIndex }) => {
            const vtkPlanes = [vtkPlane.newInstance(), vtkPlane.newInstance()];
            this.setOrientationOfClippingPlanes(vtkPlanes, slabThickness, viewPlaneNormal, point);
            return {
                sliceIndex,
                planes: vtkPlanes.map((plane) => ({
                    normal: plane.getNormal(),
                    origin: plane.getOrigin(),
                })),
            };
        });
    }
}
export default VolumeViewport;
//# sourceMappingURL=VolumeViewport.js.map
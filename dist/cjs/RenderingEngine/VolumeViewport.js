"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Plane_1 = __importDefault(require("@kitware/vtk.js/Common/DataModel/Plane"));
const cache_1 = __importDefault(require("../cache"));
const constants_1 = require("../constants");
const enums_1 = require("../enums");
const utilities_1 = require("../utilities");
const BaseVolumeViewport_1 = __importDefault(require("./BaseVolumeViewport"));
const setDefaultVolumeVOI_1 = __importDefault(require("./helpers/setDefaultVolumeVOI"));
const transferFunctionUtils_1 = require("../utilities/transferFunctionUtils");
const getImageSliceDataForVolumeViewport_1 = __importDefault(require("../utilities/getImageSliceDataForVolumeViewport"));
const gl_matrix_1 = require("gl-matrix");
class VolumeViewport extends BaseVolumeViewport_1.default {
    constructor(props) {
        super(props);
        this._useAcquisitionPlaneForViewPlane = false;
        this.getNumberOfSlices = () => {
            const { numberOfSlices } = (0, getImageSliceDataForVolumeViewport_1.default)(this);
            return numberOfSlices;
        };
        this.getCurrentImageIdIndex = (volumeId) => {
            const { viewPlaneNormal, focalPoint } = this.getCamera();
            const imageData = this.getImageData(volumeId);
            if (!imageData) {
                return;
            }
            const { origin, direction, spacing } = imageData;
            const spacingInNormal = (0, utilities_1.getSpacingInNormalDirection)({ direction, spacing }, viewPlaneNormal);
            const sub = gl_matrix_1.vec3.create();
            gl_matrix_1.vec3.sub(sub, focalPoint, origin);
            const distance = gl_matrix_1.vec3.dot(sub, viewPlaneNormal);
            return Math.round(Math.abs(distance) / spacingInNormal);
        };
        this.getSliceIndex = () => {
            const { imageIndex } = (0, getImageSliceDataForVolumeViewport_1.default)(this);
            return imageIndex;
        };
        this.getCurrentImageId = () => {
            const actorEntry = this.getDefaultActor();
            if (!actorEntry || !(0, utilities_1.actorIsA)(actorEntry, 'vtkVolume')) {
                return;
            }
            const { uid } = actorEntry;
            const volume = cache_1.default.getVolume(uid);
            if (!volume) {
                return;
            }
            const { viewPlaneNormal, focalPoint } = this.getCamera();
            return (0, utilities_1.getClosestImageId)(volume, focalPoint, viewPlaneNormal);
        };
        this.getSlicePlaneCoordinates = () => {
            const actorEntry = this.getDefaultActor();
            if (!(actorEntry === null || actorEntry === void 0 ? void 0 : actorEntry.actor)) {
                console.warn('No image data found for calculating vtkPlanes.');
                return [];
            }
            const volumeId = actorEntry.uid;
            const imageVolume = cache_1.default.getVolume(volumeId);
            const camera = this.getCamera();
            const { focalPoint, position, viewPlaneNormal } = camera;
            const spacingInNormalDirection = (0, utilities_1.getSpacingInNormalDirection)(imageVolume, viewPlaneNormal);
            const sliceRange = (0, utilities_1.getSliceRange)(actorEntry.actor, viewPlaneNormal, focalPoint);
            const numSlicesBackward = Math.round((sliceRange.current - sliceRange.min) / spacingInNormalDirection);
            const numSlicesForward = Math.round((sliceRange.max - sliceRange.current) / spacingInNormalDirection);
            const currentSliceIndex = this.getSliceIndex();
            const focalPoints = [];
            for (let i = -numSlicesBackward; i <= numSlicesForward; i++) {
                const { newFocalPoint: point } = (0, utilities_1.snapFocalPointToSlice)(focalPoint, position, sliceRange, viewPlaneNormal, spacingInNormalDirection, i);
                focalPoints.push({ sliceIndex: currentSliceIndex + i, point });
            }
            return focalPoints;
        };
        const { orientation } = this.options;
        if (orientation && orientation !== enums_1.OrientationAxis.ACQUISITION) {
            this.applyViewOrientation(orientation);
            return;
        }
        this._useAcquisitionPlaneForViewPlane = true;
    }
    setVolumes(volumeInputArray, immediate = false, suppressEvents = false) {
        const _super = Object.create(null, {
            setVolumes: { get: () => super.setVolumes }
        });
        return __awaiter(this, void 0, void 0, function* () {
            const firstImageVolume = cache_1.default.getVolume(volumeInputArray[0].volumeId);
            if (!firstImageVolume) {
                throw new Error(`imageVolume with id: ${firstImageVolume.volumeId} does not exist`);
            }
            if (this._useAcquisitionPlaneForViewPlane) {
                this._setViewPlaneToAcquisitionPlane(firstImageVolume);
                this._useAcquisitionPlaneForViewPlane = false;
            }
            return _super.setVolumes.call(this, volumeInputArray, immediate, suppressEvents);
        });
    }
    addVolumes(volumeInputArray, immediate = false, suppressEvents = false) {
        const _super = Object.create(null, {
            addVolumes: { get: () => super.addVolumes }
        });
        return __awaiter(this, void 0, void 0, function* () {
            const firstImageVolume = cache_1.default.getVolume(volumeInputArray[0].volumeId);
            if (!firstImageVolume) {
                throw new Error(`imageVolume with id: ${firstImageVolume.volumeId} does not exist`);
            }
            if (this._useAcquisitionPlaneForViewPlane) {
                this._setViewPlaneToAcquisitionPlane(firstImageVolume);
                this._useAcquisitionPlaneForViewPlane = false;
            }
            return _super.addVolumes.call(this, volumeInputArray, immediate, suppressEvents);
        });
    }
    setOrientation(orientation, immediate = true) {
        let viewPlaneNormal, viewUp;
        if (typeof orientation === 'string') {
            if (constants_1.MPR_CAMERA_VALUES[orientation]) {
                ({ viewPlaneNormal, viewUp } = constants_1.MPR_CAMERA_VALUES[orientation]);
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
        const imageVolume = cache_1.default.getVolume(volumeId);
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
            var _a;
            const { actor } = actorEntry;
            const mapper = actor.getMapper();
            (_a = mapper.setBlendMode) === null || _a === void 0 ? void 0 : _a.call(mapper, blendMode);
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
            if (vtkPlanes.length === 0 && !(actorEntry === null || actorEntry === void 0 ? void 0 : actorEntry.clippingFilter)) {
                const clipPlane1 = Plane_1.default.newInstance();
                const clipPlane2 = Plane_1.default.newInstance();
                const newVtkPlanes = [clipPlane1, clipPlane2];
                let slabThickness = constants_1.RENDERING_DEFAULTS.MINIMUM_SLAB_THICKNESS;
                if (actorEntry.slabThickness) {
                    slabThickness = actorEntry.slabThickness;
                }
                this.setOrientationOfClippingPlanes(newVtkPlanes, slabThickness, viewPlaneNormal, focalPoint);
                mapper.addClippingPlane(clipPlane1);
                mapper.addClippingPlane(clipPlane2);
            }
        });
        if (resetRotation &&
            constants_1.MPR_CAMERA_VALUES[this.viewportProperties.orientation] !== undefined) {
            const viewToReset = constants_1.MPR_CAMERA_VALUES[this.viewportProperties.orientation];
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
            (0, utilities_1.triggerEvent)(this.element, enums_1.Events.CAMERA_RESET, eventDetail);
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
            if ((0, utilities_1.actorIsA)(actorEntry, 'vtkVolume')) {
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
            if ((0, utilities_1.actorIsA)(actorEntry, 'vtkVolume')) {
                actorEntry.slabThickness = constants_1.RENDERING_DEFAULTS.MINIMUM_SLAB_THICKNESS;
            }
        });
        const currentCamera = this.getCamera();
        this.updateClippingPlanesForActors(currentCamera);
        this.triggerCameraModifiedEventIfNecessary(currentCamera, currentCamera);
        this.viewportProperties.slabThickness = undefined;
    }
    getViewReference(viewRefSpecifier = {}) {
        const viewRef = super.getViewReference(viewRefSpecifier);
        if (!(viewRef === null || viewRef === void 0 ? void 0 : viewRef.volumeId)) {
            return;
        }
        const volume = cache_1.default.getVolume(viewRef.volumeId);
        viewRef.referencedImageId = (0, utilities_1.getClosestImageId)(volume, viewRef.cameraFocalPoint, viewRef.viewPlaneNormal);
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
            volumeActor.slabThickness = constants_1.RENDERING_DEFAULTS.MINIMUM_SLAB_THICKNESS;
            this.viewportProperties.slabThickness = undefined;
            this.updateClippingPlanesForActors(this.getCamera());
        }
        const imageVolume = cache_1.default.getVolume(volumeActor.uid);
        if (!imageVolume) {
            throw new Error(`imageVolume with id: ${volumeActor.uid} does not exist in cache`);
        }
        (0, setDefaultVolumeVOI_1.default)(volumeActor.actor, imageVolume, false);
        if ((0, utilities_1.isImageActor)(volumeActor)) {
            const transferFunction = volumeActor.actor
                .getProperty()
                .getRGBTransferFunction(0);
            (0, transferFunctionUtils_1.setTransferFunctionNodes)(transferFunction, this.initialTransferFunctionNodes);
        }
        const eventDetails = Object.assign({}, super.getVOIModifiedEventDetail(volumeId));
        const resetPan = true;
        const resetZoom = true;
        const resetToCenter = true;
        const resetCameraRotation = true;
        this.resetCamera(resetPan, resetZoom, resetToCenter, resetCameraRotation);
        (0, utilities_1.triggerEvent)(this.element, enums_1.Events.VOI_MODIFIED, eventDetails);
    }
    getSlicesClippingPlanes() {
        const focalPoints = this.getSlicePlaneCoordinates();
        const { viewPlaneNormal } = this.getCamera();
        const slabThickness = constants_1.RENDERING_DEFAULTS.MINIMUM_SLAB_THICKNESS;
        return focalPoints.map(({ point, sliceIndex }) => {
            const vtkPlanes = [Plane_1.default.newInstance(), Plane_1.default.newInstance()];
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
exports.default = VolumeViewport;
//# sourceMappingURL=VolumeViewport.js.map
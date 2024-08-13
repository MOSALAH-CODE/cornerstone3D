"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const CanvasProperties_1 = __importDefault(require("./CanvasProperties"));
const CanvasMapper_1 = __importDefault(require("./CanvasMapper"));
class CanvasActor {
    constructor(viewport, derivedImage) {
        this.canvasProperties = new CanvasProperties_1.default(this);
        this.visibility = false;
        this.mapper = new CanvasMapper_1.default(this);
        this.className = 'CanvasActor';
        this.derivedImage = derivedImage;
        this.viewport = viewport;
    }
    renderRLE(viewport, context, voxelManager) {
        const { width, height } = this.image;
        let { canvas } = this;
        if (!canvas || canvas.width !== width || canvas.height !== height) {
            this.canvas = canvas = new window.OffscreenCanvas(width, height);
        }
        const localContext = canvas.getContext('2d');
        const imageData = localContext.createImageData(width, height);
        const { data: imageArray } = imageData;
        imageArray.fill(0);
        const { map } = voxelManager;
        let dirtyX = Infinity;
        let dirtyY = Infinity;
        let dirtyX2 = -Infinity;
        let dirtyY2 = -Infinity;
        for (let y = 0; y < height; y++) {
            const row = map.getRun(y, 0);
            if (!row) {
                continue;
            }
            dirtyY = Math.min(dirtyY, y);
            dirtyY2 = Math.max(dirtyY2, y);
            const baseOffset = (y * width) << 2;
            let indicesToDelete;
            for (const run of row) {
                const { start, end, value: segmentIndex } = run;
                if (segmentIndex === 0) {
                    indicesToDelete || (indicesToDelete = []);
                    indicesToDelete.push(row.indexOf(run));
                    continue;
                }
                dirtyX = Math.min(dirtyX, start);
                dirtyX2 = Math.max(dirtyX2, end);
                const rgb = this.canvasProperties
                    .getColor(segmentIndex)
                    .map((v) => v * 255);
                let startOffset = baseOffset + (start << 2);
                for (let i = start; i < end; i++) {
                    imageArray[startOffset++] = rgb[0];
                    imageArray[startOffset++] = rgb[1];
                    imageArray[startOffset++] = rgb[2];
                    imageArray[startOffset++] = rgb[3];
                }
            }
        }
        if (dirtyX > width) {
            return;
        }
        const dirtyWidth = dirtyX2 - dirtyX;
        const dirtyHeight = dirtyY2 - dirtyY;
        localContext.putImageData(imageData, 0, 0, dirtyX - 1, dirtyY - 1, dirtyWidth + 2, dirtyHeight + 2);
        context.drawImage(canvas, dirtyX, dirtyY, dirtyWidth, dirtyHeight, dirtyX, dirtyY, dirtyWidth, dirtyHeight);
    }
    render(viewport, context) {
        if (!this.visibility) {
            return;
        }
        const image = this.image || this.getImage();
        const { width, height } = image;
        const data = image.getScalarData();
        if (!data) {
            return;
        }
        const { voxelManager } = image;
        if (voxelManager) {
            if (voxelManager.map.getRun) {
                return this.renderRLE(viewport, context, voxelManager);
            }
        }
        let { canvas } = this;
        if (!canvas || canvas.width !== width || canvas.height !== height) {
            this.canvas = canvas = new window.OffscreenCanvas(width, height);
        }
        const localContext = canvas.getContext('2d');
        const imageData = localContext.createImageData(width, height);
        const { data: imageArray } = imageData;
        let offset = 0;
        let destOffset = 0;
        let dirtyX = Infinity;
        let dirtyY = Infinity;
        let dirtyX2 = -Infinity;
        let dirtyY2 = -Infinity;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const segmentIndex = data[offset++];
                if (segmentIndex) {
                    dirtyX = Math.min(x, dirtyX);
                    dirtyY = Math.min(y, dirtyY);
                    dirtyX2 = Math.max(x, dirtyX2);
                    dirtyY2 = Math.max(y, dirtyY2);
                    const rgb = this.canvasProperties.getColor(segmentIndex);
                    imageArray[destOffset] = rgb[0] * 255;
                    imageArray[destOffset + 1] = rgb[1] * 255;
                    imageArray[destOffset + 2] = rgb[2] * 255;
                    imageArray[destOffset + 3] = 127;
                }
                destOffset += 4;
            }
        }
        if (dirtyX > width) {
            return;
        }
        const dirtyWidth = dirtyX2 - dirtyX + 1;
        const dirtyHeight = dirtyY2 - dirtyY + 1;
        localContext.putImageData(imageData, 0, 0, dirtyX, dirtyY, dirtyWidth, dirtyHeight);
        context.drawImage(canvas, dirtyX, dirtyY, dirtyWidth, dirtyHeight, dirtyX, dirtyY, dirtyWidth, dirtyHeight);
    }
    getClassName() {
        return this.className;
    }
    getProperty() {
        return this.canvasProperties;
    }
    setVisibility(visibility) {
        this.visibility = visibility;
    }
    getMapper() {
        return this.mapper;
    }
    isA(actorType) {
        return actorType === this.className;
    }
    getImage() {
        if (this.image) {
            return this.image;
        }
        this.image = Object.assign({}, this.derivedImage);
        const imageData = this.viewport.getImageData();
        Object.assign(this.image, {
            worldToIndex: (worldPos) => imageData.imageData.worldToIndex(worldPos),
            indexToWorld: (index, destPoint) => imageData.imageData.indexToWorld(index, destPoint),
            getDimensions: () => imageData.dimensions,
            getScalarData: () => { var _a; return (_a = this.derivedImage) === null || _a === void 0 ? void 0 : _a.getPixelData(); },
            getDirection: () => imageData.direction,
            getSpacing: () => imageData.spacing,
            setOrigin: () => null,
            setDerivedImage: (image) => {
                this.derivedImage = image;
                this.image = null;
            },
            modified: () => null,
        });
        return this.image;
    }
}
exports.default = CanvasActor;
//# sourceMappingURL=index.js.map
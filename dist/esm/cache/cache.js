import { triggerEvent, imageIdToURI } from '../utilities';
import eventTarget from '../eventTarget';
import Events from '../enums/Events';
import { ImageVolume } from './classes/ImageVolume';
const ONE_GB = 1073741824;
class Cache {
    constructor() {
        this._imageCache = new Map();
        this._volumeCache = new Map();
        this._imageCacheSize = 0;
        this._volumeCacheSize = 0;
        this._maxCacheSize = 3 * ONE_GB;
        this._maxInstanceSize = 4 * ONE_GB - 8;
        this.setMaxCacheSize = (newMaxCacheSize) => {
            if (!newMaxCacheSize || typeof newMaxCacheSize !== 'number') {
                const errorMessage = `New max cacheSize ${this._maxCacheSize} should be defined and should be a number.`;
                throw new Error(errorMessage);
            }
            this._maxCacheSize = newMaxCacheSize;
        };
        this.isCacheable = (byteLength) => {
            if (byteLength > this._maxInstanceSize) {
                return false;
            }
            const unallocatedSpace = this.getBytesAvailable();
            const imageCacheSize = this._imageCacheSize;
            const availableSpace = unallocatedSpace + imageCacheSize;
            return availableSpace > byteLength;
        };
        this.getMaxCacheSize = () => this._maxCacheSize;
        this.getMaxInstanceSize = () => this._maxInstanceSize;
        this.getCacheSize = () => this._imageCacheSize + this._volumeCacheSize;
        this._decacheImage = (imageId) => {
            const { imageLoadObject } = this._imageCache.get(imageId);
            if (imageLoadObject.cancelFn) {
                imageLoadObject.cancelFn();
            }
            if (imageLoadObject.decache) {
                imageLoadObject.decache();
            }
            this._imageCache.delete(imageId);
        };
        this._decacheVolume = (volumeId) => {
            const cachedVolume = this._volumeCache.get(volumeId);
            const { volumeLoadObject, volume } = cachedVolume;
            if (volume.cancelLoading) {
                volume.cancelLoading();
            }
            if (volume.imageData) {
                volume.imageData.delete();
            }
            this._restoreImagesFromBuffer(volume);
            if (volumeLoadObject.cancelFn) {
                volumeLoadObject.cancelFn();
            }
            if (volumeLoadObject.decache) {
                volumeLoadObject.decache();
            }
            this._volumeCache.delete(volumeId);
        };
        this.purgeCache = () => {
            const imageIterator = this._imageCache.keys();
            while (true) {
                const { value: imageId, done } = imageIterator.next();
                if (done) {
                    break;
                }
                this.removeImageLoadObject(imageId);
                triggerEvent(eventTarget, Events.IMAGE_CACHE_IMAGE_REMOVED, { imageId });
            }
            this.purgeVolumeCache();
        };
        this.purgeVolumeCache = () => {
            const volumeIterator = this._volumeCache.keys();
            while (true) {
                const { value: volumeId, done } = volumeIterator.next();
                if (done) {
                    break;
                }
                this.removeVolumeLoadObject(volumeId);
                triggerEvent(eventTarget, Events.VOLUME_CACHE_VOLUME_REMOVED, {
                    volumeId,
                });
            }
        };
        this.getVolumeLoadObject = (volumeId) => {
            if (volumeId === undefined) {
                throw new Error('getVolumeLoadObject: volumeId must not be undefined');
            }
            const cachedVolume = this._volumeCache.get(volumeId);
            if (cachedVolume === undefined) {
                return;
            }
            cachedVolume.timeStamp = Date.now();
            return cachedVolume.volumeLoadObject;
        };
        this.getGeometry = (geometryId) => {
            if (geometryId == null) {
                throw new Error('getGeometry: geometryId must not be undefined');
            }
            const cachedGeometry = this._geometryCache.get(geometryId);
            if (cachedGeometry === undefined) {
                return;
            }
            cachedGeometry.timeStamp = Date.now();
            return cachedGeometry.geometry;
        };
        this.getImage = (imageId) => {
            if (imageId === undefined) {
                throw new Error('getImage: imageId must not be undefined');
            }
            const cachedImage = this._imageCache.get(imageId);
            if (cachedImage === undefined) {
                return;
            }
            cachedImage.timeStamp = Date.now();
            return cachedImage.image;
        };
        this.getVolume = (volumeId) => {
            if (volumeId === undefined) {
                throw new Error('getVolume: volumeId must not be undefined');
            }
            const cachedVolume = this._volumeCache.get(volumeId);
            if (cachedVolume === undefined) {
                return;
            }
            cachedVolume.timeStamp = Date.now();
            return cachedVolume.volume;
        };
        this.getVolumes = () => {
            const cachedVolumes = Array.from(this._volumeCache.values());
            return cachedVolumes.map((cachedVolume) => cachedVolume.volume);
        };
        this.filterVolumesByReferenceId = (volumeId) => {
            const cachedVolumes = this.getVolumes();
            return cachedVolumes.filter((volume) => {
                return volume.referencedVolumeId === volumeId;
            });
        };
        this.removeImageLoadObject = (imageId) => {
            if (imageId === undefined) {
                throw new Error('removeImageLoadObject: imageId must not be undefined');
            }
            const cachedImage = this._imageCache.get(imageId);
            if (cachedImage === undefined) {
                throw new Error('removeImageLoadObject: imageId was not present in imageCache');
            }
            this.incrementImageCacheSize(-cachedImage.sizeInBytes);
            const eventDetails = {
                image: cachedImage,
                imageId,
            };
            triggerEvent(eventTarget, Events.IMAGE_CACHE_IMAGE_REMOVED, eventDetails);
            this._decacheImage(imageId);
        };
        this.removeVolumeLoadObject = (volumeId) => {
            if (volumeId === undefined) {
                throw new Error('removeVolumeLoadObject: volumeId must not be undefined');
            }
            const cachedVolume = this._volumeCache.get(volumeId);
            if (cachedVolume === undefined) {
                throw new Error('removeVolumeLoadObject: volumeId was not present in volumeCache');
            }
            this.incrementVolumeCacheSize(-cachedVolume.sizeInBytes);
            const eventDetails = {
                volume: cachedVolume,
                volumeId,
            };
            triggerEvent(eventTarget, Events.VOLUME_CACHE_VOLUME_REMOVED, eventDetails);
            this._decacheVolume(volumeId);
        };
        this.putGeometryLoadObject = (geometryId, geometryLoadObject) => {
            if (geometryId == undefined) {
                throw new Error('putGeometryLoadObject: geometryId must not be undefined');
            }
            if (this._geometryCache.has(geometryId)) {
                throw new Error('putGeometryLoadObject: geometryId already present in geometryCache');
            }
            const cachedGeometry = {
                geometryId,
                geometryLoadObject,
                loaded: false,
                timeStamp: Date.now(),
                sizeInBytes: 0,
            };
            this._geometryCache.set(geometryId, cachedGeometry);
            return geometryLoadObject.promise
                .then((geometry) => {
                if (!this._geometryCache.has(geometryId)) {
                    console.warn('putGeometryLoadObject: geometryId was removed from geometryCache');
                    return;
                }
                if (Number.isNaN(geometry.sizeInBytes)) {
                    throw new Error('putGeometryLoadObject: geometry.sizeInBytes is not a number');
                }
                cachedGeometry.loaded = true;
                cachedGeometry.geometry = geometry;
                cachedGeometry.sizeInBytes = geometry.sizeInBytes;
                const eventDetails = {
                    geometry,
                    geometryId,
                };
                triggerEvent(eventTarget, Events.GEOMETRY_CACHE_GEOMETRY_ADDED, eventDetails);
                return;
            })
                .catch((error) => {
                this._geometryCache.delete(geometryId);
                throw error;
            });
        };
        this.incrementImageCacheSize = (increment) => {
            this._imageCacheSize += increment;
        };
        this.incrementVolumeCacheSize = (increment) => {
            this._volumeCacheSize += increment;
        };
        this.decrementImageCacheSize = (decrement) => {
            this._imageCacheSize -= decrement;
        };
        this.decrementVolumeCacheSize = (decrement) => {
            this._volumeCacheSize -= decrement;
        };
        this._geometryCache = new Map();
    }
    getBytesAvailable() {
        return this.getMaxCacheSize() - this.getCacheSize();
    }
    decacheIfNecessaryUntilBytesAvailable(numBytes, volumeImageIds) {
        let bytesAvailable = this.getBytesAvailable();
        if (bytesAvailable >= numBytes) {
            return bytesAvailable;
        }
        let cachedImages = Array.from(this._imageCache.values());
        function compare(a, b) {
            if (a.timeStamp > b.timeStamp) {
                return 1;
            }
            if (a.timeStamp < b.timeStamp) {
                return -1;
            }
            return 0;
        }
        cachedImages.sort(compare);
        let cachedImageIds = cachedImages.map((im) => im.imageId);
        let imageIdsToPurge = cachedImageIds;
        if (volumeImageIds) {
            imageIdsToPurge = cachedImageIds.filter((id) => !volumeImageIds.includes(id));
        }
        for (const imageId of imageIdsToPurge) {
            this.removeImageLoadObject(imageId);
            triggerEvent(eventTarget, Events.IMAGE_CACHE_IMAGE_REMOVED, { imageId });
            bytesAvailable = this.getBytesAvailable();
            if (bytesAvailable >= numBytes) {
                return bytesAvailable;
            }
        }
        cachedImages = Array.from(this._imageCache.values());
        cachedImageIds = cachedImages.map((im) => im.imageId);
        for (const imageId of cachedImageIds) {
            this.removeImageLoadObject(imageId);
            triggerEvent(eventTarget, Events.IMAGE_CACHE_IMAGE_REMOVED, { imageId });
            bytesAvailable = this.getBytesAvailable();
            if (bytesAvailable >= numBytes) {
                return bytesAvailable;
            }
        }
    }
    putImageLoadObject(imageId, imageLoadObject) {
        if (imageId === undefined) {
            throw new Error('putImageLoadObject: imageId must not be undefined');
        }
        if (imageLoadObject.promise === undefined) {
            throw new Error('putImageLoadObject: imageLoadObject.promise must not be undefined');
        }
        if (this._imageCache.has(imageId)) {
            throw new Error('putImageLoadObject: imageId already in cache');
        }
        if (imageLoadObject.cancelFn &&
            typeof imageLoadObject.cancelFn !== 'function') {
            throw new Error('putImageLoadObject: imageLoadObject.cancel must be a function');
        }
        const cachedImage = {
            loaded: false,
            imageId,
            sharedCacheKey: undefined,
            imageLoadObject,
            timeStamp: Date.now(),
            sizeInBytes: 0,
        };
        this._imageCache.set(imageId, cachedImage);
        return imageLoadObject.promise
            .then((image) => {
            if (!this._imageCache.get(imageId)) {
                console.warn('The image was purged from the cache before it completed loading.');
                return;
            }
            if (image.sizeInBytes === undefined ||
                Number.isNaN(image.sizeInBytes)) {
                throw new Error('putImageLoadObject: image.sizeInBytes must not be undefined');
            }
            if (image.sizeInBytes.toFixed === undefined) {
                throw new Error('putImageLoadObject: image.sizeInBytes is not a number');
            }
            if (!this.isCacheable(image.sizeInBytes)) {
                throw new Error(Events.CACHE_SIZE_EXCEEDED);
            }
            this.decacheIfNecessaryUntilBytesAvailable(image.sizeInBytes);
            cachedImage.loaded = true;
            cachedImage.image = image;
            cachedImage.sizeInBytes = image.sizeInBytes;
            this.incrementImageCacheSize(cachedImage.sizeInBytes);
            const eventDetails = {
                image: cachedImage,
            };
            triggerEvent(eventTarget, Events.IMAGE_CACHE_IMAGE_ADDED, eventDetails);
            cachedImage.sharedCacheKey = image.sharedCacheKey;
        })
            .catch((error) => {
            this._imageCache.delete(imageId);
            throw error;
        });
    }
    getImageLoadObject(imageId) {
        if (imageId === undefined) {
            throw new Error('getImageLoadObject: imageId must not be undefined');
        }
        const cachedImage = this._imageCache.get(imageId);
        if (cachedImage === undefined) {
            return;
        }
        cachedImage.timeStamp = Date.now();
        return cachedImage.imageLoadObject;
    }
    isLoaded(imageId) {
        const cachedImage = this._imageCache.get(imageId);
        if (!cachedImage) {
            return false;
        }
        return cachedImage.loaded;
    }
    getVolumeContainingImageId(imageId) {
        const volumeIds = Array.from(this._volumeCache.keys());
        const imageIdToUse = imageIdToURI(imageId);
        for (const volumeId of volumeIds) {
            const cachedVolume = this._volumeCache.get(volumeId);
            const { volume } = cachedVolume;
            if (!volume?.imageIds?.length) {
                return;
            }
            const imageIdIndex = volume.getImageURIIndex(imageIdToUse);
            if (imageIdIndex > -1) {
                return { volume, imageIdIndex };
            }
        }
    }
    getCachedImageBasedOnImageURI(imageId) {
        const imageURIToUse = imageIdToURI(imageId);
        const cachedImageIds = Array.from(this._imageCache.keys());
        const foundImageId = cachedImageIds.find((imageId) => {
            return imageIdToURI(imageId) === imageURIToUse;
        });
        if (!foundImageId) {
            return;
        }
        return this._imageCache.get(foundImageId);
    }
    putVolumeLoadObject(volumeId, volumeLoadObject) {
        if (volumeId === undefined) {
            throw new Error('putVolumeLoadObject: volumeId must not be undefined');
        }
        if (volumeLoadObject.promise === undefined) {
            throw new Error('putVolumeLoadObject: volumeLoadObject.promise must not be undefined');
        }
        if (this._volumeCache.has(volumeId)) {
            throw new Error(`putVolumeLoadObject: volumeId:${volumeId} already in cache`);
        }
        if (volumeLoadObject.cancelFn &&
            typeof volumeLoadObject.cancelFn !== 'function') {
            throw new Error('putVolumeLoadObject: volumeLoadObject.cancel must be a function');
        }
        const cachedVolume = {
            loaded: false,
            volumeId,
            volumeLoadObject,
            timeStamp: Date.now(),
            sizeInBytes: 0,
        };
        this._volumeCache.set(volumeId, cachedVolume);
        return volumeLoadObject.promise
            .then((volume) => {
            if (!this._volumeCache.get(volumeId)) {
                console.warn('The image was purged from the cache before it completed loading.');
                return;
            }
            if (Number.isNaN(volume.sizeInBytes)) {
                throw new Error('putVolumeLoadObject: volume.sizeInBytes must not be undefined');
            }
            if (volume.sizeInBytes.toFixed === undefined) {
                throw new Error('putVolumeLoadObject: volume.sizeInBytes is not a number');
            }
            this.decacheIfNecessaryUntilBytesAvailable(volume.sizeInBytes, volume.imageIds);
            cachedVolume.volume = volume;
            cachedVolume.sizeInBytes = volume.sizeInBytes;
            this.incrementVolumeCacheSize(cachedVolume.sizeInBytes);
            const eventDetails = {
                volume: cachedVolume,
            };
            triggerEvent(eventTarget, Events.VOLUME_CACHE_VOLUME_ADDED, eventDetails);
        })
            .catch((error) => {
            this._volumeCache.delete(volumeId);
            throw error;
        });
    }
    _restoreImagesFromBuffer(volume) {
        if (!(volume instanceof ImageVolume)) {
            console.warn('Volume is not an ImageVolume. Cannot restore images from buffer.');
            return;
        }
        const scalarData = volume.getScalarData();
        const imageCacheOffsetMap = volume.imageCacheOffsetMap;
        if (imageCacheOffsetMap.size === 0) {
            return;
        }
        for (const [imageId, { offset }] of imageCacheOffsetMap) {
            const image = this.getImage(imageId);
            if (!image) {
                console.warn(`Image with id ${imageId} not found in cache.`);
                continue;
            }
            const viewPixelData = image.getPixelData();
            const length = viewPixelData.length;
            const pixelData = new viewPixelData.constructor(scalarData.buffer, offset, length);
            image.getPixelData = () => pixelData;
            if (image.imageFrame) {
                image.imageFrame.pixelData = pixelData;
            }
            delete image.bufferView;
            this.incrementImageCacheSize(image.sizeInBytes);
        }
        console.log(`Images restored from buffer for volume ${volume.volumeId}.`);
    }
}
const cache = new Cache();
export default cache;
export { Cache };
//# sourceMappingURL=cache.js.map